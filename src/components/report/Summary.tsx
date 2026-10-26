import type { ReactNode } from "react";
import type { AuditReport } from "@/lib/audit/types";
import { TONE_CLASSES, formatNumber, scoreTone } from "../format";
import { ScoreGauge } from "./ScoreGauge";

/** The verdict sentence beside a 96px ring, with the cap notice directly under when one applies. */
export function VerdictBand({ report }: { report: AuditReport }) {
  return (
    <section aria-labelledby="verdict-title" className="mt-6">
      <h2 id="verdict-title" className="sr-only">
        Verdict
      </h2>
      <div className="flex items-center gap-5 sm:gap-6">
        <ScoreGauge
          score={report.overallScore}
          grade={report.grade}
          size={96}
          animate={false}
        />
        <p className="min-w-0 max-w-[60ch] text-lead font-medium leading-snug tracking-tight">
          {report.verdict}
        </p>
      </div>
      {report.cappedBy && (
        <div
          role="note"
          className="mt-4 rounded-lg bg-fail-soft px-4 py-3 text-sm print:ring-1 print:ring-fail"
        >
          <p className="break-words font-medium text-fail">{report.cappedBy}</p>
          <p className="mt-0.5">
            Fix this first. The rest of the score can&rsquo;t count until
            it&rsquo;s solved.
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="card min-w-0 px-4 py-3.5">
      <dt className="text-[13px] leading-5 text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold leading-7 tabular-nums">
        {children}
      </dd>
    </div>
  );
}

function Suffix({ children }: { children: ReactNode }) {
  return <span className="font-normal text-muted"> {children}</span>;
}

/** Four peer figures: 2 by 2 on a phone, four across from 768px with a 12px gap. */
export function StatCards({ report }: { report: AuditReport }) {
  const answerBots = report.bots.filter((b) => b.purpose === "answer");
  const answerAllowed = answerBots.filter((b) => b.allowed).length;
  const botsTone =
    answerBots.length === 0 || answerAllowed === answerBots.length
      ? null
      : answerAllowed === 0
        ? "fail"
        : "warn";

  return (
    <section aria-labelledby="stats-title" className="mt-6">
      <h2 id="stats-title" className="sr-only">
        Key figures
      </h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Overall score">
          <span className={TONE_CLASSES[scoreTone(report.overallScore)].text}>
            {formatNumber(report.overallScore)}
          </span>
          <Suffix>/ 100</Suffix>
        </Stat>
        <Stat label="Fixes to make">{formatNumber(report.fixes.length)}</Stat>
        <Stat label="AI answer bots allowed">
          {answerBots.length === 0 ? (
            <span className="text-muted">–</span>
          ) : (
            <>
              <span className={botsTone ? TONE_CLASSES[botsTone].text : ""}>
                {answerAllowed}
              </span>
              <Suffix>of {answerBots.length}</Suffix>
            </>
          )}
        </Stat>
        <Stat label="Words on the page">
          {formatNumber(report.page.wordCount)}
        </Stat>
      </dl>
    </section>
  );
}
