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

/** Bounds on page-controlled input: a hostile robots.txt must not make matching expensive. */
const MAX_RULES_PER_GROUP = 1000;
const MAX_PATTERN_LENGTH = 512;
const MAX_RULE_TEXT = 200;

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
      if (current && current.rules.length < MAX_RULES_PER_GROUP) {
        current.rules.push({ type: key, pattern: value.slice(0, MAX_PATTERN_LENGTH) });
      }
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

/**
 * Linear-ish wildcard matcher for RFC 9309 patterns: "*" matches any run of characters, a trailing "$"
 * anchors the end, and without "$" the pattern only has to match a prefix of the path.
 * Single-pass with one backtrack point (the most recent "*"), so it is O(pattern x path) at worst
 * and cannot blow up the way a generated regular expression can.
 */
export function matchesPattern(pattern: string, path: string): boolean {
  let p = pattern;
  const anchored = p.endsWith("$");
  if (anchored) p = p.slice(0, -1);
  let i = 0;
  let j = 0;
  let star = -1;
  let mark = 0;
  for (;;) {
    if (i === p.length) {
      if (!anchored || j === path.length) return true;
    } else if (p[i] === "*") {
      star = i++;
      mark = j;
      continue;
    } else if (j < path.length && p[i] === path[j]) {
      i++;
      j++;
      continue;
    }
    if (star < 0 || mark >= path.length) return false;
    mark++;
    j = mark;
    i = star + 1;
  }
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
      if (!matchesPattern(rule.pattern, target)) continue;
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
    rule: `${best.type === "allow" ? "Allow" : "Disallow"}: ${best.pattern}`.slice(0, MAX_RULE_TEXT),
  };
}
