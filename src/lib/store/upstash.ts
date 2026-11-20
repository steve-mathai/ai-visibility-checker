import type { Store } from "./types";

export interface UpstashConfig {
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type Command = (string | number)[];

/** Upstash / Vercel KV REST API, plain fetch. Throws on any failure so the caller can fall back. */
export class UpstashStore implements Store {
  private readonly url: string;
  private readonly token: string;
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(cfg: UpstashConfig) {
    this.url = cfg.url.replace(/\/+$/, "");
    this.token = cfg.token;
    this.doFetch = cfg.fetchImpl ?? fetch;
    this.timeoutMs = cfg.timeoutMs ?? 1_500;
  }

  private async pipeline(commands: Command[]): Promise<unknown[]> {
    const res = await this.doFetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`store HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length !== commands.length) throw new Error("store bad response");
    return data.map((item) => {
      if (item && typeof item === "object" && "error" in item && (item as { error?: unknown }).error) {
        throw new Error("store command error");
      }
      return (item as { result?: unknown } | null)?.result;
    });
  }

  async incrementWindow(key: string, windowMs: number): Promise<number> {
    const [count] = await this.pipeline([
      ["INCR", key],
      ["PEXPIRE", key, windowMs, "NX"], // only set on the first hit: fixed window
    ]);
    const n = Number(count);
    if (!Number.isFinite(n)) throw new Error("store bad counter");
    return n;
  }

  async get(key: string): Promise<string | null> {
    const [v] = await this.pipeline([["GET", key]]);
    return typeof v === "string" ? v : null;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.pipeline([["SET", key, value, "PX", Math.max(1, Math.floor(ttlMs))]]);
  }
}
