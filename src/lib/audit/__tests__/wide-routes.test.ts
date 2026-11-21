import { describe, expect, it } from "vitest";
import { POST as compare } from "@/app/api/compare/route";
import { POST as site } from "@/app/api/site/route";
import { auditSlots, MAX_CONCURRENT_AUDITS } from "../concurrency";
import { acquireWideSlots, RESERVED_FOR_SINGLE_AUDITS } from "../slots";

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("/api/compare request checks", () => {
  const ip = { "x-vercel-forwarded-for": "198.51.100.10" };

  it("requires a JSON content type", async () => {
    const res = await compare(post("/api/compare", "x", { ...ip, "content-type": "text/plain" }));
    expect(res.status).toBe(415);
  });

  it("caps the body size", async () => {
    const res = await compare(post("/api/compare", JSON.stringify({ urls: ["a.com", "b.com"], pad: "x".repeat(10_000) }), ip));
    expect(res.status).toBe(413);
  });

  it("validates the list: 2 to 4 different addresses", async () => {
    for (const urls of [["a.com"], ["a.com", "a.com"], ["a.com", "b.com", "c.com", "d.com", "e.com"], ["a.com", 5], "a.com"]) {
      const res = await compare(post("/api/compare", { urls }, ip));
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe("invalid_url");
    }
    expect((await compare(post("/api/compare", "{nope", ip))).status).toBe(400);
  });

  it("charges one unit per address and stops at the shared audit budget", async () => {
    const heavy = { "x-vercel-forwarded-for": "198.51.100.77" };
    // Addresses the guard refuses instantly, so no network is touched: the point is the budget.
    const urls = ["http://127.0.0.1", "http://10.0.0.1", "http://localhost", "http://192.168.0.1"];
    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) statuses.push((await compare(post("/api/compare", { urls }, heavy))).status);
    // 30 units per window, 4 per call: seven calls fit (28), the eighth crosses the limit.
    expect(statuses.slice(0, 7)).toEqual(Array(7).fill(200));
    expect(statuses[7]).toBe(429);
  });

  it("answers 200 with a per-address error for each blocked address", async () => {
    const res = await compare(post("/api/compare", { urls: ["http://127.0.0.1", "http://localhost"] }, { "x-vercel-forwarded-for": "198.51.100.11" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { results: { ok: boolean; code?: string }[] };
    expect(data.results.map((r) => r.ok)).toEqual([false, false]);
    expect(data.results.map((r) => r.code)).toEqual(["blocked_host", "blocked_host"]);
  });
});

describe("/api/site request checks", () => {
  it("allows 2 per 10 minutes per connection, then 429 with Retry-After", async () => {
    const ip = { "x-vercel-forwarded-for": "198.51.100.20" };
    const bad = { "content-type": "text/plain", ...ip };
    expect((await site(post("/api/site", "x", bad))).status).toBe(415);
    expect((await site(post("/api/site", "x", bad))).status).toBe(415);
    const limited = await site(post("/api/site", "x", bad));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("600");
  });

  it("caps the body and validates the address", async () => {
    const ip = { "x-vercel-forwarded-for": "198.51.100.21" };
    expect((await site(post("/api/site", JSON.stringify({ url: "a.com", pad: "x".repeat(10_000) }), ip))).status).toBe(413);
    expect((await site(post("/api/site", { url: 5 }, ip))).status).toBe(400);
  });

  it("answers a private address with a plain error and no internal detail", async () => {
    const res = await site(post("/api/site", { url: "http://169.254.169.254/" }, { "x-vercel-forwarded-for": "198.51.100.22" }));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string; code: string };
    expect(data.code).toBe("blocked_host");
    expect(JSON.stringify(data)).not.toMatch(/stack|ECONN|at \w+\.\w+/);
  });
});

describe("shared audit slots", () => {
  it("wide jobs never take the slots reserved for single audits", () => {
    const held = acquireWideSlots(MAX_CONCURRENT_AUDITS);
    const second = acquireWideSlots(4);
    expect(held).toHaveLength(MAX_CONCURRENT_AUDITS - RESERVED_FOR_SINGLE_AUDITS);
    expect(second).toHaveLength(0);
    const single = auditSlots.tryAcquire();
    expect(single).not.toBeNull();
    single?.();
    for (const release of held) release();
    expect(auditSlots.inFlight).toBe(0);
  });
});
