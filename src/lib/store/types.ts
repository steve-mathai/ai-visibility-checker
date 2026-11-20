/**
 * Tiny key-value + counter adapter. Two implementations: Upstash/Vercel KV over REST (shared across
 * instances) and an in-memory bounded LRU (per instance).
 */
export interface Store {
  /**
   * Fixed-window counter: the first call for a key starts a window of `windowMs`; every call inside it
   * adds one and returns the new count. The key disappears when the window ends and the next call
   * starts a fresh window. (Fixed rather than sliding: one round trip, and bursts at a window edge of
   * up to 2x the limit are acceptable for abuse control.)
   */
  incrementWindow(key: string, windowMs: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
}
