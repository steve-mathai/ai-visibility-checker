import { SITE } from "../site";

/** The same footer block the report ends with. The copyright line comes from ReportFrame. */
export function WideFooter({ note }: { note: string }) {
  return (
    <footer className="mt-8 flex flex-col gap-1 text-[13px] text-muted sm:flex-row sm:justify-between sm:gap-6">
      <p className="max-w-[72ch]">{note}</p>
      <p className="shrink-0">Built by {SITE.author}</p>
    </footer>
  );
}
