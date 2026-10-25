import { describe, expect, it } from "vitest";
import { evaluate, parseRobots } from "../robots";
import { evaluateBots } from "../bots";

describe("robots.txt parser", () => {
  it("allows everything for an empty file", () => {
    expect(evaluate("", "Googlebot", "/anything")).toEqual({ allowed: true, rule: "no matching rule" });
    expect(evaluate(null, "Googlebot", "/")).toEqual({ allowed: true, rule: "no matching rule" });
  });

  it("applies a wildcard group to bots without their own group", () => {
    const txt = "User-agent: *\nDisallow: /private/";
    expect(evaluate(txt, "GPTBot", "/private/page").allowed).toBe(false);
    expect(evaluate(txt, "GPTBot", "/public").allowed).toBe(true);
  });

  it("prefers the specific group over *", () => {
    const txt = "User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /";
    expect(evaluate(txt, "OAI-SearchBot", "/page").allowed).toBe(true);
    expect(evaluate(txt, "PerplexityBot", "/page").allowed).toBe(false);
  });

  it("matches user-agent tokens case-insensitively", () => {
    const txt = "user-agent: gptbot\ndisallow: /";
    expect(evaluate(txt, "GPTBot", "/x").allowed).toBe(false);
    expect(evaluate("User-Agent: GPTBOT\nDisallow: /", "gptbot", "/x").allowed).toBe(false);
  });

  it("supports * wildcards", () => {
    const txt = "User-agent: *\nDisallow: /*.pdf\nDisallow: /tmp*/cache";
    expect(evaluate(txt, "Googlebot", "/files/report.pdf").allowed).toBe(false);
    expect(evaluate(txt, "Googlebot", "/files/report.pdf.html").allowed).toBe(false);
    expect(evaluate(txt, "Googlebot", "/tmp123/cache").allowed).toBe(false);
    expect(evaluate(txt, "Googlebot", "/files/report.html").allowed).toBe(true);
  });

  it("supports the $ end anchor", () => {
    const txt = "User-agent: *\nDisallow: /*.pdf$";
    expect(evaluate(txt, "Googlebot", "/a.pdf").allowed).toBe(false);
    expect(evaluate(txt, "Googlebot", "/a.pdf?x=1").allowed).toBe(true);
    expect(evaluate(txt, "Googlebot", "/a.pdfx").allowed).toBe(true);
  });

  it("lets the longest matching rule win", () => {
    const txt = "User-agent: *\nDisallow: /shop/\nAllow: /shop/sale/";
    expect(evaluate(txt, "Bingbot", "/shop/sale/item")).toEqual({ allowed: true, rule: "Allow: /shop/sale/" });
    expect(evaluate(txt, "Bingbot", "/shop/other")).toEqual({ allowed: false, rule: "Disallow: /shop/" });
  });

  it("lets Allow win a tie in length", () => {
    const txt = "User-agent: *\nDisallow: /page\nAllow: /page";
    expect(evaluate(txt, "Googlebot", "/page").allowed).toBe(true);
    // order must not matter
    const reversed = "User-agent: *\nAllow: /page\nDisallow: /page";
    expect(evaluate(reversed, "Googlebot", "/page").allowed).toBe(true);
  });

  it("treats an empty Disallow as allow-all", () => {
    expect(evaluate("User-agent: *\nDisallow:", "Googlebot", "/x").allowed).toBe(true);
  });

  it("shares rules across consecutive user-agent lines and ignores comments", () => {
    const txt = "# hello\nUser-agent: GPTBot\nUser-agent: CCBot # both\nDisallow: /\n";
    expect(evaluate(txt, "GPTBot", "/").allowed).toBe(false);
    expect(evaluate(txt, "CCBot", "/").allowed).toBe(false);
    expect(evaluate(txt, "Googlebot", "/").allowed).toBe(true);
  });

  it("collects Sitemap lines", () => {
    const parsed = parseRobots("Sitemap: https://a.example/s1.xml\nUser-agent: *\nDisallow:\nSitemap: https://a.example/s2.xml");
    expect(parsed.sitemaps).toEqual(["https://a.example/s1.xml", "https://a.example/s2.xml"]);
  });

  it("evaluates all 14 bots and reports the deciding rule", () => {
    const bots = evaluateBots("User-agent: GPTBot\nDisallow: /\n", "/page");
    expect(bots).toHaveLength(14);
    const gpt = bots.find((b) => b.bot === "GPTBot");
    expect(gpt).toMatchObject({ allowed: false, purpose: "training", operator: "OpenAI", rule: "Disallow: /" });
    expect(bots.find((b) => b.bot === "OAI-SearchBot")?.allowed).toBe(true);
    expect(bots.filter((b) => b.purpose === "answer")).toHaveLength(6);
    expect(bots.filter((b) => b.purpose === "search")).toHaveLength(2);
  });
});
