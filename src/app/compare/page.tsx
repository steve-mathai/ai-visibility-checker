import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareClient } from "@/components/compare/CompareClient";
import { Column } from "@/components/report/Column";
import { ReportFrame } from "@/components/report/ReportFrame";

export const metadata: Metadata = {
  title: "Compare sites",
  robots: { index: false, follow: true },
};

function Fallback() {
  return (
    <ReportFrame>
      <Column className="py-16">
        <p role="status" aria-live="polite" className="mx-auto max-w-xl text-center text-sm text-muted">
          Loading comparison…
        </p>
      </Column>
    </ReportFrame>
  );
}

// The client component reads the query string, so it sits inside <Suspense> (cacheComponents).
export default function ComparePage() {
  return (
    <Suspense fallback={<Fallback />}>
      <CompareClient />
    </Suspense>
  );
}
