// Small robots.txt parser following RFC 9309:
//  - rules are grouped by User-agent lines
//  - the most specific matching group wins (exact product token, else "*")
//  - within a group the longest matching pattern wins, Allow wins a tie
//  - "*" matches any run of characters and a trailing "$" anchors the end

export interface RobotsRule {
  type: "allow" | "disallow";
  pattern: string;
}

export interface RobotsGroup {
  agents: string[]; // lower-cased
  rules: RobotsRule[];
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
}

export interface RobotsDecision {
  allowed: boolean;
  /** The deciding rule, e.g. "Disallow: /private/", or "no matching rule". */
  rule: string;
}

export function parseRobots(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  for (const raw of lines) {
    const noComment = raw.split("#")[0].trim();
    if (!noComment) continue;
    const idx = noComment.indexOf(":");
    if (idx === -1) continue;
    const key = noComment.slice(0, idx).trim().toLowerCase();
    const value = noComment.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      if (value) current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (current) current.rules.push({ type: key, pattern: value });
    } else if (key === "sitemap") {
      if (value) sitemaps.push(value);
      // sitemap lines do not belong to a group and do not end one
    } else {
      // crawl-delay, host, etc.: ignored, but they end a run of user-agent lines
      lastWasAgent = false;
    }
  }
  return { groups, sitemaps };
}

function patternToRegExp(pattern: string): RegExp {
  let anchored = false;
  let p = pattern;
  if (p.endsWith("$")) {
    anchored = true;
    p = p.slice(0, -1);
  }
  const body = p
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

function groupsFor(parsed: ParsedRobots, token: string): RobotsGroup[] {
  const t = token.toLowerCase();
  const exact = parsed.groups.filter((g) => g.agents.includes(t));
  if (exact.length) return exact;
  return parsed.groups.filter((g) => g.agents.includes("*"));
}

/**
 * Decide whether `userAgentToken` may fetch `path` (path plus optional query).
 * Accepts raw robots.txt text or an already parsed file. Empty/missing = allowed.
 */
export function evaluate(
  robotsTxt: string | ParsedRobots | null | undefined,
  userAgentToken: string,
  path: string,
): RobotsDecision {
  const none: RobotsDecision = { allowed: true, rule: "no matching rule" };
  if (robotsTxt == null) return none;
  const parsed = typeof robotsTxt === "string" ? parseRobots(robotsTxt) : robotsTxt;
  const groups = groupsFor(parsed, userAgentToken);
  if (!groups.length) return none;

  const target = path.startsWith("/") ? path : "/" + path;
  let best: { type: "allow" | "disallow"; pattern: string } | null = null;

  for (const group of groups) {
    for (const rule of group.rules) {
      // An empty Disallow means "nothing is disallowed"; an empty Allow adds nothing.
      if (rule.pattern === "") continue;
      if (!patternToRegExp(rule.pattern).test(target)) continue;
      if (
        !best ||
        rule.pattern.length > best.pattern.length ||
        (rule.pattern.length === best.pattern.length && rule.type === "allow" && best.type === "disallow")
      ) {
        best = rule;
      }
    }
  }

  if (!best) return none;
  return {
    allowed: best.type === "allow",
    rule: `${best.type === "allow" ? "Allow" : "Disallow"}: ${best.pattern}`,
  };
}
