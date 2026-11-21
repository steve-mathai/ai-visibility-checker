"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Spinner } from "../Icons";

export interface LoadingStep {
  label: string;
  startsAtMs: number;
}

const STATE_WORD = { done: "Done", active: "Working", pending: "Waiting" } as const;

/**
 * Loading card for the two wide audits. The server does not stream progress, so the steps advance on a timer
 * and say so ("usually"). The polite live region announces each step change and the slow-run note.
 */
export function WideLoading({
  title,
  expectation,
  steps,
  slowAfterMs,
  slowNote,
}: {
  title: string;
  expectation: string;
  steps: LoadingStep[];
  slowAfterMs: number;
  slowNote: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const id = window.setInterval(() => setElapsed(performance.now() - started), 500);
    return () => window.clearInterval(id);
  }, []);

  let current = 0;
  steps.forEach((step, i) => {
    if (elapsed >= step.startsAtMs) current = i;
  });
  const slow = elapsed > slowAfterMs;

  return (
    <div className="card mx-auto w-full max-w-xl overflow-hidden">
      <div className="p-5">
        <h1 className="break-words text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-[13px] text-muted">{expectation}</p>
      </div>
      <ol className="list-none border-t border-line">
        {steps.map((step, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          return (
            <li
              key={step.label}
              aria-current={state === "active" ? "step" : undefined}
              className={`flex min-h-10 items-center gap-3 border-b border-line px-5 py-2 text-sm last:border-b-0 ${
                state === "pending" ? "text-muted" : "text-fg"
              } ${state === "active" ? "font-medium" : ""}`}
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                {state === "done" && <CheckIcon className="size-4 text-pass" />}
                {state === "active" && <Spinner className="size-4 text-accent" />}
                {state === "pending" && <span className="size-3 rounded-full border-2 border-line-strong" />}
              </span>
              <span className="min-w-0 flex-1">{step.label}</span>
              <span className="shrink-0 text-[13px] font-normal text-muted">{STATE_WORD[state]}</span>
            </li>
          );
        })}
      </ol>
      <p role="status" aria-live="polite" className={`px-5 text-[13px] text-muted ${slow ? "py-3" : ""}`}>
        {slow ? slowNote : ""}
      </p>
    </div>
  );
}
