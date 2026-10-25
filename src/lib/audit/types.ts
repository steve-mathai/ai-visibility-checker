// Shared contract between the audit engine (server) and the report UI (client).
// Keep this file free of runtime imports so both sides can use it.

export type CategoryId =
  | "crawlability"
  | "structured-data"
  | "content"
  | "entity"
  | "meta";

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export type Impact = "high" | "medium" | "low";

export type Effort = "quick" | "moderate" | "involved";

export interface CheckResult {
  /** Stable id, e.g. "robots-answer-bots". */
  id: string;
  category: CategoryId;
  /** Short label shown in the checklist, e.g. "AI answer bots can crawl the page". */
  title: string;
  status: CheckStatus;
  /** Points earned and available. "info" checks use maxPoints 0. */
  points: number;
  maxPoints: number;
  /** One sentence on what we found, written for a marketer. */
  summary: string;
  /** Raw evidence (header values, schema types, bot verdicts...). Shown in a collapsible. */
  evidence?: string[];
  /** Present when status is warn or fail. */
  fix?: Fix;
}

export interface Fix {
  /** Imperative headline, e.g. "Allow OAI-SearchBot and PerplexityBot in robots.txt". */
  title: string;
  /** Why this matters for AI answer engines, 1-2 sentences. */
  why: string;
  /** Concrete steps or a paste-ready snippet (robots.txt lines, JSON-LD...). */
  how: string;
  /** Optional code snippet rendered in a <pre>. */
  snippet?: string;
  impact: Impact;
  effort: Effort;
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  /** Weight in the overall score, 0..1, all weights sum to 1. */
  weight: number;
  /** 0..100 */
  score: number;
  checks: CheckResult[];
}

export interface BotVerdict {
  bot: string;
  /** Who runs it, e.g. "OpenAI". */
  operator: string;
  /** "answer" = fetches pages to cite in live answers; "training" = model training crawl. */
  purpose: "answer" | "training" | "search";
  allowed: boolean;
  /** The robots.txt rule that decided it, or "no matching rule". */
  rule: string;
}

export interface PrioritisedFix extends Fix {
  checkId: string;
  category: CategoryId;
  /** Points recoverable on the category score if fixed. */
  pointsAvailable: number;
  /** Higher = do first. */
  priority: number;
}

export interface PageFacts {
  finalUrl: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  headings: { level: number; text: string }[];
  wordCount: number;
  /** First ~1500 chars of readable body text, for the AI summary. */
  textExcerpt: string;
  schemaTypes: string[];
  businessName: string | null;
  lang: string | null;
}

export interface AuditReport {
  url: string;
  fetchedAt: string;
  /** 0..100 */
  overallScore: number;
  /** "A".."F" */
  grade: string;
  /** One-line verdict, e.g. "Hard for AI engines to cite: crawlers are blocked". */
  verdict: string;
  /** Set when a blocking issue caps the overall score (e.g. noindex). */
  cappedBy?: string;
  categories: CategoryScore[];
  fixes: PrioritisedFix[];
  bots: BotVerdict[];
  page: PageFacts;
  /** Non-fatal problems while auditing (robots.txt timed out, etc.). */
  warnings: string[];
  durationMs: number;
}

export interface AuditError {
  error: string;
  /** Machine-readable code for the UI, e.g. "invalid_url", "blocked_host", "fetch_failed", "not_html". */
  code: string;
}

export interface AiRewrite {
  kind: "title" | "meta_description" | "h1" | "answer_paragraph" | "faq";
  current: string | null;
  suggested: string;
  why: string;
}

export interface AiSummary {
  summary: string;
  topActions: string[];
  rewrites: AiRewrite[];
  model: string;
}

export type AiSummaryResponse =
  | { enabled: true; result: AiSummary }
  | { enabled: false; reason: string };
