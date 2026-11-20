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

/** True only for an absolute http(s) address. Guards every href built from report data. */
export function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const FETCHED_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

const INTEGER_FORMAT = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

const SECONDS_FORMAT = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Deterministic (UTC) so server and client render the same text: "25 Oct 2026, 19:16 UTC". */
export function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts: Record<string, string> = {};
  for (const part of FETCHED_FORMAT.formatToParts(d)) {
    parts[part.type] = part.value;
  }
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} UTC`;
}

/** "850 ms" below a second, "4.4 s" above. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${INTEGER_FORMAT.format(ms)} ms`;
  return `${SECONDS_FORMAT.format(ms / 1000)} s`;
}

/** Whole number with locale separators: 1,204. */
export function formatNumber(value: number): string {
  return INTEGER_FORMAT.format(value);
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
