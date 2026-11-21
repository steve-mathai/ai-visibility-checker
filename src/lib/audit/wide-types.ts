// Contract for the compare and site-audit routes. Like types.ts, no runtime imports so the client can use it.
import type { AuditReport, CategoryId, CheckStatus, Effort, Impact } from "./types";

export type CompareItem =
  | { url: string; ok: true; report: AuditReport }
  | { url: string; ok: false; error: string; code: string };

export interface CompareResponse {
  results: CompareItem[];
}

export interface TemplateSummary {
  /** Page type such as "/blog/*"; see templateOf in sample.ts. */
  template: string;
  pages: number;
  averageScore: number;
}

/** How one check came out across the sampled pages, and where the problem sits. */
export interface CheckPattern {
  checkId: string;
  title: string;
  category: CategoryId;
  /** Worst status seen, "fail" or "warn". */
  worst: Extract<CheckStatus, "warn" | "fail">;
  failing: number;
  warning: number;
  /** Only page types with at least one failing or warning page. */
  byTemplate: { template: string; pages: number; failing: number; warning: number }[];
}

export interface SiteFix {
  checkId: string;
  title: string;
  category: CategoryId;
  why: string;
  how: string;
  impact: Impact;
  effort: Effort;
  /** Sampled pages where this check fails or warns. */
  pagesAffected: number;
}

export interface SitePage {
  url: string;
  template: string;
  score: number;
  grade: string;
}

export interface SiteReport {
  url: string;
  host: string;
  fetchedAt: string;
  durationMs: number;
  /** Pages picked from the sitemap, and how many of them produced a score. */
  sampled: number;
  audited: number;
  failedPages: { url: string; code: string }[];
  /** True when the time limit ended the run before every sampled page was checked. */
  partial: boolean;
  sitemapFound: boolean;
  averageScore: number;
  grade: string;
  templates: TemplateSummary[];
  patterns: CheckPattern[];
  topFixes: SiteFix[];
  pages: SitePage[];
  notes: string[];
}

export interface SiteError {
  error: string;
  code: string;
}
