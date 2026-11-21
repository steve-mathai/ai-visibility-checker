import type { AuditError } from "@/lib/audit/types";
import type { CompareResponse, SiteReport } from "@/lib/audit/wide-types";

/** Client-side wrappers for /api/compare and /api/site. */

export type WideResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

// A little longer than the server's own deadlines (35 s and 55 s), so the server's answer wins.
const COMPARE_TIMEOUT_MS = 45_000;
const SITE_TIMEOUT_MS = 65_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAuditError(value: unknown): value is AuditError {
  return isRecord(value) && typeof value.error === "string" && typeof value.code === "string";
}

async function post<T>(path: string, body: unknown, signal: AbortSignal, timeoutMs: number, isValid: (data: unknown) => data is T): Promise<WideResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.ok && isValid(data)) return { ok: true, data };
    if (isAuditError(data)) return { ok: false, code: data.code, message: data.error };
    return { ok: false, code: "server_error", message: `The checker returned an unexpected response (HTTP ${res.status}).` };
  } catch {
    if (signal.aborted) return { ok: false, code: "aborted", message: "Request cancelled." };
    return { ok: false, code: "network", message: "The request failed or took too long. Check your connection and try again." };
  }
}

const isCompareResponse = (data: unknown): data is CompareResponse => isRecord(data) && Array.isArray(data.results);
const isSiteReport = (data: unknown): data is SiteReport => isRecord(data) && Array.isArray(data.patterns) && Array.isArray(data.templates);

export const requestCompare = (urls: string[], signal: AbortSignal) => post("/api/compare", { urls }, signal, COMPARE_TIMEOUT_MS, isCompareResponse);

export const requestSite = (url: string, signal: AbortSignal) => post("/api/site", { url }, signal, SITE_TIMEOUT_MS, isSiteReport);
