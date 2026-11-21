import Script from "next/script";

const PLAUSIBLE_STUB =
  "window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}";
const VERCEL_STUB =
  "window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}";

/** Loads the chosen analytics script. Renders nothing unless NEXT_PUBLIC_ANALYTICS is set. */
export function Analytics() {
  const provider = process.env.NEXT_PUBLIC_ANALYTICS;
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;

  if (provider === "plausible" && domain) {
    return (
      <>
        <Script id="plausible-stub" strategy="afterInteractive">
          {PLAUSIBLE_STUB}
        </Script>
        <Script
          defer
          data-domain={domain}
          src="https://plausible.io/js/script.tagged-events.js"
          strategy="afterInteractive"
        />
      </>
    );
  }

  if (provider === "vercel") {
    return (
      <>
        <Script id="vercel-analytics-stub" strategy="afterInteractive">
          {VERCEL_STUB}
        </Script>
        <Script defer src="/_vercel/insights/script.js" strategy="afterInteractive" />
      </>
    );
  }

  return null;
}
