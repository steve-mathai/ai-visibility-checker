import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// CSP trade-off: this app is statically prerendered (cacheComponents), and a per-request nonce would force
// every page to render dynamically. Next's own inline bootstrap scripts on static pages therefore need
// 'unsafe-inline' in script-src; everything else is locked to same-origin. 'unsafe-eval' is added only for
// the development server (React dev tooling) and never ships to production. Styles allow inline because
// Next injects style tags, plus the Fontshare stylesheet the layout loads; fonts come from its CDN.
// Analytics hosts are allowed only when the matching provider is chosen at build time. The Vercel script
// is served from this origin, so it needs no extra entry.
const analyticsHost = process.env.NEXT_PUBLIC_ANALYTICS === "plausible" ? " https://plausible.io" : "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${analyticsHost}${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
  "font-src 'self' https://cdn.fontshare.com data:",
  "img-src 'self' data: blob:",
  `connect-src 'self'${analyticsHost}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Upgrading on http://localhost breaks the dev server in some browsers, so production only.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = (referrer: string) => [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: referrer },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [
      // Every route except /report gets the standard referrer policy; /report sends none, because the
      // address of a report can carry the audited URL.
      { source: "/((?!report).*)", headers: securityHeaders("strict-origin-when-cross-origin") },
      { source: "/report", headers: securityHeaders("no-referrer") },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Tailwind runs on global CSS only. Without the condition, `as: "*.css"` also
      // rewrites *.module.css into plain CSS and every module class comes back undefined.
      "*.css": {
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
