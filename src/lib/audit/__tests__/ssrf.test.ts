import { Readable } from "node:stream";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  assertSafeUrl,
  createLookupCache,
  FetchError,
  isBlockedIp,
  normaliseUrl,
  safeFetch,
  type RequestImpl,
  type ResolvedAddress,
  type Resolver,
  type TransportResponse,
} from "../fetch";

const publicResolver: Resolver = async () => [{ address: "93.184.216.34", family: 4 }];

const reply = (status: number, headers: Record<string, string>, body: string | Buffer = ""): TransportResponse => ({
  status,
  headers,
  body: Readable.from(body.length ? [Buffer.from(body)] : []),
});

type Lookup = Parameters<RequestImpl>[0]["lookup"];

/** Asks the pinned lookup what the connection may use, in both call shapes Node uses. */
function lookupAll(lookup: Lookup, host: string): Promise<ResolvedAddress[]> {
  return new Promise((resolve, reject) =>
    lookup(host, { all: true }, (err, addrs) => (err ? reject(err) : resolve(addrs as ResolvedAddress[]))),
  );
}
function lookupOne(lookup: Lookup, host: string): Promise<string> {
  return new Promise((resolve, reject) => lookup(host, {}, (err, addr) => (err ? reject(err) : resolve(addr as string))));
}

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
    "http://db.intranet",
    "http://files.corp",
    "http://nas.private",
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
    const err = await reject("https://evil.example", priv);
    expect(err.code).toBe("fetch_failed");
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
    const requestImpl: RequestImpl = async () => reply(302, { location: "http://169.254.169.254/latest/meta-data/" });
    await expect(safeFetch("https://example.com", { resolver: publicResolver, requestImpl })).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("follows safe redirects and caps the body size", async () => {
    let calls = 0;
    const requestImpl: RequestImpl = async () => {
      calls++;
      if (calls === 1) return reply(301, { location: "/next" });
      return reply(200, { "content-type": "text/html" }, "x".repeat(5000));
    };
    const res = await safeFetch("https://example.com/start", { resolver: publicResolver, requestImpl, maxBytes: 1000 });
    expect(res.finalUrl).toBe("https://example.com/next");
    expect(res.redirects).toEqual(["https://example.com/next"]);
    expect(res.truncated).toBe(true);
    expect(res.text.length).toBe(1000);
  });

  it("stops after 5 redirects", async () => {
    const requestImpl: RequestImpl = async () => reply(302, { location: "/loop" });
    await expect(safeFetch("https://example.com", { resolver: publicResolver, requestImpl })).rejects.toMatchObject({ code: "fetch_failed" });
  });
});

describe("SSRF: DNS pinning (ssrf:dns-rebinding-check-then-fetch-re-resolution)", () => {
  it("hands the connection only the validated address, even if DNS would now answer differently", async () => {
    let calls = 0;
    const rebinding: Resolver = async () => {
      calls++;
      return calls === 1 ? [{ address: "93.184.216.34", family: 4 }] : [{ address: "169.254.169.254", family: 4 }];
    };
    let all: ResolvedAddress[] = [];
    let one = "";
    const requestImpl: RequestImpl = async (req) => {
      all = await lookupAll(req.lookup, "rebind.example");
      one = await lookupOne(req.lookup, "rebind.example");
      return reply(200, { "content-type": "text/html" }, "<html></html>");
    };
    await safeFetch("https://rebind.example/", { resolver: rebinding, requestImpl });
    expect(all).toEqual([{ address: "93.184.216.34", family: 4 }]);
    expect(one).toBe("93.184.216.34");
    expect(calls).toBe(1); // resolved once; the connect step never resolves again
  });

  it("refuses a lookup for any other hostname", async () => {
    const requestImpl: RequestImpl = async (req) => {
      await expect(lookupAll(req.lookup, "other.example")).rejects.toThrow();
      return reply(200, {}, "ok");
    };
    await safeFetch("https://example.com/", { resolver: publicResolver, requestImpl });
  });

  it("rejects a hostname that resolves to a mix of public and private addresses", async () => {
    const mixed: Resolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.7", family: 4 },
    ];
    const requestImpl: RequestImpl = async () => reply(200, {}, "never reached");
    await expect(safeFetch("https://mixed.example/", { resolver: mixed, requestImpl })).rejects.toMatchObject({ code: "fetch_failed" });
  });

  it("gives the same message for a missing name and a private-resolving name (no DNS oracle)", async () => {
    const requestImpl: RequestImpl = async () => reply(200, {}, "x");
    const missing: Resolver = async () => {
      throw new Error("ENOTFOUND");
    };
    const priv: Resolver = async () => [{ address: "10.0.0.1", family: 4 }];
    const a = await safeFetch("https://same.example/", { resolver: missing, requestImpl }).catch((e: FetchError) => e.message);
    const b = await safeFetch("https://same.example/", { resolver: priv, requestImpl }).catch((e: FetchError) => e.message);
    expect(a).toBe(b);
  });

  it("truncates a small gzip body that inflates past the cap", async () => {
    const gz = zlib.gzipSync(Buffer.from("a".repeat(2_000_000)));
    expect(gz.length).toBeLessThan(10_000);
    const requestImpl: RequestImpl = async () => reply(200, { "content-type": "text/html", "content-encoding": "gzip" }, gz);
    const res = await safeFetch("https://example.com/", { resolver: publicResolver, requestImpl, maxBytes: 1000 });
    expect(res.truncated).toBe(true);
    expect(res.text.length).toBe(1000);
    expect(res.headers["content-encoding"]).toBeUndefined();
  });

  it("decodes gzip, deflate and brotli bodies", async () => {
    for (const [enc, body] of [
      ["gzip", zlib.gzipSync("hello world")],
      ["deflate", zlib.deflateSync("hello world")],
      ["br", zlib.brotliCompressSync("hello world")],
    ] as const) {
      const requestImpl: RequestImpl = async () => reply(200, { "content-type": "text/plain", "content-encoding": enc }, body);
      const res = await safeFetch("https://example.com/", { resolver: publicResolver, requestImpl });
      expect(res.text).toBe("hello world");
    }
  });
});

