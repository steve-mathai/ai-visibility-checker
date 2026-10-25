import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { ReportClient } from "@/components/report/ReportClient";

// Reading the query string is request-time data under cacheComponents, so the
// client component that does it sits inside <Suspense>. The tab title is
// refined client-side to "... — <host>" once the address is known.
export const metadata: Metadata = {
  title: "AI visibility report",
  robots: { index: false, follow: true },
};

function ReportFallback() {
  return (
    <Container>
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-xl py-24 text-center text-muted"
      >
        Loading report&hellip;
      </div>
    </Container>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportFallback />}>
      <ReportClient />
    </Suspense>
  );
}
