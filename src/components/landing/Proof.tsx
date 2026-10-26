import Link from "next/link";
import { PROOF, toneOf } from "./data";
import { vars } from "./css";
import styles from "./landing.module.css";

const GRADE_CLASS = {
  pass: styles.gradepass,
  warn: styles.gradewarn,
  fail: styles.gradefail,
} as const;

/** Host with a break opportunity after each dot and slash, never inside a word. */
function HostPath({ path }: { path: string }) {
  const parts = path.split(/(?<=[./])/);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 ? <wbr /> : null}
        </span>
      ))}
    </>
  );
}

/** Real pages, checked: a board of filled tiles, each re-running its check. */
export function Proof() {
  return (
    <section
      id="proof"
      aria-labelledby="proof-title"
      data-section
      className={`${styles.frame} ${styles.section}`}
    >
      <ul className={styles.board}>
        <li
          className={`${styles.cell} ${styles.cellHead}`}
          data-reveal
          style={vars({ "--i": 0 })}
        >
          <div className={`${styles.tile} ${styles.tileHead}`}>
            <h2 id="proof-title" className={styles.h2Head}>
              Real pages, checked
            </h2>
          </div>
        </li>
        {PROOF.map((p, i) => {
          return (
            <li
              key={p.path}
              className={styles.cell}
              data-reveal
              style={vars({ "--i": i + 1 })}
            >
              <Link
                href={`/report?url=${encodeURIComponent(p.url)}`}
                className={styles.tile}
              >
                <span className={styles.host} translate="no">
                  <HostPath path={p.path} />
                </span>
                <span className={styles.tileBottom}>
                  <span className={styles.scoreRow}>
                    <span className={styles.score}>{p.score}</span>
                    <span
                      className={`${styles.grade} ${GRADE_CLASS[toneOf(p.score)]}`}
                    >
                      {p.grade}
                    </span>
                    {p.capped ? (
                      <span className={styles.capped}>capped</span>
                    ) : null}
                  </span>
                  <span className={styles.tileLine}>
                    {p.line}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p
        className={styles.dateNote}
        data-reveal
        style={vars({ "--i": PROOF.length + 1 })}
      >
        Checked on 25 October 2026. Scores change when sites change; each tile
        re-runs the check now.
      </p>
    </section>
  );
}
