import type { AuditError } from "./types";
import { isJsonContentType, readTextCapped } from "../http";

const NO_STORE = { "Cache-Control": "no-store" };

export function errorResponse(error: AuditError, status: number, extra: Record<string, string> = {}): Response {
  return Response.json(error, { status, headers: { ...NO_STORE, ...extra } });
}

export const noStoreJson = (body: unknown): Response => Response.json(body, { headers: NO_STORE });

/**
 * Same request checks as /api/audit: JSON content type, a hard byte cap before parsing, then JSON.parse.
 * Returns the parsed body, or the error response to send.
 */
export async function readJsonBody(request: Request, maxBytes: number, example: string): Promise<{ body: unknown } | { response: Response }> {
  if (!isJsonContentType(request)) {
    return { response: errorResponse({ error: `Send a JSON body such as ${example}.`, code: "invalid_url" }, 415) };
  }
  const text = await readTextCapped(request, maxBytes).catch(() => null);
  if (text === null) return { response: errorResponse({ error: "That request was too large.", code: "invalid_url" }, 413) };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { response: errorResponse({ error: `Send a JSON body such as ${example}.`, code: "invalid_url" }, 400) };
  }
}

export const BUSY: AuditError = { error: "The checker is busy right now. Please try again in a moment.", code: "busy" };
export const RATE_LIMITED: AuditError = { error: "Too many audits from this connection. Please wait a few minutes and try again.", code: "rate_limited" };
export const GENERIC_FAILURE: AuditError = { error: "Something went wrong while auditing. Please try again.", code: "fetch_failed" };
