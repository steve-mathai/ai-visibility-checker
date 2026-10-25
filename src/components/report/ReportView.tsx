"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { AiSummary, AuditReport } from "@/lib/audit/types";
import { requestSummary } from "../api";
import { Container } from "../Container";
import { CopyButton } from "../CopyButton";
import { ExternalIcon } from "../Icons";
import { LeadCapture } from "../LeadCapture";
import {
  TONE_CLASSES,
  formatDuration,
  formatFetchedAt,
  hostOf,
} from "../format";
import { AiSummaryPanel, type SummaryState } from "./AiSummaryPanel";
import { BotTable } from "./BotTable";
import { CategoryCard } from "./CategoryCard";
import { FixList } from "./FixList";
import { ScoreGauge } from "./ScoreGauge";

function SectionHeading({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {children && <p className="mt-1 max-w-2xl text-muted">{children}</p>}
    </div>
  );
}

export function ReportView({
  report,
  sampleSummary,
}: {
  report: AuditReport;
  /** When set, the report is the hand-written sample and no summary is fetched. */
  sampleSummary?: AiSummary;
}) {
  const isSample = Boolean(sampleSummary);
  const host = hostOf(report.url);

  const [summary, setSummary] = useState<SummaryState>(
    sampleSummary
      ? { status: "ready", response: { enabled: true, result: sampleSummary } }
      : { status: "loading" },
  );

  useEffect(() => {
    if (isSample) return;
    const controller = new AbortController();
    requestSummary(report, controller.signal).then((response) => {
      if (!controller.signal.aborted) {
        setSummary({ status: "ready", response });
      }
    });
    return () => controller.abort();
  }, [report, isSample]);

  useEffect(() => {
    document.title = `${isSample ? "Sample report" : "AI visibility report"} — ${host} · AI Visibility Checker`;
  }, [host, isSample]);

  // Open the weakest category by default so the first thing a reader sees is the problem area.
  const weakestId = useMemo(() => {
    const sorted = [...report.categories].sort((a, b) => a.score - b.score);
    return sorted[0]?.id;
  }, [report.categories]);

  const finalUrlDiffers =
    report.page.finalUrl && report.page.finalUrl !== report.url;

  return (
    <Container className="py-8 sm:py-12">
      {isSample && (
        <div
          role="note"
          className="mb-6 flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent-soft p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            <span className="font-semibold">Sample report.</span> This is a
            made-up business, Brightside Dental in Austin. No real page was
            fetched.
          </p>
          <Link href="/#check" className="btn btn-primary btn-sm self-start">
            Check your own page
          </Link>
        </div>
      )}

      {/* Header row */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-accent">
            {isSample ? "Sample report" : "AI visibility report"}
          </p>
          <h1 className="mt-1 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            {host}
          </h1>
          <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-muted">
            <a
              href={report.url}
              target="_blank"
              rel="nofollow noopener"
              className="inline-flex min-w-0 items-center gap-1 break-all text-accent underline underline-offset-4"
            >
              {report.url}
              <ExternalIcon className="size-3.5 shrink-0" />
            </a>
          </p>
          <p className="mt-1 text-sm text-muted">
            Fetched <time dateTime={report.fetchedAt}>{formatFetchedAt(report.fetchedAt)}</time>
            {finalUrlDiffers ? (
              <>
                {" · "}redirected to{" "}
                <span className="break-all">{report.page.finalUrl}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton
            text={() => window.location.href}
            label="Copy share link"
            className="btn btn-secondary"
          />
          <Link href="/#check" className="btn btn-secondary">
            Run another check
          </Link>
        </div>
      </header>

      {/* Score hero */}
      <section aria-labelledby="score-title" className="card mt-8 p-6 sm:p-8">
        <h2 id="score-title" className="sr-only">
          Overall score
        </h2>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
          <ScoreGauge score={report.overallScore} grade={report.grade} />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-sm font-medium text-muted">Verdict</p>
            <p className="mt-1 text-balance text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {report.verdict}
            </p>
            <dl className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm sm:justify-start">
              <div>
                <dt className="text-muted">Fixes to make</dt>
                <dd className="font-semibold tabular-nums">{report.fixes.length}</dd>
              </div>
              <div>
                <dt className="text-muted">Words on page</dt>
                <dd className="font-semibold tabular-nums">
                  {report.page.wordCount.toLocaleString("en-GB")}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Checked in</dt>
                <dd className="font-semibold tabular-nums">
                  {formatDuration(report.durationMs)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {report.cappedBy && (
          <div
            role="note"
            className={`mt-6 rounded-xl border p-4 text-sm ${TONE_CLASSES.fail.border} ${TONE_CLASSES.fail.soft}`}
          >
            <p className="font-semibold text-fail">Score capped</p>
            <p className="mt-1 font-medium">{report.cappedBy}</p>
            <p className="mt-1 text-muted">
              A blocking issue limits the overall score however well the rest
              of the page does, because an AI engine can&rsquo;t cite what it
              can&rsquo;t read or index. Fix this first.
            </p>
          </div>
        )}

        {report.warnings.length > 0 && (
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer select-none text-muted">
              {report.warnings.length}{" "}
              {report.warnings.length === 1 ? "note" : "notes"} from the audit
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              {report.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Jump links */}
      <nav
        aria-label="Report sections"
        className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm"
      >
        <a href="#categories" className="text-accent underline underline-offset-4">
          Scores by category
        </a>
        <a href="#fixes" className="text-accent underline underline-offset-4">
          Fix these first
        </a>
        <a href="#crawlers" className="text-accent underline underline-offset-4">
          AI crawler access
        </a>
        <a href="#summary" className="text-accent underline underline-offset-4">
          Plain-English summary
        </a>
      </nav>

      {/* Categories */}
      <section aria-labelledby="categories" className="mt-12">
        <SectionHeading id="categories" title="Scores by category">
          Select a category to see the individual checks behind its score.
        </SectionHeading>
        <ul className="space-y-3">
          {report.categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              defaultOpen={category.id === weakestId}
            />
          ))}
        </ul>
      </section>

      {/* Fixes */}
      <section aria-labelledby="fixes" className="mt-12">
        <SectionHeading id="fixes" title="Fix these first">
          Ordered by impact and effort, so the first item is the best use of
          your next hour.
        </SectionHeading>
        <FixList fixes={report.fixes} />
      </section>

      {/* Bots */}
      <section aria-labelledby="crawlers" className="mt-12">
        <SectionHeading id="crawlers" title="AI crawler access">
          What your robots.txt tells each AI crawler to do.
        </SectionHeading>
        <BotTable bots={report.bots} />
      </section>

      {/* AI summary */}
      <section aria-labelledby="summary" className="mt-12">
        <SectionHeading id="summary" title="Plain-English summary">
          {isSample
            ? "In a real report, an AI model reads the results above and writes this section."
            : "An AI model reads the results above and writes this section. It runs after the report loads."}
        </SectionHeading>
        <AiSummaryPanel state={summary} sample={isSample} />
      </section>

      <div className="mt-12">
        <LeadCapture context={report.url} />
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        This score estimates citability from on-page signals. It does not
        measure actual citations or guarantee inclusion.
      </p>
    </Container>
  );
}
