import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sanitiseProps, track } from "../analytics";

const plausible = vi.fn();
const va = vi.fn();

beforeEach(() => {
  plausible.mockReset();
  va.mockReset();
  vi.stubGlobal("window", { plausible, va });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("track", () => {
  it("does nothing when no provider is set", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS", "");
    track("audit_started", { host: "example.com" });
    expect(plausible).not.toHaveBeenCalled();
    expect(va).not.toHaveBeenCalled();
  });

  it("calls window.plausible with props", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS", "plausible");
    track("audit_finished", { host: "example.com", score: 71, grade: "B" });
    expect(plausible).toHaveBeenCalledWith("audit_finished", {
      props: { host: "example.com", score: 71, grade: "B" },
    });
    expect(va).not.toHaveBeenCalled();
  });

  it("calls window.va with name and data", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS", "vercel");
    track("fix_snippet_copied");
    expect(va).toHaveBeenCalledWith("event", { name: "fix_snippet_copied" });
    track("audit_started", { host: "example.com" });
    expect(va).toHaveBeenLastCalledWith("event", {
      name: "audit_started",
      data: { host: "example.com" },
    });
    expect(plausible).not.toHaveBeenCalled();
  });

  it("never throws when the provider function is missing", () => {
    vi.stubGlobal("window", {});
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS", "plausible");
    expect(() => track("share_link_copied")).not.toThrow();
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS", "vercel");
    expect(() => track("share_link_copied")).not.toThrow();
  });

  it("never throws when there is no window or the provider throws", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS", "plausible");
    vi.unstubAllGlobals();
    expect(() => track("email_submitted")).not.toThrow();
    vi.stubGlobal("window", {
      plausible: () => {
        throw new Error("blocked");
      },
    });
    expect(() => track("email_submitted")).not.toThrow();
  });

  it("sends PII-free props to the provider", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS", "plausible");
    track("email_submitted", { email: "a@b.com", note: "a@b.com", host: "example.com" });
    expect(plausible).toHaveBeenCalledWith("email_submitted", { props: { host: "example.com" } });
  });
});

describe("sanitiseProps", () => {
  it("drops emails and email-named keys", () => {
    expect(sanitiseProps({ email: "x", contact: "me@site.com", ok: true })).toEqual({ ok: true });
  });

  it("reduces URLs and query strings to the hostname", () => {
    expect(
      sanitiseProps({ page: "https://example.com/a/b?token=1#x", host: "example.com?q=1" }),
    ).toEqual({ page: "example.com", host: "example.com" });
  });

  it("drops non-finite numbers and returns undefined when empty", () => {
    expect(sanitiseProps({ score: Number.NaN })).toBeUndefined();
    expect(sanitiseProps(undefined)).toBeUndefined();
  });
});
