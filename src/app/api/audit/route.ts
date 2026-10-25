import { AuditFailure, runAudit, statusForCode } from "@/lib/audit";
import { clientKey, rateLimit } from "@/lib/audit/ratelimit";
import type { AuditError } from "@/lib/audit/types";

// POST handlers are never cached or prerendered, so no `dynamic` export is needed
// (and route segment config such as `dynamic` is not allowed with cacheComponents).
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

function errorResponse(error: AuditError, status: number, extra: Record<string, string> = {}) {
  return Response.json(error, { status, headers: { ...NO_STORE, ...extra } });
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "audit"), 30, 10 * 60 * 1000);
  if (!limit.ok) {
    return errorResponse(
      { error: "Too many audits from this connection. Please wait a few minutes and try again.", code: "rate_limited" },
      429,
      { "Retry-After": String(limit.retryAfterSec) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse({ error: "Send a JSON body such as {\"url\": \"example.com\"}.", code: "invalid_url" }, 400);
  }
  const url = typeof body === "object" && body !== null ? (body as { url?: unknown }).url : undefined;
  if (typeof url !== "string" || !url.trim()) {
    return errorResponse({ error: "Enter a web address to check.", code: "invalid_url" }, 400);
  }

  try {
    const report = await runAudit(url);
    return Response.json(report, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AuditFailure) {
      return errorResponse({ error: err.message, code: err.code }, statusForCode(err.code));
    }
    console.error("audit failed", err);
    return errorResponse({ error: "Something went wrong while auditing that page. Please try again.", code: "fetch_failed" }, 502);
  }
}
