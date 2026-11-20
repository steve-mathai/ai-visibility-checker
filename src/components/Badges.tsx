import type { ReactNode } from "react";
import type { CheckStatus, Effort, Impact } from "@/lib/audit/types";
import { EFFORT_LABEL, IMPACT_LABEL } from "./format";

export type PillTone = "pass" | "warn" | "fail" | "info" | "accent" | "neutral";

/** Pale tint with dark ink of the same hue. The word carries the meaning; colour backs it up. */
const PILL_CLASS: Record<PillTone, string> = {
  pass: "bg-pass-soft text-pass",
  warn: "bg-warn-soft text-warn",
  fail: "bg-fail-soft text-fail",
  info: "bg-info-soft text-info",
  accent: "bg-hl text-hl-fg",
  neutral: "bg-surface text-muted",
};

/** A 20px status pill. Never squeezed: it keeps its width and its line. */
export function Pill({
  tone,
  children,
  className = "",
}: {
  tone: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-xs font-medium print:ring-1 print:ring-current ${PILL_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const IMPACT_TONE: Record<Impact, PillTone> = {
  high: "accent",
  medium: "info",
  low: "neutral",
};

const EFFORT_TONE: Record<Effort, PillTone> = {
  quick: "pass",
  moderate: "info",
  involved: "warn",
};

export function ImpactBadge({ impact }: { impact: Impact }) {
  return <Pill tone={IMPACT_TONE[impact]}>{IMPACT_LABEL[impact]}</Pill>;
}

export function EffortBadge({ effort }: { effort: Effort }) {
  return <Pill tone={EFFORT_TONE[effort]}>{EFFORT_LABEL[effort]}</Pill>;
}

const STATUS_TONE: Record<CheckStatus, PillTone> = {
  pass: "pass",
  warn: "warn",
  fail: "fail",
  info: "info",
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: "Passed",
  warn: "Needs work",
  fail: "Failed",
  info: "Note",
};

export function StatusPill({ status }: { status: CheckStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}
