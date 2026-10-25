import { describe, expect, it } from "vitest";
import { assertSafeUrl, FetchError, isBlockedIp, normaliseUrl, safeFetch, type Resolver } from "../fetch";

const publicResolver: Resolver = async () => [{ address: "93.184.216.34", family: 4 }];

async function reject(input: string, resolver?: Resolver): Promise<FetchError> {
  try {
    await assertSafeUrl(normaliseUrl(input), resolver ?? publicResolver);
  } catch (err) {
    expect(err).toBeInstanceOf(FetchError);
    return err as FetchError;
  }
  throw new Error(`expected ${input} to be rejected`);
}

describe("SSRF guard", () => {
  it.each([
    "http://127.0.0.1",
    "http://localhost",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5",
    "http://192.168.1.1",
    "http://172.16.5.4",
    "http://100.64.0.1",
    "http://0.0.0.0",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[fc00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://printer.local",
    "http://metadata.internal",
    "http://2130706433", // decimal form of 127.0.0.1, normalised by URL()
  ])("blocks %s", async (url) => {
    const err = await reject(url);
    expect(["blocked_host", "invalid_url"]).toContain(err.code);
  });

  it("rejects non-http schemes", async () => {
    const err = await reject("file:///etc/passwd");
    expect(err.code).toBe("invalid_url");
    expect((await reject("ftp://example.com/x")).code).toBe("invalid_url");
  });

  it("rejects credentials in the URL and odd ports", async () => {
    expect((await reject("https://user:pw@example.com")).code).toBe("invalid_url");
    expect((await reject("https://example.com:8080")).code).toBe("blocked_host");
    expect((await reject("http://example.com:22")).code).toBe("blocked_host");
  });

  it("rejects hostnames that resolve to a private address (DNS rebinding style)", async () => {
    const priv: Resolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.1.2.3", family: 4 },
    ];
    expect((await reject("https://evil.example", priv)).code).toBe("blocked_host");
  });

  it("allows public hosts on default and standard ports", async () => {
    await expect(assertSafeUrl(normaliseUrl("example.com"), publicResolver)).resolves.toBeUndefined();
    await expect(assertSafeUrl(normaliseUrl("https://example.com:443/x"), publicResolver)).resolves.toBeUndefined();
    await expect(assertSafeUrl(normaliseUrl("http://example.com:80"), publicResolver)).resolves.toBeUndefined();
  });

  it("adds https:// when the scheme is missing", () => {
    expect(normaliseUrl("  example.com/path ").toString()).toBe("https://example.com/path");
  });

  it("classifies IP literals", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("172.32.0.1")).toBe(false);
    expect(isBlockedIp("172.31.255.255")).toBe(true);
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedIp("::ffff:10.0.0.1")).toBe(true);
  });

  it("re-validates every redirect hop", async () => {
    const fetchImpl = (async () =>
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } })) as unknown as typeof fetch;
    await expect(safeFetch("https://example.com", { resolver: publicResolver, fetchImpl })).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("follows safe redirects and caps the body size", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      if (calls === 1) return new Response(null, { status: 301, headers: { location: "/next" } });
      return new Response("x".repeat(5000), { status: 200, headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;
    const res = await safeFetch("https://example.com/start", { resolver: publicResolver, fetchImpl, maxBytes: 1000 });
    expect(res.finalUrl).toBe("https://example.com/next");
    expect(res.redirects).toEqual(["https://example.com/next"]);
    expect(res.truncated).toBe(true);
    expect(res.text.length).toBe(1000);
  });

  it("stops after 5 redirects", async () => {
    const fetchImpl = (async () => new Response(null, { status: 302, headers: { location: "/loop" } })) as unknown as typeof fetch;
    await expect(safeFetch("https://example.com", { resolver: publicResolver, fetchImpl })).rejects.toMatchObject({ code: "fetch_failed" });
  });
});
