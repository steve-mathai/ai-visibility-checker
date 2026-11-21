"use client";

// Client component: it hands an onCopied callback to CopyButton, and ReportFrame (which renders it)
// is also used from server pages, where a function prop could not cross the boundary.
import Link from "next/link";
import { BrandLogo } from "../Brand";
import { track } from "@/lib/analytics";
import { CopyButton } from "../CopyButton";
import { Column } from "./Column";

/** 48px bar with a 1px rule: wordmark left, two small secondary actions right. */
export function ViewerBar({ showShare }: { showShare: boolean }) {
  return (
    <header className="h-12 border-b border-line bg-canvas print:hidden">
      <Column className="flex h-full items-center justify-between gap-3">
        <Link
          href="/"
          translate="no"
          aria-label="AI Visibility Checker home"
          className="flex min-w-0 items-center gap-2.5 rounded font-semibold tracking-tight"
        >
          <BrandLogo markClass="size-6" textClass="truncate text-[13px] sm:text-[15px]" />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {showShare && (
            <CopyButton
              text={() => window.location.href}
              label="Copy share link"
              copiedLabel="Link copied"
              compact
              onCopied={() => track("share_link_copied")}
            />
          )}
          <Link href="/#check" className="btn btn-secondary btn-sm">
            Run another check
          </Link>
        </div>
      </Column>
    </header>
  );
}
