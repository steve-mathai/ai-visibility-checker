/** Longest hostname shown on a card; longer ones are cut with an ellipsis. */
const MAX_HOST = 42;
/** Input is never parsed past this length. */
const MAX_INPUT = 2048;

export const OG_FALLBACK_HOST = "your page";

/**
 * Turns whatever came in as ?url= into a safe label for the card: the hostname of an
 * http(s) address, or a neutral fallback. Bare domains are accepted. Anything else
 * (other schemes, empty, unparseable, control characters) falls back.
 */
export function hostForCard(raw: string | null | undefined): string {
  if (!raw) return OG_FALLBACK_HOST;
  const text = raw.trim().slice(0, MAX_INPUT);
  if (!text) return OG_FALLBACK_HOST;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  if (!hasScheme && /^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^/]*:\d+(\/|$)/.test(text)) {
    return OG_FALLBACK_HOST; // javascript:, data:, mailto: and friends
  }
  let url: URL;
  try {
    url = new URL(hasScheme ? text : `https://${text}`);
  } catch {
    return OG_FALLBACK_HOST;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return OG_FALLBACK_HOST;
  const host = url.hostname.replace(/^www\./i, "");
  if (!host || /[\u0000-\u001f\u007f]/.test(host)) return OG_FALLBACK_HOST;
  return host.length > MAX_HOST ? `${host.slice(0, MAX_HOST - 1)}…` : host;
}
