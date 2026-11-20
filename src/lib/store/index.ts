import { MemoryStore } from "./memory";
import type { Store } from "./types";
import { UpstashStore } from "./upstash";

export type { Store } from "./types";
export { MemoryStore } from "./memory";
export { UpstashStore } from "./upstash";

/**
 * Wraps a remote store with an in-memory fallback. If the remote errors, that one call is served from
 * memory (so limits keep applying per instance instead of failing open) and the first error is logged.
 */
export class FallbackStore implements Store {
  private logged = false;
  constructor(
    private readonly primary: Store,
    private readonly fallback: Store,
  ) {}

  private async run<T>(op: (s: Store) => Promise<T>): Promise<T> {
    try {
      return await op(this.primary);
    } catch (err) {
      if (!this.logged) {
        this.logged = true;
        console.error("store unavailable, using in-memory fallback:", err instanceof Error ? err.message : "unknown error");
      }
      return op(this.fallback);
    }
  }

  incrementWindow(key: string, windowMs: number) {
    return this.run((s) => s.incrementWindow(key, windowMs));
  }
  get(key: string) {
    return this.run((s) => s.get(key));
  }
  set(key: string, value: string, ttlMs: number) {
    return this.run((s) => s.set(key, value, ttlMs));
  }
}

const memory = new MemoryStore(10_000);
let cached: { id: string; store: Store } | null = null;

/** Upstash/Vercel KV when configured, otherwise the in-memory store. Read from env on each call. */
export function getStore(): Store {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return memory;
  const id = `${url}|${token}`;
  if (!cached || cached.id !== id) {
    cached = { id, store: new FallbackStore(new UpstashStore({ url, token }), memory) };
  }
  return cached.store;
}
