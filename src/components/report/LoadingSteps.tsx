"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Spinner } from "../Icons";

/** Approximate: the server does not stream progress, so these advance on a timer. */
const STEPS: { label: string; startsAtMs: number }[] = [
  { label: "Fetching the page…", startsAtMs: 0 },
  { label: "Reading robots.txt for 14 AI crawlers…", startsAtMs: 1400 },
  { label: "Parsing structured data…", startsAtMs: 3000 },
  { label: "Scoring the page…", startsAtMs: 4600 },
];

const STATE_WORD = { done: "Done", active: "Working", pending: "Waiting" } as const;

export function LoadingSteps({ host }: { host: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const id = window.setInterval(() => {
      setElapsed(performance.now() - started);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  let current = 0;
  STEPS.forEach((step, i) => {
    if (elapsed >= step.startsAtMs) current = i;
  });
  const slow = elapsed > 12_000;

  return (
    <div className="card mx-auto w-full max-w-xl overflow-hidden">
      <div className="p-5">
        <h1 className="break-words text-xl font-semibold tracking-tight">
          Checking <span translate="no">{host}</span>…
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          This usually takes 2 to 8 seconds.
        </p>
        <div
          className="mt-4 h-1 overflow-hidden rounded-full bg-surface-2"
          aria-hidden="true"
        >
          <div
            className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${(current + 0.5) / STEPS.length})` }}
          />
        </div>
      </div>

      <ol aria-live="polite" className="list-none border-t border-line">
        {STEPS.map((step, i) => {
          const state =
            i < current ? "done" : i === current ? "active" : "pending";
          return (
            <li
              key={step.label}
              className={`flex min-h-10 items-center gap-3 border-b border-line px-5 py-2 text-sm last:border-b-0 ${
                state === "pending" ? "text-muted" : "text-fg"
              } ${state === "active" ? "font-medium" : ""}`}
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                {state === "done" && <CheckIcon className="size-4 text-pass" />}
                {state === "active" && <Spinner className="size-4 text-accent" />}
                {state === "pending" && (
                  <span className="size-3 rounded-full border-2 border-line-strong" />
                )}
              </span>
              <span className="min-w-0 flex-1">{step.label}</span>
              <span className="shrink-0 text-[13px] font-normal text-muted">
                {STATE_WORD[state]}
              </span>
            </li>
          );
        })}
      </ol>

      <p
        role="status"
        aria-live="polite"
        className={`px-5 text-[13px] text-muted ${slow ? "py-3" : ""}`}
      >
        {slow
          ? "Still working. Some sites respond slowly, and we wait for them…"
          : ""}
      </p>
    </div>
  );
}
