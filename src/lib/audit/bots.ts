import type { BotVerdict } from "./types";
import { evaluate, parseRobots, type ParsedRobots } from "./robots";

export interface BotDef {
  bot: string;
  operator: string;
  purpose: BotVerdict["purpose"];
  /** One plain-English line about what the bot does. */
  note: string;
}

export const BOTS: BotDef[] = [
  // Answer / live-retrieval bots: fetch pages to cite them in an answer.
  { bot: "OAI-SearchBot", operator: "OpenAI", purpose: "answer", note: "Builds the index behind ChatGPT search results." },
  { bot: "ChatGPT-User", operator: "OpenAI", purpose: "answer", note: "Fetches a page when a ChatGPT user asks about it." },
  { bot: "PerplexityBot", operator: "Perplexity", purpose: "answer", note: "Builds Perplexity's search index." },
  { bot: "Perplexity-User", operator: "Perplexity", purpose: "answer", note: "Fetches a page when a Perplexity user asks about it." },
  { bot: "Claude-SearchBot", operator: "Anthropic", purpose: "answer", note: "Builds the index behind Claude's search results." },
  { bot: "Claude-User", operator: "Anthropic", purpose: "answer", note: "Fetches a page when a Claude user asks about it." },
  // Search bots that feed AI answers indirectly.
  { bot: "Googlebot", operator: "Google", purpose: "search", note: "Google Search crawler; also powers AI Overviews and AI Mode." },
  { bot: "Bingbot", operator: "Microsoft", purpose: "search", note: "Bing crawler; feeds Copilot and ChatGPT search." },
  // Training crawlers.
  { bot: "GPTBot", operator: "OpenAI", purpose: "training", note: "Collects content for training OpenAI models." },
  { bot: "ClaudeBot", operator: "Anthropic", purpose: "training", note: "Collects content for training Anthropic models." },
  { bot: "Google-Extended", operator: "Google", purpose: "training", note: "Opt-out token for Gemini training and grounding. Does not affect Search or AI Overviews." },
  { bot: "Applebot-Extended", operator: "Apple", purpose: "training", note: "Opt-out token for Apple's AI training." },
  { bot: "CCBot", operator: "Common Crawl", purpose: "training", note: "Common Crawl's open dataset, widely used for AI training." },
  { bot: "meta-externalagent", operator: "Meta", purpose: "training", note: "Meta's crawler for AI training data." },
];

export function botDef(name: string): BotDef | undefined {
  return BOTS.find((b) => b.bot === name);
}

/** Evaluate every bot against `path`. `robots` null/undefined means no robots.txt: everything allowed. */
export function evaluateBots(
  robots: string | ParsedRobots | null | undefined,
  path: string,
): BotVerdict[] {
  const parsed = typeof robots === "string" ? parseRobots(robots) : robots ?? null;
  return BOTS.map((def) => {
    if (!parsed) {
      return {
        bot: def.bot,
        operator: def.operator,
        purpose: def.purpose,
        allowed: true,
        rule: "no matching rule",
      };
    }
    const d = evaluate(parsed, def.bot, path);
    return { bot: def.bot, operator: def.operator, purpose: def.purpose, allowed: d.allowed, rule: d.rule };
  });
}
