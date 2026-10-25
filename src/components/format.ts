import type { Effort, Impact } from "@/lib/audit/types";

export type Tone = "pass" | "warn" | "fail";

export function scoreTone(score: number): Tone {
  if (score >= 75) return "pass";
  if (score >= 50) return "warn";
  return "fail";
}

/** Static class strings so Tailwind can see them. */
export const TONE_CLASSES: Record<
  Tone,
  { text: string; bg: string; soft: string; border: string }
> = {
  pass: {
    text: "text-pass",
    bg: "bg-pass",
    soft: "bg-pass-soft",
    border: "border-pass/40",
  },
  warn: {
    text: "text-warn",
    bg: "bg-warn",
    soft: "bg-warn-soft",
    border: "border-warn/40",
  },
  fail: {
    text: "text-fail",
    bg: "bg-fail",
    soft: "bg-fail-soft",
    border: "border-fail/40",
  },
};

export const IMPACT_LABEL: Record<Impact, string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};

export const EFFORT_LABEL: Record<Effort, string> = {
  quick: "Quick win",
  moderate: "Moderate effort",
  involved: "Involved",
};

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Deterministic (UTC) so server and client render the same text. */
export function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${date}, ${time} UTC`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export type UrlCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; message: string };

/** Accepts "example.com", "www.example.com/path" or a full http(s) URL. */
export function normaliseUrl(raw: string): UrlCheck {
  const text = raw.trim();
  if (!text) {
    return { ok: false, message: "Enter a web address, for example example.com." };
  }
  if (/\s/.test(text)) {
    return { ok: false, message: "Web addresses can't contain spaces." };
  }
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  const candidate = hasScheme ? text : `https://${text}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      ok: false,
      message: "That doesn't look like a web address. Try something like example.com.",
    };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, message: "Only http and https addresses can be checked." };
  }
  const host = parsed.hostname;
  const looksLikeIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const hasTld = /\.[a-z0-9-]{2,}$/i.test(host) && !/\.\d+$/.test(host);
  if (!looksLikeIp && !hasTld) {
    return {
      ok: false,
      message: "That doesn't look like a web address. Try something like example.com.",
    };
  }
  const plainRoot =
    parsed.pathname === "/" && !parsed.search && !parsed.hash;
  return {
    ok: true,
    url: plainRoot ? parsed.origin : parsed.href,
    host: host.replace(/^www\./, ""),
  };
}
