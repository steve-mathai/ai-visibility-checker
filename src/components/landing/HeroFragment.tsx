import type { CSSProperties } from "react";
import styles from "./landing.module.css";
import {
  EFFORT,
  HERO_BOTS,
  IMPACT,
  PURPOSE_LABEL,
  REPORT,
  SAMPLE_HOST,
  checkedIn,
  fetchedLine,
  toneOf,
} from "./data";

const R = 54;
const CIRC = 2 * Math.PI * R;

/** A real crop of a report built from the engine's sample output. */
export function HeroFragment() {
  const tone = toneOf(REPORT.overallScore);
  const offset = CIRC * (1 - REPORT.overallScore / 100);
  const fixes = REPORT.fixes.slice(0, 6);

  return (
    <div
      data-ui
      className={styles.sheet}
      role="group"
      aria-label="Excerpt of a sample report"
    >
      <p className={styles.sheetHost} translate="no">
        {SAMPLE_HOST}
      </p>
      <p className={styles.sheetMeta}>
        {fetchedLine()} · {checkedIn()}
      </p>

      <div className={styles.verdictBand}>
        <div
          className={styles.ring}
          role="img"
          aria-label={`Overall score ${REPORT.overallScore} out of 100, grade ${REPORT.grade}`}
          style={{ color: `var(--${tone})` }}
        >
          <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="var(--line)"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={offset}
              className="gauge-arc"
              style={
                {
                  "--gauge-circ": CIRC,
                  animationDelay: "700ms",
                } as CSSProperties
              }
            />
          </svg>
          <div className={styles.ringText} aria-hidden="true">
            <span className={styles.ringScore}>{REPORT.overallScore}</span>
            <span className={styles.ringGrade}>Grade {REPORT.grade}</span>
          </div>
        </div>
        <p className={styles.verdictText}>{REPORT.verdict}</p>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Crawler access</p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Bot</th>
              <th scope="col" className={styles.colPurpose}>
                Purpose
              </th>
              <th scope="col">Access</th>
            </tr>
          </thead>
          <tbody>
            {HERO_BOTS.map((bot, i) => (
              <tr key={bot.bot} className={i === 1 ? styles.rowHover : undefined}>
                <td className={styles.botName} translate="no">
                  {bot.bot}
                </td>
                <td className={styles.colPurpose}>{PURPOSE_LABEL[bot.purpose]}</td>
                <td>
                  <span
                    className={`${styles.pill} ${
                      bot.allowed ? styles.pillPass : styles.pillInfo
                    }`}
                  >
                    {bot.allowed ? "Allowed" : "Blocked"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Fix these first</p>
        <ol className={styles.fixList}>
          {fixes.map((fix) => (
            <li key={fix.checkId} className={styles.fixItem}>
              <span className={styles.fixTitle}>{fix.title}</span>
              <span className={`${styles.pill} ${styles.pillAccent}`}>
                {IMPACT[fix.impact]}
              </span>
              <span className={`${styles.pill} ${styles.pillQuiet}`}>
                {EFFORT[fix.effort]}
              </span>
              <span className={styles.pts}>up to +{fix.pointsAvailable} pts</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
