import type { BotVerdict, CategoryId } from "@/lib/audit/types";

/** Short names for tabs, chart rows and fix categories. */
const SHORT_LABEL: Record<CategoryId, string> = {
  crawlability: "Crawlability",
  content: "Content",
  "structured-data": "Structured data",
  meta: "Meta",
  entity: "Entity",
};

export function shortLabel(id: CategoryId): string {
  return SHORT_LABEL[id] ?? id;
}

export const PURPOSE_ORDER: Record<BotVerdict["purpose"], number> = {
  answer: 0,
  search: 1,
  training: 2,
};

export const PURPOSE_LABEL: Record<BotVerdict["purpose"], string> = {
  answer: "Answer",
  search: "Search",
  training: "Training",
};

/** Anchor ids shared between the charts, the tabs and the fix list. */
export const CHECKS_ID = "checks";
export const FIXES_ID = "fixes";

export function checksHash(id: CategoryId): string {
  return `checks-${id}`;
}

export function fixDomId(checkId: string): string {
  return `fix-${checkId}`;
}
