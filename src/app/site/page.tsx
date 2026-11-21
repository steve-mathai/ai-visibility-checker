import type { Metadata } from "next";
import { Suspense } from "react";
import { Column } from "@/components/report/Column";
import { ReportFrame } from "@/components/report/ReportFrame";
import { SiteClient } from "@/components/site/SiteClient";

export const metadata: Metadata = {
  title: "Whole-site audit",
  robots: { index: false, follow: true },
};

function Fallback() {
  return (
    <ReportFrame>
      <Column className="py-16">
        <p role="status" aria-live="polite" className="mx-auto max-w-xl text-center text-sm text-muted">
          Loading site audit…
        </p>
      </Column>
    </ReportFrame>
  );
}

// The client component reads the query string, so it sits inside <Suspense> (cacheComponents).
export default function SitePage() {
  return (
    <Suspense fallback={<Fallback />}>
      <SiteClient />
    </Suspense>
  );
}
