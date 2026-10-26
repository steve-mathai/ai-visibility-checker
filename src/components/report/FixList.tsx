"use client";

import type { PrioritisedFix } from "@/lib/audit/types";
import { EffortBadge, ImpactBadge } from "../Badges";
import { CopyButton } from "../CopyButton";
import { ChevronIcon } from "../Icons";
import { FIXES_ID, fixDomId, shortLabel } from "./labels";
import { useMediaQuery } from "./hooks";

/** Rows open by default on a desktop. On a phone only the first is. */
const DESKTOP_OPEN_COUNT = 5;

function pointsText(points: number): string {
  return `Up to +${points} pts`;
}

function FixRow({
  fix,
  open,
  onToggle,
}: {
  fix: PrioritisedFix;
  open: boolean;
  onToggle: () => void;
}) {
  const bodyId = `${fixDomId(fix.checkId)}-body`;
  const area = shortLabel(fix.category);

  return (
    <li
      id={fixDomId(fix.checkId)}
      className="border-t border-line break-inside-avoid first:border-t-0"
    >
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-surface focus-visible:-outline-offset-2 print:hover:bg-transparent"
        >
          <ChevronIcon
            className={`mt-1 size-4 shrink-0 text-muted transition-transform print:hidden ${
              open ? "" : "-rotate-90"
            }`}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="break-words text-base font-semibold leading-snug">
              {fix.title}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <ImpactBadge impact={fix.impact} />
              <EffortBadge effort={fix.effort} />
              <span className="text-[13px] text-muted">{area}</span>
              {fix.pointsAvailable > 0 && (
                <span className="text-[13px] tabular-nums text-muted sm:hidden">
                  {pointsText(fix.pointsAvailable)}
                </span>
              )}
            </span>
          </span>
          {fix.pointsAvailable > 0 && (
            <span className="mt-0.5 hidden shrink-0 text-[13px] tabular-nums text-muted sm:block">
              {pointsText(fix.pointsAvailable)}
            </span>
          )}
        </button>
      </h3>

      <div
        id={bodyId}
        className={`pb-4 pl-12 pr-5 ${open ? "" : "hidden print:block"}`}
      >
        <div className="max-w-[72ch] space-y-3">
          <div>
            <p className="text-[13px] font-semibold text-muted">
              Why it matters
            </p>
            <p className="mt-0.5 text-sm">{fix.why}</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-muted">What to do</p>
            <p className="mt-0.5 whitespace-pre-line break-words text-sm">
              {fix.how}
            </p>
          </div>
          {fix.pointsAvailable > 0 && (
            <p className="text-[13px] text-muted">
              Worth up to {fix.pointsAvailable} points in the {area} score.
            </p>
          )}
        </div>

        {fix.snippet && (
          <div className="mt-3 max-w-[72ch] overflow-hidden rounded-lg bg-surface">
            <div className="flex items-center justify-between gap-2 py-1.5 pl-3 pr-1.5">
              <span className="text-[13px] font-semibold text-muted">
                Snippet
              </span>
              <CopyButton
                text={fix.snippet}
                ariaLabel={`Copy snippet for: ${fix.title}`}
              />
            </div>
            <pre
              tabIndex={0}
              className="overflow-x-auto px-3 pb-3 font-mono text-[13px] leading-relaxed print:whitespace-pre-wrap"
            >
              <code>{fix.snippet}</code>
            </pre>
          </div>
        )}
      </div>
    </li>
  );
}

export function FixList({
  fixes,
  overrides,
  onToggle,
}: {
  fixes: PrioritisedFix[];
  /** Rows the reader opened or closed; everything else follows the default. */
  overrides: Record<string, boolean>;
  onToggle: (checkId: string, open: boolean) => void;
}) {
  const desktop = useMediaQuery("(min-width: 768px)", true);

  return (
    <section
      id={FIXES_ID}
      aria-labelledby="fixes-title"
      className="card overflow-hidden"
    >
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <h2 id="fixes-title" className="text-base font-semibold">
          Fix these first
        </h2>
        <p className="shrink-0 text-[13px] tabular-nums text-muted">
          {fixes.length} {fixes.length === 1 ? "fix" : "fixes"}
        </p>
      </div>
      {fixes.length === 0 ? (
        <p className="border-t border-line px-5 py-4 text-sm text-muted">
          No fixes to suggest. Every check passed or is informational.
        </p>
      ) : (
        <ol role="list" className="list-none border-t border-line">
          {fixes.map((fix, index) => {
            const defaultOpen = desktop ? index < DESKTOP_OPEN_COUNT : index === 0;
            const open = overrides[fix.checkId] ?? defaultOpen;
            return (
              <FixRow
                key={`${fix.checkId}-${index}`}
                fix={fix}
                open={open}
                onToggle={() => onToggle(fix.checkId, !open)}
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}
