export type AnalyticsEvent =
  | "audit_started"
  | "audit_finished"
  | "fix_snippet_copied"
  | "share_link_copied"
  | "email_submitted";

export type AnalyticsProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: AnalyticsProps }) => void;
    va?: (kind: "event", payload: { name: string; data?: AnalyticsProps }) => void;
  }
}

const MAX_STRING_LENGTH = 100;

/** Reduces a string to something safe to send, or null when it must be dropped. */
function cleanString(value: string): string | null {
  // Anything with an @ could be an email address.
  if (value.includes("@")) return null;
  // A URL or anything with a query string or fragment becomes its bare hostname.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /[?#]/.test(value)) {
    try {
      return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`).hostname || null;
    } catch {
      return null;
    }
  }
  return value.slice(0, MAX_STRING_LENGTH);
}

/** Keeps only primitive values that carry no email address, path, query string or fragment. */
export function sanitiseProps(props?: AnalyticsProps): AnalyticsProps | undefined {
  if (!props) return undefined;
  const clean: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (/e-?mail/i.test(key)) continue;
    if (typeof value === "string") {
      const cleaned = cleanString(value);
      if (cleaned) clean[key] = cleaned;
    } else if (typeof value === "number" ? Number.isFinite(value) : typeof value === "boolean") {
      clean[key] = value;
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

/**
 * Records one event with the configured provider. Does nothing unless NEXT_PUBLIC_ANALYTICS is
 * "plausible" or "vercel", and never throws, so a blocked or missing script cannot break the app.
 */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  try {
    const provider = process.env.NEXT_PUBLIC_ANALYTICS;
    const data = sanitiseProps(props);
    if (provider === "plausible") {
      window.plausible?.(event, data ? { props: data } : undefined);
    } else if (provider === "vercel") {
      window.va?.("event", data ? { name: event, data } : { name: event });
    } else if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", event, data ?? {});
    }
  } catch {
    // Analytics must never affect the app.
  }
}
