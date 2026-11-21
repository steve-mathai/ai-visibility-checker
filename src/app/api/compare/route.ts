import { z } from "zod";
import { COMPARE_MAX, COMPARE_MIN, runCompare } from "@/lib/audit/compare";
import { clientKey, rateLimit } from "@/lib/audit/ratelimit";
import { BUSY, errorResponse, GENERIC_FAILURE, noStoreJson, RATE_LIMITED, readJsonBody } from "@/lib/audit/request";
import { acquireWideSlots } from "@/lib/audit/slots";
import type { CompareResponse } from "@/lib/audit/wide-types";

// Each address is a normal audit (up to about 16 s), run up to four at a time.
export const maxDuration = 40;

const MAX_BODY_BYTES = 4 * 1024;
const DEADLINE_MS = 35_000;
const WINDOW_MS = 10 * 60 * 1000;
/** Shares the single-audit budget (30 per 10 minutes); a comparison of N addresses costs N. */
const AUDIT_BUDGET = 30;

const Body = z.object({
  urls: z.array(z.string().trim().min(1).max(2048)).min(COMPARE_MIN).max(COMPARE_MAX),
});

export async function POST(request: Request) {
  const key = clientKey(request, "audit");
  const parsed = await readJsonBody(request, MAX_BODY_BYTES, '{"urls": ["a.com", "b.com"]}');
  if ("response" in parsed) return parsed.response;
  const input = Body.safeParse(parsed.body);
  const urls = input.success ? [...new Set(input.data.urls)] : [];
  if (!input.success || urls.length < COMPARE_MIN) {
    return errorResponse({ error: `Enter between ${COMPARE_MIN} and ${COMPARE_MAX} different web addresses to compare.`, code: "invalid_url" }, 400);
  }

  try {
    for (let i = 0; i < urls.length; i++) {
      const limit = await rateLimit(key, AUDIT_BUDGET, WINDOW_MS);
      if (!limit.ok) return errorResponse(RATE_LIMITED, 429, { "Retry-After": String(limit.retryAfterSec) });
    }
  } catch {
    return errorResponse(GENERIC_FAILURE, 502);
  }

  const held = acquireWideSlots(urls.length);
  if (held.length === 0) return errorResponse(BUSY, 429, { "Retry-After": "10" });
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(DEADLINE_MS)]);
    const results = await runCompare(urls, { signal, concurrency: held.length });
    return noStoreJson({ results } satisfies CompareResponse);
  } catch {
    return errorResponse(GENERIC_FAILURE, 502);
  } finally {
    for (const release of held) release();
  }
}
