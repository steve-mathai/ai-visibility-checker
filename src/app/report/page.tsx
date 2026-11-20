import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { hostForCard, OG_FALLBACK_HOST } from "@/app/api/og/host";
import { Column } from "@/components/report/Column";
import { ReportClient } from "@/components/report/ReportClient";
import { ReportFrame } from "@/components/report/ReportFrame";

// Reading the query string is request-time data under cacheComponents, so the
// client component that does it sits inside <Suspense>. The tab title is
// refined client-side to "... for <host>" once the address is known.
//
// The share card is per report: /api/og draws the audited hostname and the
// words "AI visibility report". It never carries a score.
export async function generateMetadata({
  searchParams,
}: PageProps<"/report">): Promise<Metadata> {
  const sp = await searchParams;
  const demo = sp.demo === "1";
  const raw = Array.isArray(sp.url) ? sp.url[0] : sp.url;
  const host = demo ? "brightsidedental.example" : hostForCard(raw);
  const known = host !== OG_FALLBACK_HOST;
  const title = known ? `AI visibility report for ${host}` : "AI visibility report";
  const image = {
    url: `/api/og?url=${encodeURIComponent(known ? host : "")}`,
    width: 1200,
    height: 630,
    alt: known ? `AI visibility report for ${host}` : "AI visibility report",
  };
  return {
    title: "AI visibility report",
    robots: { index: false, follow: true },
    openGraph: { type: "website", title, images: [image] },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

// Metadata reads searchParams, so tell Next the dynamic part is intentional.
async function Connection() {
  await connection();
  return null;
}

function ReportFallback() {
  return (
    <ReportFrame>
      <Column className="py-16">
        <p
          role="status"
          aria-live="polite"
          className="mx-auto max-w-xl text-center text-sm text-muted"
        >
          Loading report…
        </p>
      </Column>
    </ReportFrame>
  );
}

export default function ReportPage() {
  return (
    <>
      <Suspense fallback={<ReportFallback />}>
        <ReportClient />
      </Suspense>
      <Suspense>
        <Connection />
      </Suspense>
    </>
  );
}
