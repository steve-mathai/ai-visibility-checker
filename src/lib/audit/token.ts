import { createHmac, timingSafeEqual } from "node:crypto";

/** Tokens are valid for 24 hours, the same as the summary cache. */
export const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

/**
 * Signing key: SUMMARY_SIGNING_SECRET, else derived from ANTHROPIC_API_KEY, else none (the summary is off
 * anyway, so no token is issued).
 */
export function signingKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  if (env.SUMMARY_SIGNING_SECRET) return Buffer.from(env.SUMMARY_SIGNING_SECRET, "utf8");
  if (env.ANTHROPIC_API_KEY) {
    return createHmac("sha256", env.ANTHROPIC_API_KEY).update("ai-visibility-checker/summary-token/v1").digest();
  }
  return null;
}

function mac(key: Buffer, digest: string, issuedAt: number): Buffer {
  return createHmac("sha256", key).update(`${digest}.${issuedAt}`).digest();
}

/** `base64url(HMAC-SHA256(key, digest + "." + issuedAtMs)) + "." + issuedAtMs`, or null with no key. */
export function signSummaryToken(digest: string, now = Date.now(), key = signingKey()): string | null {
  if (!key) return null;
  return `${mac(key, digest, now).toString("base64url")}.${now}`;
}

export function verifySummaryToken(digest: string, token: unknown, now = Date.now(), key = signingKey()): boolean {
  if (!key || typeof token !== "string" || token.length > 200) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const issuedAt = Number(token.slice(dot + 1));
  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) return false;
  if (now - issuedAt > TOKEN_MAX_AGE_MS || issuedAt - now > FUTURE_SKEW_MS) return false;
  const given = Buffer.from(token.slice(0, dot), "base64url");
  const want = mac(key, digest, issuedAt);
  return given.length === want.length && timingSafeEqual(given, want);
}