describe("SSRF: block-list ranges", () => {
  it.each([
    "0.1.2.3",
    "100.127.255.255",
    "192.0.0.8",
    "192.0.2.1",
    "192.88.99.1",
    "198.18.0.1",
    "198.19.255.254",
    "198.51.100.9",
    "203.0.113.9",
    "224.0.0.1",
    "239.255.255.255",
    "240.0.0.1",
    "255.255.255.255",
    "168.63.129.16",
    "::",
    "::1",
    "::ffff:169.254.169.254",
    "::127.0.0.1",
    "64:ff9b::7f00:1",
    "64:ff9b:1::1",
    "100::1",
    "2001::1",
    "2001:0:4136:e378:8000:63bf:3fff:fdd2",
    "2001:db8::1",
    "2002:7f00:1::1",
    "2002:a9fe:a9fe::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "::ffff:0:7f00:1",
  ])("blocks %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "100.63.255.255", "100.128.0.1", "198.17.255.255", "198.20.0.1", "64:ff9b::808:808", "2002:808:808::1", "2606:4700:4700::1111", "2001:4860:4860::8888"])(
    "allows %s",
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    },
  );
});

describe("DNS lookup bounds (dns-lookup-threadpool-starvation-before-abort)", () => {
  it("rejects at the deadline when the resolver never settles", async () => {
    const never: Resolver = () => new Promise(() => undefined);
    const requestImpl: RequestImpl = async () => reply(200, {}, "x");
    const t0 = Date.now();
    await expect(safeFetch("https://stall.example/", { resolver: never, requestImpl, timeoutMs: 300, lookupTimeoutMs: 60_000 })).rejects.toMatchObject({
      code: "fetch_failed",
      message: expect.stringContaining("longer than"),
    });
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("applies the per-lookup timeout before the overall deadline", async () => {
    const never: Resolver = () => new Promise(() => undefined);
    const requestImpl: RequestImpl = async () => reply(200, {}, "x");
    const t0 = Date.now();
    await expect(safeFetch("https://stall.example/", { resolver: never, requestImpl, timeoutMs: 20_000, lookupTimeoutMs: 100 })).rejects.toMatchObject({ code: "fetch_failed" });
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("resolves a hostname once per audit when a lookup cache is shared", async () => {
    let calls = 0;
    const counting: Resolver = async () => {
      calls++;
      return [{ address: "93.184.216.34", family: 4 }];
    };
    const requestImpl: RequestImpl = async () => reply(200, {}, "ok");
    const lookupCache = createLookupCache();
    await Promise.all(["/a", "/b", "/c", "/d"].map((p) => safeFetch(`https://example.com${p}`, { resolver: counting, requestImpl, lookupCache })));
    expect(calls).toBe(1);
  });

  it("still re-validates cached addresses against the block list", async () => {
    const lookupCache = createLookupCache();
    const priv: Resolver = async () => [{ address: "10.0.0.1", family: 4 }];
    const requestImpl: RequestImpl = async () => reply(200, {}, "ok");
    await expect(safeFetch("https://x.example/", { resolver: priv, requestImpl, lookupCache })).rejects.toBeInstanceOf(FetchError);
    await expect(safeFetch("https://x.example/", { resolver: priv, requestImpl, lookupCache })).rejects.toBeInstanceOf(FetchError);
  });
});
