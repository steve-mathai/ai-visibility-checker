import type { BotVerdict } from "./types";
import type { ParsedPage } from "./parse";

export interface RobotsInfo {
  /** found = parsed OK; missing = 404/410 or HTML soft-404; restricted = 401/403; error = 5xx/timeout. */
  status: "found" | "missing" | "restricted" | "error";
  httpStatus?: number;
  /** Text to evaluate bots against; null means "everything allowed". */
  text: string | null;
  sitemaps: string[];
}

export interface LlmsInfo {
  found: boolean;
  httpStatus?: number;
  /** Why it was rejected (HTML soft-404, empty...) or a note on the fetch. */
  note?: string;
}

export interface SitemapInfo {
  found: boolean;
  url?: string;
  via?: "robots.txt" | "/sitemap.xml" | "/sitemap_index.xml";
}

/** Everything the checks need. Built by runAudit; tests build it directly with fixtures. */
export interface AuditContext {
  page: ParsedPage;
  /** Response headers of the audited page, lower-cased keys. */
  headers: Record<string, string>;
  redirects: string[];
  /** True when the page body hit the byte cap, so text near the end was never seen. */
  truncated: boolean;
  robots: RobotsInfo;
  bots: BotVerdict[];
  llms: LlmsInfo;
  sitemap: SitemapInfo;
}

export function originOf(ctx: AuditContext): string {
  return ctx.page.url.origin;
}
