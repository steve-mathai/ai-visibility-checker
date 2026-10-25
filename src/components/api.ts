import type {
  AiSummaryResponse,
  AuditError,
  AuditReport,
} from "@/lib/audit/types";

/** Client-side wrappers for the two API routes. */

export type AuditResult =
  | { ok: true; report: AuditReport }
  | { ok: false; code: string; message: string };

const AUDIT_TIMEOUT_MS = 60_000;
const SUMMARY_TIMEOUT_MS = 75_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAuditReport(value: unknown): value is AuditReport {
  return (
    isRecord(value) &&
    typeof value.overallScore === "number" &&
    Array.isArray(value.categories) &&
    Array.isArray(value.fixes) &&
    Array.isArray(value.bots)
  );
}

function isAuditError(value: unknown): value is AuditError {
  return (
    isRecord(value) &&
    typeof value.error === "string" &&
    typeof value.code === "string"
  );
}

function withTimeout(signal: AbortSignal, ms: number): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(ms)]);
}

export async function requestAudit(
  url: string,
  signal: AbortSignal,
): Promise<AuditResult> {
  try {
    const res = await fetch("/api/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
      signal: withTimeout(signal, AUDIT_TIMEOUT_MS),
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.ok && isAuditReport(data)) return { ok: true, report: data };
    if (isAuditError(data)) {
      return { ok: false, code: data.code, message: data.error };
    }
    return {
      ok: false,
      code: "server_error",
      message: `The checker returned an unexpected response (HTTP ${res.status}).`,
    };
  } catch {
    if (signal.aborted) {
      return { ok: false, code: "aborted", message: "Request cancelled." };
    }
    return {
      ok: false,
      code: "network",
      message:
        "The request failed or took too long. Check your connection and try again.",
    };
  }
}

/** Never rejects: failures come back as `{ enabled: false, reason }`. */
export async function requestSummary(
  report: AuditReport,
  signal: AbortSignal,
): Promise<AiSummaryResponse> {
  try {
    const res = await fetch("/api/summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ report }),
      signal: withTimeout(signal, SUMMARY_TIMEOUT_MS),
    });
    const data: unknown = await res.json();
    if (isRecord(data) && data.enabled === true && isRecord(data.result)) {
      return data as AiSummaryResponse;
    }
    if (isRecord(data) && data.enabled === false) {
      return {
        enabled: false,
        reason:
          typeof data.reason === "string" && data.reason
            ? data.reason
            : "the summary service did not return a result",
      };
    }
    return {
      enabled: false,
      reason: "the summary service returned an unexpected response",
    };
  } catch {
    return {
      enabled: false,
      reason: "the summary request failed or took too long",
    };
  }
}
