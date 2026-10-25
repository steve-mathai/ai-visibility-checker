"use client";

import { useState } from "react";
import type { Effort, Impact, PrioritisedFix } from "@/lib/audit/types";
import { categoryLabel } from "../categories";
import { CopyButton } from "../CopyButton";
import { EFFORT_LABEL, IMPACT_LABEL } from "../format";

const INITIAL_COUNT = 5;

const IMPACT_CLASS: Record<Impact, string> = {
  high: "bg-accent text-accent-fg",
  medium: "bg-accent-soft text-accent",
  low: "bg-surface-2 text-muted",
};

const EFFORT_CLASS: Record<Effort, string> = {
  quick: "border-pass/50 text-pass",
  moderate: "border-line-strong text-muted",
  involved: "border-line-strong text-muted",
};

function FixCard({ fix, index }: { fix: PrioritisedFix; index: number }) {
  return (
    <li className="card p-4 sm:p-6">
      <div className="flex gap-3 sm:gap-4">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-snug">{fix.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium">
            <span
              className={`rounded-full px-2.5 py-1 ${IMPACT_CLASS[fix.impact]}`}
            >
              {IMPACT_LABEL[fix.impact]}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 ${EFFORT_CLASS[fix.effort]}`}
            >
              {EFFORT_LABEL[fix.effort]}
            </span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">
              {categoryLabel(fix.category)}
            </span>
            {fix.pointsAvailable > 0 && (
              <span className="text-muted">
                Up to +{fix.pointsAvailable} pts in category
              </span>
            )}
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-semibold">Why it matters</dt>
              <dd className="mt-0.5 text-muted">{fix.why}</dd>
            </div>
            <div>
              <dt className="font-semibold">What to do</dt>
              <dd className="mt-0.5 whitespace-pre-line text-muted">
                {fix.how}
              </dd>
            </div>
          </dl>

          {fix.snippet && (
            <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface-2">
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
                <span className="text-xs font-medium text-muted">Snippet</span>
                <CopyButton
                  text={fix.snippet}
                  ariaLabel={`Copy snippet for: ${fix.title}`}
                />
              </div>
              <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
                <code>{fix.snippet}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function FixList({ fixes }: { fixes: PrioritisedFix[] }) {
  const [showAll, setShowAll] = useState(false);

  if (fixes.length === 0) {
    return (
      <p className="card p-6 text-muted">
        No fixes to suggest. Every check passed or is informational.
      </p>
    );
  }

  const visible = showAll ? fixes : fixes.slice(0, INITIAL_COUNT);
  const hidden = fixes.length - visible.length;

  return (
    <div>
      <ol className="space-y-4">
        {visible.map((fix, i) => (
          <FixCard key={`${fix.checkId}-${i}`} fix={fix} index={i} />
        ))}
      </ol>
      {fixes.length > INITIAL_COUNT && (
        <div className="mt-4 text-center">
          <button
            type="button"
            className="btn btn-secondary"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show fewer" : `Show ${hidden} more`}
          </button>
        </div>
      )}
    </div>
  );
}
