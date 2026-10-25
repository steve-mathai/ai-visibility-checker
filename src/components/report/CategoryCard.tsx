"use client";

import { useId, useState } from "react";
import type { CategoryScore } from "@/lib/audit/types";
import { ChevronIcon, StatusIcon } from "../Icons";
import { TONE_CLASSES, scoreTone } from "../format";

export function CategoryCard({
  category,
  defaultOpen = false,
}: {
  category: CategoryScore;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const tone = TONE_CLASSES[scoreTone(category.score)];
  const issues = category.checks.filter(
    (c) => c.status === "fail" || c.status === "warn",
  ).length;
  const score = Math.round(category.score);

  return (
    <li className="card overflow-hidden">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-4 p-4 text-left hover:bg-surface-2/60 sm:p-5"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-base font-semibold">{category.label}</span>
              <span className="text-sm text-muted">
                {Math.round(category.weight * 100)}% of overall score
              </span>
            </span>
            <span
              className="mt-3 block h-2 overflow-hidden rounded-full bg-surface-2"
              aria-hidden="true"
            >
              <span
                className={`block h-full rounded-full ${tone.bg}`}
                style={{ width: `${Math.max(2, score)}%` }}
              />
            </span>
            <span className="mt-2 block text-sm text-muted">
              {issues === 0
                ? "No issues found"
                : `${issues} ${issues === 1 ? "check needs" : "checks need"} attention`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="text-right">
              <span
                className={`block text-2xl font-semibold tabular-nums ${tone.text}`}
              >
                {score}
              </span>
              <span className="sr-only">out of 100</span>
            </span>
            <ChevronIcon
              className={`size-5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      </h3>

      <div id={panelId} hidden={!open}>
        <ul className="divide-y divide-line border-t border-line">
          {category.checks.map((check) => (
            <li key={check.id} className="flex gap-3 p-4 sm:px-5">
              <StatusIcon status={check.status} className="mt-0.5 size-5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-medium">{check.title}</p>
                  {check.maxPoints > 0 && (
                    <p className="text-xs tabular-nums text-muted">
                      {check.points}/{check.maxPoints} pts
                    </p>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{check.summary}</p>
                {check.evidence && check.evidence.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer select-none text-accent">
                      Evidence ({check.evidence.length})
                    </summary>
                    <ul className="mt-2 space-y-1 rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed">
                      {check.evidence.map((line, i) => (
                        <li key={i} className="break-words">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {check.fix && (
                  <p className="mt-2 text-sm">
                    <a
                      href="#fixes"
                      className="text-accent underline underline-offset-4"
                    >
                      See the fix: {check.fix.title}
                    </a>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
