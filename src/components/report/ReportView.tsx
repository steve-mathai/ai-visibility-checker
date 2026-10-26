"use client";

import { useEffect, useMemo, useState } from "react";
import type { AiSummary, AuditReport, CategoryScore } from "@/lib/audit/types";
import { requestSummary } from "../api";
import { LeadCapture } from "../LeadCapture";
import { formatDuration, formatFetchedAt, hostOf } from "../format";
import { SITE } from "../site";
import { AiSummaryPanel, type SummaryState } from "./AiSummaryPanel";
import { BotTable } from "./BotTable";
import { CategoryChart, CrawlerChart } from "./Charts";
import { ChecksTable } from "./ChecksTable";
import { Column } from "./Column";
import { FixList } from "./FixList";
import { ReportFrame } from "./ReportFrame";
import { StatCards, VerdictBand } from "./Summary";
import { replaceHash } from "./hooks";
import { CHECKS_ID, checksHash, fixDomId } from "./labels";

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
  const [fixOverrides, setFixOverrides] = useState<Record<string, boolean>>({});

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
    document.title = `${isSample ? "Sample report" : "AI visibility report"} for ${host} · AI Visibility Checker`;
  }, [host, isSample]);

  // Heaviest category first, which is also the tab order.
  const categories = useMemo<CategoryScore[]>(
    () => [...report.categories].sort((a, b) => b.weight - a.weight),
    [report.categories],
  );
  const fixCheckIds = useMemo(
    () => new Set(report.fixes.map((f) => f.checkId)),
    [report.fixes],
  );

  function openCategory(id: CategoryScore["id"]) {
    replaceHash(checksHash(id));
    document.getElementById(CHECKS_ID)?.scrollIntoView({ block: "start" });
  }

  // "See the fix" in a check row: open that fix, scroll to it and move focus there.
  function seeFix(checkId: string) {
    setFixOverrides((current) => ({ ...current, [checkId]: true }));
    requestAnimationFrame(() => {
      const row = document.getElementById(fixDomId(checkId));
      row?.scrollIntoView({ block: "start" });
      row?.querySelector("button")?.focus({ preventScroll: true });
    });
  }

  // The engine already words redirects as a warning, so notes are just those.
  const noteCount = report.warnings.length;

  return (
    <ReportFrame showShare>
      <Column className="pb-12 pt-8">
        {/* Title row */}
        <header>
          <h1 className="break-words text-2xl font-semibold leading-8 tracking-tight">
            <span translate="no">{host}</span>
          </h1>
          <p className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] leading-5 text-muted">
            <a
              href={report.url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              translate="no"
              className="min-w-0 break-all text-accent underline underline-offset-4 hover:text-accent-hover"
            >
              {report.url}
            </a>
            <span aria-hidden="true">·</span>
            <span>
              Fetched{" "}
              <time dateTime={report.fetchedAt}>
                {formatFetchedAt(report.fetchedAt)}
              </time>
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Checked in {formatDuration(report.durationMs)}
            </span>
          </p>
          {isSample && (
            <p
              role="note"
              className="mt-3 flex min-h-[34px] items-center rounded-lg bg-warn-soft px-3 py-1.5 text-[13px] leading-5 text-warn print:ring-1 print:ring-warn"
            >
              Sample report for a made-up business. No real page was fetched.
            </p>
          )}
          {noteCount > 0 && (
            <details className="mt-3 text-[13px] text-muted">
              <summary className="cursor-pointer select-none rounded">
                {noteCount} {noteCount === 1 ? "note" : "notes"} from the audit
              </summary>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                {report.warnings.map((warning, i) => (
                  <li key={i} className="break-words">
                    {warning}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </header>

        <VerdictBand report={report} />
        <StatCards report={report} />

        <div className="mt-3 grid gap-3 md:grid-cols-2 md:items-start">
          <CategoryChart categories={categories} onOpenCategory={openCategory} />
          <CrawlerChart bots={report.bots} />
        </div>

        <div className="mt-3 space-y-3">
          <FixList
            fixes={report.fixes}
            overrides={fixOverrides}
            onToggle={(checkId, open) =>
              setFixOverrides((current) => ({ ...current, [checkId]: open }))
            }
          />
          <ChecksTable
            categories={categories}
            fixCheckIds={fixCheckIds}
            onSeeFix={seeFix}
          />
          <BotTable bots={report.bots} />
          <AiSummaryPanel state={summary} sample={isSample} />
          <div className="print:hidden">
            <LeadCapture context={report.url} />
          </div>
        </div>

        <footer className="mt-8 flex flex-col gap-1 text-[13px] text-muted sm:flex-row sm:justify-between sm:gap-6">
          <p className="max-w-[72ch]">
            This score estimates how citable a page is from what&rsquo;s on it.
            It doesn&rsquo;t measure actual citations or promise a place in an
            answer.
          </p>
          <p className="shrink-0">Built by {SITE.author}</p>
        </footer>
      </Column>
    </ReportFrame>
  );
}
