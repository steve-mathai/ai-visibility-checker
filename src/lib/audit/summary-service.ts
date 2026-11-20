import { createHash } from "node:crypto";
import { getStore, type Store } from "../store";
import { summarySlots, type Semaphore } from "./concurrency";
import { buildDigest, generateSummary, normalisedCacheUrl, parseReportInput, summaryResultSchema, type SummaryClient, NO_KEY_REASON } from "./summary";
import { verifySummaryToken, TOKEN_MAX_AGE_MS } from "./token";
import type { AiSummary, AiSummaryResponse } from "./types";

const off = (reason: string): AiSummaryResponse => ({ enabled: false, reason });

export const UNVERIFIED_REASON = "This report could not be verified. Run the check again.";
export const BUDGET_REASON = "The AI summary has hit today's limit. The rule-based results are complete.";
export const BUSY_REASON = "The AI summary is busy right now. Try again in a moment.";

export const DEFAULT_DAILY_LIMIT = 300;

export interface SummaryDeps {
  store?: Store;
  client?: SummaryClient;
  slots?: Semaphore;
  now?: () => number;
  /** Overrides SUMMARY_DAILY_LIMIT. */
  dailyLimit?: number;
}

export function dailyLimit(): number {
  const n = Number.parseInt(process.env.SUMMARY_DAILY_LIMIT ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_LIMIT;
}

export const cacheKeyFor = (url: string) => `summary:v1:${createHash("sha256").update(url).digest("hex")}`;

/**
 * Verify the report, then serve the per-URL 24 h cache or call the model. The token may sit at the top
 * level of the body (`token`) or inside the report (`report.summaryToken`, which is what the existing
 * client posts back unchanged). Never throws; always answers with an AiSummaryResponse.
 */
export async function summariseVerified(body: unknown, deps: SummaryDeps = {}): Promise<AiSummaryResponse> {
  if (!deps.client && !process.env.ANTHROPIC_API_KEY) return off(NO_KEY_REASON);
  const now = deps.now ?? Date.now;
  const raw = typeof body === "object" && body !== null ? (body as { report?: unknown; token?: unknown }) : {};
  const report = parseReportInput(raw.report);
  if (!report) return off(UNVERIFIED_REASON);
  const token = typeof raw.token === "string" ? raw.token : (raw.report as { summaryToken?: unknown }).summaryToken;
  if (!verifySummaryToken(buildDigest(report), token, now())) return off(UNVERIFIED_REASON);

  const store = deps.store ?? getStore();
  const cacheKey = cacheKeyFor(normalisedCacheUrl(report));

  try {
    const cached = await store.get(cacheKey);
    if (cached) {
      const parsed = summaryResultSchema.safeParse(JSON.parse(cached));
      const model = (JSON.parse(cached) as { model?: unknown }).model;
      if (parsed.success && typeof model === "string") {
        // A hit costs nothing: no model call and no daily-budget use.
        return { enabled: true, result: { ...parsed.data, model } };
      }
    }
  } catch {
    /* unreadable cache entry: fall through and regenerate */
  }

  const release = (deps.slots ?? summarySlots).tryAcquire();
  if (!release) return off(BUSY_REASON);
  try {
    const used = await store.incrementWindow(`summary-budget:${new Date(now()).toISOString().slice(0, 10)}`, 25 * 60 * 60 * 1000);
    if (used > (deps.dailyLimit ?? dailyLimit())) return off(BUDGET_REASON);

    const response = await generateSummary(report, deps.client);
    if (response.enabled) {
      const result: AiSummary = response.result;
      try {
        await store.set(cacheKey, JSON.stringify(result), TOKEN_MAX_AGE_MS);
      } catch {
        /* caching is best effort */
      }
    }
    return response;
  } finally {
    release();
  }
}
