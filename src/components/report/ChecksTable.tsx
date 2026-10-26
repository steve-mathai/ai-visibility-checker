"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { CategoryScore, CheckResult } from "@/lib/audit/types";
import { StatusPill } from "../Badges";
import { ChevronIcon } from "../Icons";
import { TONE_CLASSES, scoreTone } from "../format";
import { replaceHash, useHash } from "./hooks";
import { CHECKS_ID, checksHash, fixDomId, shortLabel } from "./labels";

/** Status, check, what we found, points. Fixed first and last columns keep the rows aligned. */
const ROW_GRID =
  "grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-4 gap-y-1 md:grid-cols-[96px_minmax(0,0.9fr)_minmax(0,1.5fr)_72px]";

function Points({ check }: { check: CheckResult }) {
  if (check.maxPoints <= 0) {
    return (
      <span className="text-muted">
        –<span className="sr-only"> not scored</span>
      </span>
    );
  }
  return (
    <>
      {check.points}
      <span className="text-muted">/{check.maxPoints}</span>
      <span className="sr-only"> points</span>
    </>
  );
}

function CheckRow({
  check,
  open,
  linkedFix,
  onToggle,
  onSeeFix,
}: {
  check: CheckResult;
  open: boolean;
  /** Whether this check has a fix in the fix list to jump to. */
  linkedFix: boolean;
  onToggle: () => void;
  onSeeFix: (checkId: string) => void;
}) {
  const evidence = check.evidence ?? [];
  const expandable = evidence.length > 0 || linkedFix;
  const detailId = `detail-${check.id}`;

  return (
    <div role="rowgroup" className="border-t border-line">
      <div
        role="row"
        className={`relative items-start px-5 py-2.5 ${ROW_GRID} ${
          expandable ? "hover:bg-surface print:hover:bg-transparent" : ""
        }`}
      >
        <div role="cell" className="col-start-1 row-start-1 pt-px">
          <StatusPill status={check.status} />
        </div>
        <div
          role="cell"
          className="col-start-2 row-start-1 min-w-0 text-sm font-medium leading-5 md:col-start-2"
        >
          {expandable ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={onToggle}
              className="flex w-full items-start gap-1.5 text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
            >
              <ChevronIcon
                className={`mt-0.5 size-4 shrink-0 text-muted transition-transform print:hidden ${
                  open ? "" : "-rotate-90"
                }`}
              />
              <span className="min-w-0 break-words">{check.title}</span>
            </button>
          ) : (
            <span className="flex gap-1.5">
              <span className="w-4 shrink-0 print:hidden" aria-hidden="true" />
              <span className="min-w-0 break-words">{check.title}</span>
            </span>
          )}
        </div>
        <div
          role="cell"
          className="col-span-3 col-start-1 row-start-2 min-w-0 break-words text-[13px] leading-5 text-muted md:col-span-1 md:col-start-3 md:row-start-1 md:text-sm"
        >
          {check.summary}
        </div>
        <div
          role="cell"
          className="col-start-3 row-start-1 text-right text-sm leading-5 tabular-nums md:col-start-4"
        >
          <Points check={check} />
        </div>
      </div>

      {expandable && (
        <div
          role="row"
          id={detailId}
          className={open ? "" : "hidden print:block"}
        >
          <div
            role="cell"
            className="px-5 pb-3 md:pl-[154px]"
          >
            {evidence.length > 0 && (
              <>
                <p className="text-[13px] font-semibold text-muted">Evidence</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] leading-5">
                  {evidence.map((line, i) => (
                    <li key={i} className="break-words">
                      {line}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {linkedFix && (
              <p className="mt-2 text-[13px] print:hidden">
                <a
                  href={`#${fixDomId(check.id)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onSeeFix(check.id);
                  }}
                  className="text-accent underline underline-offset-4 hover:text-accent-hover"
                >
                  See the fix
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChecksTable({
  categories,
  fixCheckIds,
  onSeeFix,
}: {
  /** In display order, the same order as the tabs. */
  categories: CategoryScore[];
  fixCheckIds: ReadonlySet<string>;
  onSeeFix: (checkId: string) => void;
}) {
  const hash = useHash();
  const activeId = useMemo(() => {
    const match = /^#checks-(.+)$/.exec(hash);
    const found = match ? categories.find((c) => c.id === match[1]) : undefined;
    return (found ?? categories[0])?.id;
  }, [hash, categories]);

  const [openChecks, setOpenChecks] = useState<ReadonlySet<string>>(new Set());
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // A link such as /report?url=...#checks-content lands on the checks card.
  useEffect(() => {
    if (/^#checks-/.test(window.location.hash)) {
      document.getElementById(CHECKS_ID)?.scrollIntoView({ block: "start" });
    }
  }, []);

  function toggleCheck(id: string) {
    setOpenChecks((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = categories.length - 1;
    let target = -1;
    if (event.key === "ArrowRight") target = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") target = index === 0 ? last : index - 1;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = last;
    if (target < 0) return;
    event.preventDefault();
    replaceHash(checksHash(categories[target].id));
    tabRefs.current[target]?.focus();
  }

  if (categories.length === 0) return null;

  return (
    <section
      id={CHECKS_ID}
      aria-labelledby="checks-title"
      className="card overflow-hidden"
    >
      <div className="px-5 pt-4">
        <h2 id="checks-title" className="text-base font-semibold">
          Checks, by category
        </h2>
      </div>

      <div className="mt-2 overflow-x-auto border-b border-line px-5 print:hidden">
        <div
          role="tablist"
          aria-label="Check categories"
          className="flex min-w-max gap-5"
        >
          {categories.map((category, index) => {
            const selected = category.id === activeId;
            return (
              <button
                key={category.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`tab-${category.id}`}
                aria-selected={selected}
                aria-controls={`panel-${category.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => replaceHash(checksHash(category.id))}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={`-mb-px h-10 whitespace-nowrap border-b-2 text-sm font-medium focus-visible:-outline-offset-2 ${
                  selected
                    ? "border-accent text-fg"
                    : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {shortLabel(category.id)}
              </button>
            );
          })}
        </div>
      </div>

      {categories.map((category) => {
        const selected = category.id === activeId;
        const tone = TONE_CLASSES[scoreTone(category.score)];
        return (
          <div
            key={category.id}
            role="tabpanel"
            id={`panel-${category.id}`}
            aria-labelledby={`tab-${category.id}`}
            className={selected ? "" : "hidden print:block"}
          >
            <h3 className="hidden px-5 pt-4 text-base font-semibold print:block">
              {shortLabel(category.id)}
            </h3>
            <p className="px-5 py-3 text-[13px] text-muted">
              <span className={`font-semibold tabular-nums ${tone.text}`}>
                {Math.round(category.score)}
              </span>{" "}
              out of 100, counting for{" "}
              <span className="tabular-nums">
                {Math.round(category.weight * 100)}%
              </span>{" "}
              of the overall score.
            </p>
            <div
              role="table"
              aria-label={`${shortLabel(category.id)} checks`}
              className="border-t border-line"
            >
              <div role="rowgroup">
                <div
                  role="row"
                  className={`px-5 py-2 text-[13px] font-semibold text-muted max-md:sr-only md:grid ${ROW_GRID}`}
                >
                  <div role="columnheader">Status</div>
                  <div role="columnheader" className="md:pl-[22px]">
                    Check
                  </div>
                  <div role="columnheader">What we found</div>
                  <div role="columnheader" className="text-right">
                    Points
                  </div>
                </div>
              </div>
              {category.checks.map((check) => (
                <CheckRow
                  key={check.id}
                  check={check}
                  open={openChecks.has(check.id)}
                  linkedFix={Boolean(check.fix) && fixCheckIds.has(check.id)}
                  onToggle={() => toggleCheck(check.id)}
                  onSeeFix={onSeeFix}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
