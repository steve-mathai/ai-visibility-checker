import { clientKey, rateLimit } from "@/lib/audit/ratelimit";
import { summariseVerified } from "@/lib/audit/summary-service";
import type { AiSummaryResponse } from "@/lib/audit/types";
import { isJsonContentType, readTextCapped } from "@/lib/http";

// POST handlers are never cached or prerendered under cacheComponents.
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 128 * 1024;

// This route always answers 200 so the UI can fall back to the rule-based results.
function reply(body: AiSummaryResponse) {
  return Response.json(body, { status: 200, headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!isJsonContentType(request)) {
    return reply({ enabled: false, reason: "The AI summary request was not valid JSON." });
  }
  const text = await readTextCapped(request, MAX_BODY_BYTES).catch(() => null);
  if (text === null) {
    return reply({ enabled: false, reason: "The AI summary request was too large." });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply({ enabled: false, reason: "The AI summary request was not valid JSON." });
  }

  // Only rate-limit when the call would actually cost money.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const limit = await rateLimit(clientKey(request, "summary"), 12, 10 * 60 * 1000);
      if (!limit.ok) {
        return reply({ enabled: false, reason: "Too many AI summaries requested. Please wait a few minutes and try again." });
      }
    } catch {
      return reply({ enabled: false, reason: "The AI summary is unavailable right now." });
    }
  }

  try {
    return reply(await summariseVerified(body));
  } catch (err) {
    console.error("summary failed:", err instanceof Error ? err.name : "unknown error");
    return reply({ enabled: false, reason: "The AI summary could not be generated right now." });
  }
}
