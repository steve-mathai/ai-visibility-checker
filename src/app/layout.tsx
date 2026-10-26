import type { Metadata, Viewport } from "next";
import { SITE } from "@/components/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI Visibility Checker: can AI engines cite your page?",
    template: "%s · AI Visibility Checker",
  },
  description: SITE.description,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: "AI Visibility Checker: can AI engines cite your page?",
    description: SITE.description,
  },
  twitter: {
    card: "summary",
    title: "AI Visibility Checker: can AI engines cite your page?",
    description: SITE.description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e171b" },
  ],
};

// Each page renders its own frame: the landing page has a plain nav and a tile
// footer, the report has a viewer bar. Only the skip link and <main> are shared.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@400,500,600&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
        >
          Skip to content
        </a>
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
