import Link from "next/link";
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
          className="min-w-0 truncate rounded text-sm font-semibold tracking-tight sm:text-[15px]"
        >
          AI Visibility Checker
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {showShare && (
            <CopyButton
              text={() => window.location.href}
              label="Copy share link"
              copiedLabel="Link copied"
              compact
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
