import type { CategoryId, CheckResult, CheckStatus, Effort, Fix, Impact } from "../types";
import type { AuditContext } from "../context";
import { asString, isNode, isOrgNode, logoUrl, typesOf, type JsonLdNode } from "../schema";
import { resolveRef } from "../parse";

export function check(
  category: CategoryId,
  id: string,
  title: string,
  maxPoints: number,
  status: CheckStatus,
  points: number,
  summary: string,
  extra: { evidence?: string[]; fix?: Fix } = {},
): CheckResult {
  const result: CheckResult = {
    id,
    category,
    title,
    status,
    points: Math.max(0, Math.min(maxPoints, points)),
    maxPoints,
    summary,
  };
  if (extra.evidence && extra.evidence.length) result.evidence = extra.evidence;
  if (extra.fix && (status === "warn" || status === "fail")) result.fix = extra.fix;
  return result;
}

export function fix(
  title: string,
  why: string,
  how: string,
  impact: Impact,
  effort: Effort,
  snippet?: string,
): Fix {
  const f: Fix = { title, why, how, impact, effort };
  if (snippet) f.snippet = snippet;
  return f;
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

export function jsonLdSnippet(data: unknown): string {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

/** Brand name to use in snippets: detected business name, else the site's hostname. */
export function brandName(ctx: AuditContext): string {
  return ctx.page.facts.businessName ?? ctx.page.url.hostname.replace(/^www\./, "");
}

/** The best Organization/LocalBusiness node on the page, preferring top-level nodes. */
export function findOrgNode(ctx: AuditContext): JsonLdNode | null {
  const { topNodes, allNodes } = ctx.page.jsonLd;
  return topNodes.find(isOrgNode) ?? allNodes.find(isOrgNode) ?? null;
}

/** Nodes that describe the entity behind the site: organisation, business or person. */
export function findEntityNodes(ctx: AuditContext): JsonLdNode[] {
  return ctx.page.jsonLd.allNodes.filter((n) => isOrgNode(n) || typesOf(n).includes("Person"));
}

export function nodeValue(ctx: AuditContext, node: JsonLdNode, key: string): unknown {
  return resolveRef(ctx.page, node[key]);
}

export function nodeLogo(ctx: AuditContext, node: JsonLdNode): string | null {
  return logoUrl(nodeValue(ctx, node, "logo")) ?? logoUrl(node.image);
}

export function nodeString(ctx: AuditContext, node: JsonLdNode, key: string): string | null {
  const v = nodeValue(ctx, node, key);
  return isNode(v) || typeof v === "string" || typeof v === "number" ? asString(v) : null;
}

export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sameOrigin(a: URL, b: URL): boolean {
  return a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");
}

const ABOUT_PATH = /(^|[/_-])(about(?:-us)?|company|our-story|story|team|our-team|who-we-are|mission)([/_.-]|$)/i;
const ABOUT_TEXT = /^(about( us)?|about [\w .&'-]{1,30}|company|our story|our team|team|meet the team|who we are)$/i;
const CONTACT_PATH = /(^|[/_-])(contact(?:-us)?|get-in-touch|support|help|reach-us|enquir(?:y|ies))([/_.-]|$)/i;
const CONTACT_TEXT = /^(contact( us)?|get in touch|support|help|help cent(?:er|re)|customer support|reach us|enquiries)$/i;

export interface SiteLinks {
  about: { url: string; text: string } | null;
  contact: { url: string; text: string } | null;
}

/** Same-origin links that look like an About or Contact page. The page itself counts too. */
export function findSiteLinks(ctx: AuditContext): SiteLinks {
  const out: SiteLinks = { about: null, contact: null };
  const here = ctx.page.url;
  for (const l of ctx.page.links) {
    if (!sameOrigin(l.href, here)) continue;
    const path = l.href.pathname;
    // Cloudflare rewrites mailto links to /cdn-cgi/l/email-protection; that is not a contact page.
    if (path.startsWith("/cdn-cgi/")) continue;
    const text = l.text.length <= 40 ? l.text : "";
    if (!out.about && (ABOUT_PATH.test(path) || ABOUT_TEXT.test(text)) && path !== "/") {
      out.about = { url: l.href.toString(), text: text || path };
    }
    if (!out.contact && (CONTACT_PATH.test(path) || CONTACT_TEXT.test(text)) && path !== "/") {
      out.contact = { url: l.href.toString(), text: text || path };
    }
    if (out.about && out.contact) break;
  }
  if (!out.about && ABOUT_PATH.test(here.pathname)) out.about = { url: here.toString(), text: "this page" };
  if (!out.contact && CONTACT_PATH.test(here.pathname)) out.contact = { url: here.toString(), text: "this page" };
  return out;
}

const QUESTION_START = /^(what|why|how|when|where|who|which|can|does|do|is|are|should|will)\b/i;

export function isQuestionHeading(text: string): boolean {
  const t = text.trim();
  return t.endsWith("?") || QUESTION_START.test(t);
}

/** H2/H3 sections whose heading is phrased as a question. */
export function questionSections(ctx: AuditContext) {
  return ctx.page.sections.filter((s) => isQuestionHeading(s.heading));
}

export function hasType(ctx: AuditContext, ...types: string[]): boolean {
  const wanted = new Set(types.map((t) => t.toLowerCase()));
  return ctx.page.jsonLd.topNodes.some((n) => typesOf(n).some((t) => wanted.has(t.toLowerCase()))) ||
    ctx.page.microdataTypes.some((t) => wanted.has(t.toLowerCase()));
}
