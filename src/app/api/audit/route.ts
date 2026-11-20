import { AuditFailure, runAudit, statusForCode } from "@/lib/audit";
import { auditSlots } from "@/lib/audit/concurrency";
import { clientKey, rateLimit } from "@/lib/audit/ratelimit";
import { buildDigest } from "@/lib/audit/summary";
import { signSummaryToken } from "@/lib/audit/token";
import type { AuditError } from "@/lib/audit/types";
import { isJsonContentType, readTextCapped } from "@/lib/http";

// POST handlers are never cached or prerendered, so no `dynamic` export is needed
// (and route segment config such as `dynamic` is not allowed with cacheComponents).
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 4 * 1024;

function errorResponse(error: AuditError, status: number, extra: Record<string, string> = {}) {
  return Response.json(error, { status, headers: { ...NO_STORE, ...extra } });
}

export async function POST(request: Request) {
  let limit: { ok: boolean; retryAfterSec: number };
  try {
    limit = await rateLimit(clientKey(request, "audit"), 30, 10 * 60 * 1000);
  } catch {
    // The store adapter already falls back to memory; if even that throws, refuse rather than run unlimited.
    return errorResponse({ error: "Something went wrong while auditing that page. Please try again.", code: "fetch_failed" }, 502);
  }
  if (!limit.ok) {
    return errorResponse(
      { error: "Too many audits from this connection. Please wait a few minutes and try again.", code: "rate_limited" },
      429,
      { "Retry-After": String(limit.retryAfterSec) },
    );
  }

  if (!isJsonContentType(request)) {
    return errorResponse({ error: "Send a JSON body such as {\"url\": \"example.com\"}.", code: "invalid_url" }, 415);
  }
  const text = await readTextCapped(request, MAX_BODY_BYTES).catch(() => null);
  if (text === null) {
    return errorResponse({ error: "That request was too large.", code: "invalid_url" }, 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse({ error: "Send a JSON body such as {\"url\": \"example.com\"}.", code: "invalid_url" }, 400);
  }
  const url = typeof body === "object" && body !== null ? (body as { url?: unknown }).url : undefined;
  if (typeof url !== "string" || !url.trim()) {
    return errorResponse({ error: "Enter a web address to check.", code: "invalid_url" }, 400);
  }

  const release = auditSlots.tryAcquire();
  if (!release) {
    return errorResponse({ error: "The checker is busy right now. Please try again in a moment.", code: "busy" }, 429, { "Retry-After": "10" });
  }
  try {
    const report = await runAudit(url, { signal: request.signal });
    // Proof that this report came from a real audit; /api/summary verifies it before spending model tokens.
    const token = signSummaryToken(buildDigest(report));
    if (token) report.summaryToken = token;
    return Response.json(report, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AuditFailure) {
      return errorResponse({ error: err.message, code: err.code }, statusForCode(err.code));
    }
    console.error("audit failed:", err instanceof Error ? err.name : "unknown error");
    return errorResponse({ error: "Something went wrong while auditing that page. Please try again.", code: "fetch_failed" }, 502);
  } finally {
    release();
  }
}
