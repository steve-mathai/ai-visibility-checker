import type { CSSProperties } from "react";
import { TONE_CLASSES, scoreTone } from "../format";

const VIEW = 100;
const STROKE = 6;
const RADIUS = (VIEW - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Named sizes kept for older callers: "sm" was the landing preview ring. */
const NAMED_SIZE = { sm: 120, md: 96 } as const;

/**
 * Thin score ring with the score and grade inside. The arc takes the score's
 * tone (pass 75 and up, warn 50 to 74, fail below 50); the digits stay in ink.
 * `size` is a pixel width, or "md" (96) / "sm" (120).
 */
export function ScoreGauge({
  score,
  grade,
  size = 96,
  animate = true,
}: {
  score: number;
  grade: string;
  size?: number | keyof typeof NAMED_SIZE;
  /** Sweeps the arc in once on load. The report turns this off. */
  animate?: boolean;
}) {
  const px = typeof size === "number" ? size : NAMED_SIZE[size];
  const clamped = Math.max(0, Math.min(100, score));
  const shown = Math.round(clamped);
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const tone = TONE_CLASSES[scoreTone(clamped)];

  return (
    <div
      role="img"
      aria-label={`Overall score ${shown} out of 100, grade ${grade}`}
      className={`relative shrink-0 ${tone.text}`}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={VIEW / 2}
          cy={VIEW / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--line)"
          strokeWidth={STROKE}
        />
        {clamped > 0 && (
          <circle
            cx={VIEW / 2}
            cy={VIEW / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className={animate ? "gauge-arc" : undefined}
            style={{ "--gauge-circ": CIRCUMFERENCE } as CSSProperties}
          />
        )}
      </svg>
      <div
        aria-hidden="true"
        className="absolute flex flex-col items-center justify-center rounded-full bg-hl text-hl-fg"
        style={{ inset: Math.round(px * 0.12) }}
      >
        <span
          className="font-semibold leading-none tabular-nums tracking-tight"
          style={{ fontSize: Math.round(px * 0.3) }}
        >
          {shown}
        </span>
        <span
          className="mt-1 leading-none"
          style={{ fontSize: Math.max(11, Math.round(px * 0.12)) }}
        >
          Grade {grade}
        </span>
      </div>
    </div>
  );
}
