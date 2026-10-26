import type { Metadata } from "next";
import { Suspense } from "react";
import { Column } from "@/components/report/Column";
import { ReportClient } from "@/components/report/ReportClient";
import { ReportFrame } from "@/components/report/ReportFrame";

// Reading the query string is request-time data under cacheComponents, so the
// client component that does it sits inside <Suspense>. The tab title is
// refined client-side to "... for <host>" once the address is known.
export const metadata: Metadata = {
  title: "AI visibility report",
  robots: { index: false, follow: true },
};

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
    <Suspense fallback={<ReportFallback />}>
      <ReportClient />
    </Suspense>
  );
}
