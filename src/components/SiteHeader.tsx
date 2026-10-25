import Link from "next/link";
import { Container } from "./Container";
import { LogoMark } from "./Icons";
import { SITE } from "./site";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface/80">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight"
        >
          <LogoMark />
          <span>{SITE.name}</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
          <Link
            href="/#how-it-works"
            className="hidden rounded-lg px-3 py-2 text-muted hover:text-fg sm:inline-block"
          >
            How it works
          </Link>
          <Link
            href="/report?demo=1"
            className="rounded-lg px-3 py-2 text-muted hover:text-fg"
          >
            Sample report
          </Link>
        </nav>
      </Container>
    </header>
  );
}
