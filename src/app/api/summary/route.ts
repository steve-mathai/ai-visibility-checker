import { generateSummary, parseReportInput } from "@/lib/audit/summary";
import { clientKey, rateLimit } from "@/lib/audit/ratelimit";
import type { AiSummaryResponse } from "@/lib/audit/types";

// POST handlers are never cached or prerendered under cacheComponents.
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

// This route always answers 200 so the UI can fall back to the rule-based results.
function reply(body: AiSummaryResponse) {
  return Response.json(body, { status: 200, headers: NO_STORE });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ enabled: false, reason: "The AI summary request was not valid JSON." });
  }
  const report = parseReportInput(typeof body === "object" && body !== null ? (body as { report?: unknown }).report : undefined);
  if (!report) {
    return reply({ enabled: false, reason: "The AI summary request did not include a valid audit report." });
  }

  // Only rate-limit when the call would actually cost money.
  if (process.env.ANTHROPIC_API_KEY) {
    const limit = rateLimit(clientKey(request, "summary"), 12, 10 * 60 * 1000);
    if (!limit.ok) {
      return reply({ enabled: false, reason: "Too many AI summaries requested. Please wait a few minutes and try again." });
    }
  }

  try {
    return reply(await generateSummary(report));
  } catch (err) {
    console.error("summary failed", err);
    return reply({ enabled: false, reason: "The AI summary could not be generated right now." });
  }
}
