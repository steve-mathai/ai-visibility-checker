import { SAMPLE_REPORT } from "@/dev/sample-report";
import type { Effort, Impact } from "@/lib/audit/types";

/** Everything the landing fragments show comes from the engine's own sample output. */
export const REPORT = SAMPLE_REPORT;

export type Tone = "pass" | "warn" | "fail";

export function toneOf(score: number): Tone {
  if (score >= 75) return "pass";
  if (score >= 50) return "warn";
  return "fail";
}

export const IMPACT: Record<Impact, string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};

export const EFFORT: Record<Effort, string> = {
  quick: "Quick win",
  moderate: "Moderate effort",
  involved: "Involved",
};

export const SAMPLE_HOST = new URL(REPORT.url).hostname;

/** Fixed UTC formatting so the server and the browser print the same text. */
export function fetchedLine(): string {
  const d = new Date(REPORT.fetchedAt);
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
  return `Fetched ${date}, ${time} UTC`;
}

export function checkedIn(): string {
  return `Checked in ${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(REPORT.durationMs / 1000)} s`;
}

/** The three crawlers shown in the hero crop. */
export const HERO_BOTS = ["OAI-SearchBot", "PerplexityBot", "GPTBot"].map(
  (name) => {
    const bot = REPORT.bots.find((b) => b.bot === name);
    if (!bot) throw new Error(`Sample report has no bot ${name}`);
    return bot;
  },
);

export const PURPOSE_LABEL = {
  answer: "Answer",
  search: "Search",
  training: "Training",
} as const;

/** Category rows for how-it-works state B, in the order the brief gives. */
const SHORT_LABEL: Record<string, string> = {
  crawlability: "Crawlability",
  "structured-data": "Structured data",
  content: "Content",
  entity: "Entity",
  meta: "Meta",
};
export const CATEGORY_ROWS = [
  "crawlability",
  "structured-data",
  "content",
  "entity",
  "meta",
].map((id) => {
  const c = REPORT.categories.find((x) => x.id === id);
  if (!c) throw new Error(`Sample report has no category ${id}`);
  return { id, label: SHORT_LABEL[id], score: c.score };
});

export const TOP_FIX = REPORT.fixes[0];

/** The first three rows of the report's "Fix these first" list. */
export const FIX_ROWS = REPORT.fixes.slice(0, 3);

/** The first before-and-after pair in the top fix's own instructions. */
const pair = /"([^"]+)" becomes "([^"]+)"/.exec(TOP_FIX.how);
export const TOP_FIX_EXAMPLE = {
  from: pair?.[1] ?? "Our services",
  to: pair?.[2] ?? TOP_FIX.title,
};

/** Proof board. Do not change without re-running the checks (docs/memory.md). */
export interface ProofTile {
  /** Short label shown on the tile. */
  path: string;
  /** The exact page that was checked; the tile re-runs the check on it. */
  url: string;
  score: number;
  grade: string;
  line: string;
  capped?: boolean;
}
// Six results plus the double-width heading tile fill two rows of four.
export const PROOF: ProofTile[] = [
  { path: "zapier.com/blog", url: "zapier.com/blog/get-started-with-zapier/", score: 95, grade: "A", line: "Everything in place, llms.txt too." },
  { path: "ahrefs.com/blog", url: "ahrefs.com/blog/what-is-seo/", score: 90, grade: "A", line: "Full schema and an FAQ." },
  { path: "bbc.com/news", url: "www.bbc.com/news", score: 68, grade: "C", line: "Blocks OpenAI’s and Perplexity’s answer bots." },
  { path: "anthropic.com", url: "www.anthropic.com", score: 63, grade: "C", line: "Easy to crawl, no structured data." },
  { path: "excalidraw.com", url: "excalidraw.com", score: 45, grade: "D", capped: true, line: "Text only appears after JavaScript runs." },
  { path: "cnn.com", url: "www.cnn.com", score: 35, grade: "F", capped: true, line: "Blocks every AI answer bot." },
];

export interface Command {
  id: string;
  name: string;
  chip: string;
  text: string;
}
export const COMMANDS: Command[] = [
  { id: "crawlers", name: "AI crawler access", chip: "30%", text: "robots.txt rules for 14 crawlers. Answer bots count, training bots are your call." },
  { id: "content", name: "Content structure", chip: "25%", text: "One H1, question headings, an FAQ and short answers straight under each heading." },
  { id: "schema", name: "Structured data", chip: "20%", text: "JSON-LD that parses, Organization or LocalBusiness, sameAs links, a page type." },
  { id: "meta", name: "Meta basics", chip: "15%", text: "Title, description, canonical, Open Graph and a declared language." },
  { id: "entity", name: "Entity signals", chip: "10%", text: "One business name everywhere, phone and address that agree, About and Contact pages." },
  { id: "caps", name: "Hard caps for blockers", chip: "cap", text: "noindex caps the score at 25, blocked answer bots at 35, a JavaScript-only page at 45." },
  { id: "fixes", name: "Ranked fixes", chip: "fix", text: "Impact × points lost × weight × effort, so the first fix is the best use of the next hour." },
  { id: "summary", name: "Plain-English summary", chip: "AI", text: "One Claude call explains the result and suggests rewrites. Off without an API key." },
];
