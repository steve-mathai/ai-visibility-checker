import Link from "next/link";
import type { ReactNode } from "react";
import type { AuditReport, BotVerdict, CategoryId, PrioritisedFix } from "@/lib/audit/types";
import type { CompareItem } from "@/lib/audit/wide-types";
import { Pill } from "../Badges";
import { TONE_CLASSES, hostOf, isHttpUrl, scoreTone } from "../format";
import { ScoreGauge } from "../report/ScoreGauge";
import { shortLabel } from "../report/labels";

const CATEGORY_ORDER: CategoryId[] = ["crawlability", "content", "structured-data", "meta", "entity"];
const TOP_FIXES = 3;

const TH = "px-3 py-3 text-left align-top text-[13px] font-semibold text-muted";
const ROW_HEAD = `${TH} sticky left-0 z-10 w-36 min-w-36 bg-raised pl-5`;
const TD = "min-w-44 px-3 py-3 align-top text-sm";

function answerBots(report: AuditReport): BotVerdict[] {
  return report.bots.filter((b) => b.purpose === "answer");
}

function categoryScore(report: AuditReport, id: CategoryId): number | null {
  const found = report.categories.find((c) => c.id === id);
  return found ? Math.round(found.score) : null;
}

function ScoreBar({ score }: { score: number }) {
  const tone = TONE_CLASSES[scoreTone(score)];
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <span className={`block h-full rounded-full ${tone.bg}`} style={{ width: `${score}%` }} />
      </span>
      <span className="w-7 shrink-0 text-right tabular-nums">{score}</span>
    </div>
  );
}

function FixCell({ fixes }: { fixes: PrioritisedFix[] }) {
  if (fixes.length === 0) return <span className="text-muted">No fixes to suggest.</span>;
  return (
    <ol className="list-decimal space-y-2 pl-4">
      {fixes.slice(0, TOP_FIXES).map((fix) => (
        <li key={fix.checkId} className="break-words">
          {fix.title}
        </li>
      ))}
    </ol>
  );
}

type Column = { item: CompareItem; report: AuditReport | null };

/**
 * One table, one column per site. It is wider than a phone, so it scrolls inside its own frame; the row labels
 * stay put while it moves. The note above it is the visible hint that there is more to the side.
 */
export function CompareTable({ items }: { items: CompareItem[] }) {
  const columns: Column[] = items.map((item) => ({ item, report: item.ok ? item.report : null }));
  const rows: { key: string; label: string; cell: (c: Column) => ReactNode }[] = [
    {
      key: "overall",
      label: "Overall score",
      cell: ({ report }) =>
        report ? (
          <div className="flex items-center gap-3">
            <ScoreGauge score={report.overallScore} grade={report.grade} size={72} animate={false} />
            <p className="min-w-0 text-[13px] text-muted">{report.verdict}</p>
          </div>
        ) : null,
    },
    ...CATEGORY_ORDER.map((id) => ({
      key: id,
      label: shortLabel(id),
      cell: ({ report }: Column) => {
        const score = report ? categoryScore(report, id) : null;
        return score === null ? null : <ScoreBar score={score} />;
      },
    })),
    {
      key: "bots",
      label: "Answer bot access",
      cell: ({ report }) =>
        report ? (
          <ul className="list-none space-y-1.5">
            {answerBots(report).map((bot) => (
              <li key={bot.bot} className="flex items-center justify-between gap-2">
                <span translate="no" className="min-w-0 break-words text-[13px]">
                  {bot.bot}
                </span>
                <Pill tone={bot.allowed ? "pass" : "fail"}>{bot.allowed ? "Allowed" : "Blocked"}</Pill>
              </li>
            ))}
          </ul>
        ) : null,
    },
    { key: "fixes", label: "Top 3 fixes", cell: ({ report }) => (report ? <FixCell fixes={report.fixes} /> : null) },
  ];

  const minWidth = 144 + columns.length * 208;

  return (
    <section aria-labelledby="compare-title" className="card mt-4 overflow-hidden">
      <div className="px-5 pb-3 pt-4">
        <h2 id="compare-title" className="text-base font-semibold">
          Side by side
        </h2>
        <p className="mt-1 text-[13px] text-muted lg:hidden">Swipe or scroll sideways inside the table to see every site.</p>
      </div>
      <div role="region" aria-label="Comparison table" tabIndex={0} className="overflow-x-auto border-t border-line">
        <table className="w-full border-collapse text-left" style={{ minWidth }}>
          <caption className="sr-only">AI visibility compared across {columns.length} sites</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={`${ROW_HEAD} font-normal`}>
                <span className="sr-only">Measure</span>
              </th>
              {columns.map(({ item }) => (
                <th key={item.url} scope="col" className={`${TH} min-w-44 text-fg`}>
                  <span translate="no" className="block break-all text-sm font-semibold">
                    {hostOf(item.url)}
                  </span>
                  {item.ok && isHttpUrl(item.report.url) ? (
                    <Link
                      href={`/report?url=${encodeURIComponent(item.report.url)}`}
                      className="mt-0.5 inline-block text-[13px] font-normal text-accent underline underline-offset-4 hover:text-accent-hover"
                    >
                      Full report
                    </Link>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-line first:border-t-0">
                <th scope="row" className={`${ROW_HEAD} font-medium text-fg`}>
                  {row.label}
                </th>
                {columns.map((column) => (
                  <td key={column.item.url} className={TD}>
                    {column.item.ok ? (
                      row.cell(column)
                    ) : row.key === "overall" ? (
                      <p className="break-words text-[13px] font-medium text-fail">{column.item.error}</p>
                    ) : (
                      <span className="text-muted">No data</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
