"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Spinner } from "../Icons";

/** Approximate: the server does not stream progress, so these advance on a timer. */
const STEPS: { label: string; startsAtMs: number }[] = [
  { label: "Fetching page", startsAtMs: 0 },
  { label: "Reading robots.txt for 14 AI crawlers", startsAtMs: 1400 },
  { label: "Parsing structured data", startsAtMs: 3000 },
  { label: "Scoring", startsAtMs: 4600 },
];

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
    <div className="mx-auto max-w-xl py-16 sm:py-24">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Checking {host}
        </h1>
        <p className="mt-1 text-sm text-muted">
          This usually takes 2 to 8 seconds.
        </p>

        <ol className="mt-6 space-y-3">
          {STEPS.map((step, i) => {
            const state =
              i < current ? "done" : i === current ? "active" : "pending";
            return (
              <li
                key={step.label}
                className={`flex items-center gap-3 text-sm ${
                  state === "pending" ? "text-muted/70" : ""
                } ${state === "active" ? "font-medium" : ""}`}
              >
                <span className="flex size-6 shrink-0 items-center justify-center">
                  {state === "done" && (
                    <CheckIcon className="size-5 text-pass" />
                  )}
                  {state === "active" && (
                    <Spinner className="size-5 text-accent" />
                  )}
                  {state === "pending" && (
                    <span className="size-2 rounded-full bg-line-strong" />
                  )}
                </span>
                <span>{step.label}</span>
                <span className="sr-only">
                  {state === "done"
                    ? " (done)"
                    : state === "active"
                      ? " (in progress)"
                      : " (waiting)"}
                </span>
              </li>
            );
          })}
        </ol>

        <p role="status" aria-live="polite" className="mt-6 text-sm text-muted">
          <span className="sr-only">Current step: {STEPS[current].label}. </span>
          {slow
            ? "Still working. Some sites respond slowly, and we wait for them."
            : ""}
        </p>
      </div>
    </div>
  );
}
