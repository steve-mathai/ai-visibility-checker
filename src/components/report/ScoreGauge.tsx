import type { CSSProperties } from "react";
import { TONE_CLASSES, scoreTone } from "../format";

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const tone = TONE_CLASSES[scoreTone(clamped)];

  return (
    <div
      role="img"
      aria-label={`Overall score ${Math.round(clamped)} out of 100, grade ${grade}`}
      className={`relative size-[200px] shrink-0 ${tone.text}`}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--line)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="gauge-arc"
          style={{ "--gauge-circ": CIRCUMFERENCE } as CSSProperties}
        />
      </svg>
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center"
      >
        <span className="text-5xl font-semibold tabular-nums leading-none text-fg">
          {Math.round(clamped)}
        </span>
        <span className="mt-1 text-sm text-muted">out of 100</span>
        <span
          className={`mt-2 rounded-full px-3 py-0.5 text-sm font-semibold ${tone.soft}`}
        >
          Grade {grade}
        </span>
      </div>
    </div>
  );
}
