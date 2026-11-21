import Link from "next/link";
import type { ReactNode } from "react";
import type { CheckPattern, SiteFix, SiteReport } from "@/lib/audit/wide-types";
import { EffortBadge, ImpactBadge, Pill } from "../Badges";
import { WideFooter } from "../compare/WideFooter";
import { TONE_CLASSES, formatDuration, formatFetchedAt, isHttpUrl, scoreTone } from "../format";
import { Column } from "../report/Column";
import { ReportFrame } from "../report/ReportFrame";
import { ScoreGauge } from "../report/ScoreGauge";
import { shortLabel } from "../report/labels";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function Section({ id, title, children, hint }: { id: string; title: string; children: ReactNode; hint?: string }) {
  return (
    <section aria-labelledby={id} className="card overflow-hidden print:break-inside-avoid">
      <div className="px-5 pb-3 pt-4">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {hint && <p className="mt-1 max-w-[80ch] text-[13px] text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function FixRow({ fix, audited }: { fix: SiteFix; audited: number }) {
  return (
    <li className="border-t border-line px-5 py-3.5 first:border-t-0">
      <h3 className="break-words text-base font-semibold leading-snug">{fix.title}</h3>
      <p className="mt-1 text-[13px] tabular-nums text-muted">
        Affects {fix.pagesAffected} of {audited} pages checked
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <ImpactBadge impact={fix.impact} />
        <EffortBadge effort={fix.effort} />
        <span className="text-[13px] text-muted">{shortLabel(fix.category)}</span>
      </p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer select-none rounded text-[13px] font-medium text-accent underline underline-offset-4">What to do</summary>
        <div className="mt-2 max-w-[72ch] space-y-2">
          <p>{fix.why}</p>
          <p className="whitespace-pre-line break-words">{fix.how}</p>
        </div>
      </details>
    </li>
  );
}

function PatternRow({ pattern, audited }: { pattern: CheckPattern; audited: number }) {
  return (
    <li className="border-t border-line px-5 py-3.5 first:border-t-0 print:break-inside-avoid">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="min-w-0 break-words text-sm font-semibold">{pattern.title}</h3>
        <Pill tone={pattern.worst === "fail" ? "fail" : "warn"}>{pattern.worst === "fail" ? "Failing" : "Needs work"}</Pill>
        <span className="text-[13px] text-muted">{shortLabel(pattern.category)}</span>
      </div>
      <p className="mt-1 text-[13px] tabular-nums text-muted">
        {plural(pattern.failing, "page fails", "pages fail")}, {plural(pattern.warning, "page needs work", "pages need work")}, of {audited} checked
      </p>
      <ul className="mt-2 flex list-none flex-wrap gap-1.5">
        {pattern.byTemplate.map((t) => (
          <li key={t.template} className="rounded bg-surface px-2 py-1 text-[13px] tabular-nums">
            <code translate="no" className="break-all font-mono text-xs">
              {t.template}
            </code>{" "}
            {t.failing + t.warning} of {t.pages}
          </li>
        ))}
      </ul>
    </li>
  );
}

export function SiteView({ report }: { report: SiteReport }) {
  const tone = TONE_CLASSES[scoreTone(report.averageScore)];
  return (
    <ReportFrame showShare>
      <Column className="pb-12 pt-8">
        <header>
          <h1 className="break-words text-2xl font-semibold leading-8 tracking-tight">
            <span translate="no">{report.host}</span>
            {" whole-site audit"}
          </h1>
          <p className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] leading-5 text-muted">
            <span>
              Fetched <time dateTime={report.fetchedAt}>{formatFetchedAt(report.fetchedAt)}</time>
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Checked in {formatDuration(report.durationMs)}</span>
            <span aria-hidden="true">·</span>
            <Link href={`/report?url=${encodeURIComponent(report.url)}`} className="text-accent underline underline-offset-4 hover:text-accent-hover">
              Report for the page you entered
            </Link>
          </p>
          {report.partial && (
            <p role="note" className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[13px] leading-5 text-warn print:ring-1 print:ring-warn">
              The time limit passed before every sampled page was checked. These results use the {report.audited} pages that finished.
            </p>
          )}
          {report.notes.length > 0 && (
            <details className="mt-3 text-[13px] text-muted">
              <summary className="cursor-pointer select-none rounded">{plural(report.notes.length, "note", "notes")} from the audit</summary>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                {report.notes.map((note, i) => (
                  <li key={i} className="break-words">
                    {note}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </header>

        <div className="card mt-4 flex flex-wrap items-center gap-x-6 gap-y-4 p-5">
          <ScoreGauge score={report.averageScore} grade={report.grade} size={112} animate={false} />
          <div className="min-w-0 flex-1 basis-64">
            <p className={`text-lg font-semibold ${tone.text}`}>Average score {report.averageScore} out of 100</p>
            <p className="mt-1 text-sm">
              {report.audited} of {report.sampled} sampled pages were checked
              {report.sitemapFound ? ", picked from the sitemap across page types." : ". No sitemap was found."}
            </p>
            {report.failedPages.length > 0 && (
              <p className="mt-1 text-[13px] text-muted">
                {plural(report.failedPages.length, "page", "pages")} could not be read and{" "}
                {report.failedPages.length === 1 ? "is" : "are"} left out of the score.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <Section id="site-fixes" title="Most common fixes" hint="The fixes that would help the most sampled pages. Fix these once, in the template, and every page of that type improves.">
            {report.topFixes.length === 0 ? (
              <p className="border-t border-line px-5 py-4 text-sm text-muted">No fixes to suggest. Every check passed on the pages we sampled.</p>
            ) : (
              <ol className="list-none border-t border-line">
                {report.topFixes.map((fix) => (
                  <FixRow key={fix.checkId} fix={fix} audited={report.audited} />
                ))}
              </ol>
            )}
          </Section>

          <Section id="site-templates" title="Page types" hint="Pages grouped by the first part of their address. A pattern that follows a page type usually has one cause.">
            <ul className="list-none border-t border-line">
              {report.templates.map((t) => {
                const bar = TONE_CLASSES[scoreTone(t.averageScore)];
                return (
                  <li key={t.template} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-t border-line px-5 py-3 first:border-t-0">
                    <p className="min-w-0 text-sm">
                      <code translate="no" className="break-all font-mono text-[13px]">
                        {t.template}
                      </code>
                      <span className="text-muted"> · {plural(t.pages, "page", "pages")}</span>
                    </p>
                    <p className="text-sm tabular-nums">{t.averageScore} average</p>
                    <span aria-hidden="true" className="col-span-2 h-2 overflow-hidden rounded-full bg-surface-2">
                      <span className={`block h-full rounded-full ${bar.bg}`} style={{ width: `${t.averageScore}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section id="site-patterns" title="Checks that fail or need work" hint="For each check, how many sampled pages have a problem, and on which page types.">
            {report.patterns.length === 0 ? (
              <p className="border-t border-line px-5 py-4 text-sm text-muted">No check failed or needed work on the pages we sampled.</p>
            ) : (
              <ul className="list-none border-t border-line">
                {report.patterns.map((p) => (
                  <PatternRow key={p.checkId} pattern={p} audited={report.audited} />
                ))}
              </ul>
            )}
          </Section>

          <Section id="site-pages" title="Pages checked">
            <details className="border-t border-line">
              <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium">Show the {report.pages.length} pages</summary>
              <ul className="list-none">
                {report.pages.map((p) => (
                  <li key={p.url} className="flex items-baseline justify-between gap-3 border-t border-line px-5 py-2 text-sm">
                    {isHttpUrl(p.url) ? (
                      <a href={p.url} target="_blank" rel="nofollow noopener noreferrer" translate="no" className="min-w-0 break-all text-accent underline underline-offset-4 hover:text-accent-hover">
                        {p.url}
                      </a>
                    ) : (
                      <span translate="no" className="min-w-0 break-all">
                        {p.url}
                      </span>
                    )}
                    <span className="shrink-0 tabular-nums text-muted">
                      {p.score} · {p.grade}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </Section>
        </div>

        <WideFooter note="This score estimates how citable a sample of pages is from what is on them. It does not measure actual citations or promise a place in an answer." />
      </Column>
    </ReportFrame>
  );
}
