import { getStore, type Store } from "../store";

/**
 * Rate limiting on the store adapter (shared across instances when Upstash/Vercel KV is configured,
 * otherwise a bounded in-memory LRU per instance). Fixed window, see store/types.ts.
 *
 * Trust model for the client key. Forwarding headers are client-controlled unless a proxy we trust
 * overwrites them, so they are used in this order:
 *  1. `x-vercel-forwarded-for`: set by the Vercel edge and not forwarded from the client.
 *  2. the LAST value of `x-forwarded-for`, only when TRUST_PROXY=1 (the last entry is the one added by
 *     the nearest proxy; earlier entries are whatever the client sent).
 *  3. `x-real-ip` (platform-set on common hosts; ignored when TRUST_PROXY=1 already matched).
 *  4. one shared "anonymous" bucket, so inventing header values never creates fresh buckets.
 */
export function clientKey(request: Request, scope: string): string {
  const h = request.headers;
  let ip = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (!ip && process.env.TRUST_PROXY === "1") {
    const parts = h.get("x-forwarded-for")?.split(",");
    ip = parts?.[parts.length - 1]?.trim();
  }
  if (!ip) ip = h.get("x-real-ip")?.trim();
  return `${scope}:${(ip || "anonymous").slice(0, 64)}`;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  store: Store = getStore(),
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const count = await store.incrementWindow(`rl:${key}`, windowMs);
  if (count > limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)) };
  return { ok: true, retryAfterSec: 0 };
}
