import type { BotVerdict, CategoryId, CategoryScore, CheckResult, Effort, Impact, PrioritisedFix } from "./types";

export const CATEGORIES: { id: CategoryId; label: string; weight: number }[] = [
  { id: "crawlability", label: "Crawlability & access", weight: 0.3 },
  { id: "structured-data", label: "Structured data", weight: 0.2 },
  { id: "content", label: "Content structure", weight: 0.25 },
  { id: "entity", label: "Entity & local signals", weight: 0.1 },
  { id: "meta", label: "Meta & page basics", weight: 0.15 },
];

const IMPACT_WEIGHT: Record<Impact, number> = { high: 3, medium: 2, low: 1 };
const EFFORT_MULT: Record<Effort, number> = { quick: 1.5, moderate: 1, involved: 0.6 };

export function gradeFor(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function categoryScores(checks: CheckResult[]): CategoryScore[] {
  return CATEGORIES.map((c) => {
    const mine = checks.filter((k) => k.category === c.id);
    const scored = mine.filter((k) => k.maxPoints > 0);
    const max = scored.reduce((s, k) => s + k.maxPoints, 0);
    const earned = scored.reduce((s, k) => s + k.points, 0);
    return {
      id: c.id,
      label: c.label,
      weight: c.weight,
      score: max > 0 ? Math.round((earned / max) * 100) : 0,
      checks: mine,
    };
  });
}

export function prioritiseFixes(checks: CheckResult[]): PrioritisedFix[] {
  const weights = new Map(CATEGORIES.map((c) => [c.id, c.weight]));
  const out: PrioritisedFix[] = [];
  for (const k of checks) {
    if (!k.fix || (k.status !== "warn" && k.status !== "fail")) continue;
    const lost = k.maxPoints - k.points;
    if (lost <= 0) continue;
    const priority =
      IMPACT_WEIGHT[k.fix.impact] * lost * (weights.get(k.category) ?? 0) * EFFORT_MULT[k.fix.effort];
    out.push({
      ...k.fix,
      checkId: k.id,
      category: k.category,
      pointsAvailable: lost,
      priority: Math.round(priority * 100) / 100,
    });
  }
  return out.sort((a, b) => b.priority - a.priority || b.pointsAvailable - a.pointsAvailable);
}

export type Blocker = "noindex" | "crawlers-blocked" | "js-shell";

export interface Gate {
  blocker: Blocker;
  cap: number;
  reason: string;
}

export function findGates(checks: CheckResult[], bots: BotVerdict[]): Gate[] {
  const gates: Gate[] = [];
  const status = (id: string) => checks.find((c) => c.id === id)?.status;

  if (status("indexable") === "fail") {
    gates.push({
      blocker: "noindex",
      cap: 25,
      reason: "The page is marked noindex, which tells search and AI engines to leave it out.",
    });
  }
  const find = (name: string) => bots.find((b) => b.bot === name);
  const searchBlocked = find("Googlebot")?.allowed === false && find("Bingbot")?.allowed === false;
  const answer = bots.filter((b) => b.purpose === "answer");
  const allAnswerBlocked = answer.length > 0 && answer.every((b) => !b.allowed);
  if (searchBlocked || allAnswerBlocked) {
    gates.push({
      blocker: "crawlers-blocked",
      cap: 35,
      reason: searchBlocked
        ? "robots.txt blocks both Googlebot and Bingbot, the crawlers behind AI Overviews, Copilot and ChatGPT search."
        : "robots.txt blocks every AI answer bot.",
    });
  }
  if (status("server-rendered") === "fail") {
    gates.push({
      blocker: "js-shell",
      cap: 45,
      reason: "The page content is loaded by JavaScript, which most AI crawlers do not run.",
    });
  }
  return gates;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function buildVerdict(raw: number, grade: string, blocker: Blocker | null, fixes: PrioritisedFix[]): string {
  const wellBuilt = raw >= 70;
  if (blocker === "noindex") {
    return wellBuilt
      ? "Well structured, but the page is marked noindex, so search and AI engines are told to leave it out."
      : "The page is marked noindex, so search and AI engines are told to leave it out, and other gaps remain too.";
  }
  if (blocker === "crawlers-blocked") {
    return wellBuilt
      ? "Well structured, but robots.txt blocks the crawlers behind AI search, so the page cannot be cited."
      : "robots.txt blocks the crawlers behind AI search, so this page cannot be cited until that changes.";
  }
  if (blocker === "js-shell") {
    return wellBuilt
      ? "Well structured, but answer engines cannot see the content without running JavaScript."
      : "Answer engines cannot see the content without running JavaScript, so there is almost nothing for them to cite.";
  }
  const top = fixes[0];
  if (grade === "A") {
    return top
      ? `Strong: AI answer engines can reach, read and cite this page. The main remaining gap is minor: ${lowerFirst(top.title)}.`
      : "Strong: AI answer engines can reach, read and cite this page, and no significant gaps were found.";
  }
  const lead =
    grade === "B"
      ? "Solid foundation for AI answer engines, with a few gaps to close."
      : grade === "C"
        ? "Partly ready for AI answer engines; several gaps hold back citations."
        : grade === "D"
          ? "Hard for AI engines to cite reliably; there are significant gaps."
          : "Very hard for AI engines to find or cite this page.";
  return top ? `${lead} Start with: ${lowerFirst(top.title)}.` : lead;
}

export interface ScoreResult {
  categories: CategoryScore[];
  overallScore: number;
  grade: string;
  verdict: string;
  cappedBy?: string;
  fixes: PrioritisedFix[];
}

export function scoreChecks(checks: CheckResult[], bots: BotVerdict[]): ScoreResult {
  const categories = categoryScores(checks);
  const raw = Math.round(categories.reduce((s, c) => s + c.score * c.weight, 0));
  const gates = findGates(checks, bots);
  const lowest = gates.length ? gates.reduce((a, b) => (b.cap < a.cap ? b : a)) : null;
  const overallScore = lowest ? Math.min(raw, lowest.cap) : raw;
  const grade = gradeFor(overallScore);
  const fixes = prioritiseFixes(checks);
  const result: ScoreResult = {
    categories,
    overallScore,
    grade,
    verdict: buildVerdict(raw, grade, lowest ? lowest.blocker : null, fixes),
    fixes,
  };
  if (lowest && raw > lowest.cap) {
    result.cappedBy = `${lowest.reason} Score capped at ${lowest.cap}.`;
  }
  return result;
}
