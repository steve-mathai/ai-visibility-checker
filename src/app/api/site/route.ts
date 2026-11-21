import { z } from "zod";
import { AuditFailure, statusForCode } from "@/lib/audit";
import { runSiteAudit, SITE_MAX_PARALLEL } from "@/lib/audit/multi";
import { clientKey, rateLimit } from "@/lib/audit/ratelimit";
import { BUSY, errorResponse, GENERIC_FAILURE, noStoreJson, RATE_LIMITED, readJsonBody } from "@/lib/audit/request";
import { acquireWideSlots } from "@/lib/audit/slots";

// The audit stops itself at 55 s and returns what it has, so the platform limit is never what ends it.
export const maxDuration = 60;

const MAX_BODY_BYTES = 4 * 1024;
/** A site audit is about 40 audits, so it has its own small budget: 2 per 10 minutes per connection. */
const SITE_BUDGET = 2;
const WINDOW_MS = 10 * 60 * 1000;

const Body = z.object({ url: z.string().trim().min(1).max(2048) });

export async function POST(request: Request) {
  let limit: { ok: boolean; retryAfterSec: number };
  try {
    limit = await rateLimit(clientKey(request, "site"), SITE_BUDGET, WINDOW_MS);
  } catch {
    return errorResponse(GENERIC_FAILURE, 502);
  }
  if (!limit.ok) return errorResponse(RATE_LIMITED, 429, { "Retry-After": String(limit.retryAfterSec) });

  const parsed = await readJsonBody(request, MAX_BODY_BYTES, '{"url": "example.com"}');
  if ("response" in parsed) return parsed.response;
  const input = Body.safeParse(parsed.body);
  if (!input.success) return errorResponse({ error: "Enter a web address to check.", code: "invalid_url" }, 400);

  const held = acquireWideSlots(SITE_MAX_PARALLEL);
  if (held.length === 0) return errorResponse(BUSY, 429, { "Retry-After": "10" });
  try {
    const report = await runSiteAudit(input.data.url, { signal: request.signal, concurrency: held.length });
    return noStoreJson(report);
  } catch (err) {
    if (err instanceof AuditFailure) return errorResponse({ error: err.message, code: err.code }, statusForCode(err.code));
    console.error("site audit failed:", err instanceof Error ? err.name : "unknown error");
    return errorResponse(GENERIC_FAILURE, 502);
  } finally {
    for (const release of held) release();
  }
}
