import type { Store } from "./types";

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * In-memory store with a hard key cap. A Map keeps insertion order, so re-inserting on every write makes
 * the first key the least recently written one, which is evicted when the cap is hit. This bounds memory
 * no matter how many distinct keys an attacker invents.
 */
export class MemoryStore implements Store {
  private map = new Map<string, Entry>();
  constructor(
    private readonly maxKeys = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number {
    return this.map.size;
  }

  private live(key: string): Entry | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return e;
  }

  private put(key: string, value: string, expiresAt: number): void {
    this.map.delete(key);
    this.map.set(key, { value, expiresAt });
    while (this.map.size > this.maxKeys) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  async incrementWindow(key: string, windowMs: number): Promise<number> {
    const e = this.live(key);
    if (!e) {
      this.put(key, "1", this.now() + windowMs);
      return 1;
    }
    const n = Number(e.value) + 1;
    // Keep the original expiry (fixed window) but refresh LRU position.
    this.put(key, String(n), e.expiresAt);
    return n;
  }

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.put(key, value, this.now() + ttlMs);
  }
}
