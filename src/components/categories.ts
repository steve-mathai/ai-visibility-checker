import type { CategoryId } from "@/lib/audit/types";

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  /** Weight as a whole percentage, for display. */
  weightPct: number;
  summary: string;
  examples: string[];
}

/** Display order on the landing page. Weights mirror the engine's weighting. */
export const CATEGORIES: CategoryInfo[] = [
  {
    id: "crawlability",
    label: "Crawlability",
    weightPct: 30,
    summary: "Can AI crawlers reach the page and read what is on it?",
    examples: [
      "robots.txt rules for GPTBot, PerplexityBot, ClaudeBot and 11 more",
      "noindex tags and X-Robots-Tag headers that hide the page",
      "Whether the text is in the HTML or only appears after JavaScript runs",
    ],
  },
  {
    id: "structured-data",
    label: "Structured data",
    weightPct: 20,
    summary: "Does the page describe itself in a form machines can read?",
    examples: [
      "JSON-LD types such as Organization, LocalBusiness, Article and FAQPage",
      "Whether the markup parses and carries the fields engines look for",
      "sameAs links that tie the brand to its official profiles",
    ],
  },
  {
    id: "content",
    label: "Content structure",
    weightPct: 25,
    summary: "Is the page easy to quote in an answer?",
    examples: [
      "One clear H1 and headings that follow a logical order",
      "A direct answer near the top, and headings phrased as questions",
      "Enough substance, with lists and tables where they help",
    ],
  },
  {
    id: "entity",
    label: "Entity and local signals",
    weightPct: 10,
    summary: "Is it clear who is behind the page and where they operate?",
    examples: [
      "Business name used consistently in the title, Open Graph tags and markup",
      "Phone number and address that agree between the page and the markup",
      "Linked About and Contact pages, and a named author on articles",
    ],
  },
  {
    id: "meta",
    label: "Meta",
    weightPct: 15,
    summary: "Do the basics that engines use as labels hold up?",
    examples: [
      "Title tag present, specific and a sensible length",
      "Meta description that summarises the page",
      "Canonical URL, Open Graph tags and a declared page language",
    ],
  },
];

/** Landing-page order differs from weight order; this is by weight, high to low. */
export const WEIGHTS_BY_SIZE: { label: string; pct: number }[] = [
  { label: "Crawlability", pct: 30 },
  { label: "Content", pct: 25 },
  { label: "Structured data", pct: 20 },
  { label: "Meta", pct: 15 },
  { label: "Entity", pct: 10 },
];

const LABELS: Record<CategoryId, string> = {
  crawlability: "Crawlability",
  "structured-data": "Structured data",
  content: "Content structure",
  entity: "Entity and local signals",
  meta: "Meta",
};

export function categoryLabel(id: CategoryId): string {
  return LABELS[id] ?? id;
}
