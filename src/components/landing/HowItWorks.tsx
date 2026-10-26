"use client";

import { useEffect, useRef, useState } from "react";
import { categoryLabel } from "../categories";
import {
  CATEGORY_ROWS,
  EFFORT,
  IMPACT,
  SAMPLE_HOST,
  TOP_FIX,
  TOP_FIX_EXAMPLE,
  toneOf,
} from "./data";
import { vars } from "./css";
import styles from "./landing.module.css";

const STATEMENTS = [
  {
    title: "Paste a page address.",
    text: "Any public page. We fetch it the way a crawler does, without running JavaScript.",
  },
  {
    title: "Then we read what crawlers read.",
    text: "robots.txt for 14 AI crawlers, the HTML, structured data, llms.txt and the sitemap.",
  },
  {
    title: "Fix the top item first.",
    text: "Each fix is ranked by impact and effort, with a snippet you can paste.",
  },
];

const BAR_CLASS = {
  pass: styles.barPass,
  warn: styles.barWarn,
  fail: styles.barFail,
} as const;

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.copyBtn}
        onClick={() => {
          navigator.clipboard
            ?.writeText(text)
            .then(() => {
              setDone(true);
              window.setTimeout(() => setDone(false), 1800);
            })
            .catch(() => {});
        }}
      >
        {done ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" role="status">
        {done ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}

/**
 * Pinned fragment, changing state. The stage is sticky; three statements
 * scroll past it and an IntersectionObserver moves data-step. No scroll
 * hijacking. Without JavaScript every statement is in ink and the final
 * state shows.
 */
export function HowItWorks() {
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const items = refs.current.filter((el): el is HTMLLIElement => !!el);
    const mq = window.matchMedia("(max-width: 899px)");
    let io: IntersectionObserver | null = null;

    const build = () => {
      io?.disconnect();
      // A thin band across the viewport: the statement crossing it is active.
      // On phones the band sits in the visible area under the sticky stage.
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            setStep(Number((entry.target as HTMLElement).dataset.i));
          }
        },
        {
          rootMargin: mq.matches ? "-72% 0px -26% 0px" : "-49% 0px -49% 0px",
          threshold: 0,
        },
      );
      items.forEach((el) => io?.observe(el));
    };

    build();
    mq.addEventListener("change", build);
    return () => {
      mq.removeEventListener("change", build);
      io?.disconnect();
    };
  }, []);

  return (
    <section
      id="how"
      aria-labelledby="how-title"
      data-section
      data-step={step}
      className={`${styles.frame} ${styles.section} ${styles.how}`}
    >
      <div className={styles.howHead}>
        <h2
          id="how-title"
          className={styles.h2Lead}
          data-reveal
          style={vars({ "--i": 0 })}
        >
          How a check runs
        </h2>
      </div>

      <div
        data-ui
        role="group"
        aria-label="The report at this step"
        className={styles.stage}
        data-reveal
        style={vars({ "--i": 1 })}
      >
        {/* A: the field, filled, button pressed */}
        <div className={`${styles.layer} ${styles.layerA}`}>
          <div className={styles.mini}>
            <span className={styles.miniLabel}>Page address</span>
            <div className={styles.fakeField}>
              <span translate="no">{SAMPLE_HOST}</span>
              <span className={styles.caret} />
            </div>
            <div className={styles.fakeBtn}>Check this page</div>
            <p className={styles.miniNote}>
              Free, no sign-up, about five seconds.
            </p>
          </div>
        </div>

        {/* B: categories filling in */}
        <div className={`${styles.layer} ${styles.layerB}`}>
          <div className={styles.mini}>
            <p className={styles.miniTitle}>Score by category</p>
            {CATEGORY_ROWS.map((row, i) => (
              <div key={row.id} className={styles.barRow}>
                <span className={styles.barLabel}>{row.label}</span>
                <span className={styles.barTrack}>
                  <span
                    className={`${styles.barFill} ${BAR_CLASS[toneOf(row.score)]}`}
                    style={vars({ "--v": row.score / 100, "--i": i })}
                  />
                </span>
                <span className={styles.barVal}>{row.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* C: the top fix */}
        <div className={`${styles.layer} ${styles.layerC}`}>
          <div className={styles.mini}>
            <div className={styles.pillRow}>
              <span className={`${styles.pill} ${styles.pillAccent}`}>
                {IMPACT[TOP_FIX.impact]}
              </span>
              <span className={`${styles.pill} ${styles.pillQuiet}`}>
                {EFFORT[TOP_FIX.effort]}
              </span>
              <span className={`${styles.pill} ${styles.pillQuiet}`}>
                {categoryLabel(TOP_FIX.category)}
              </span>
            </div>
            <p className={styles.miniTitle}>{TOP_FIX.title}</p>
            <p className={styles.fixHow}>{TOP_FIX.why}</p>
            <div className={styles.snip}>
              <p className={styles.snipText}>
                <span className={styles.snipFrom}>{TOP_FIX_EXAMPLE.from}</span>
                <br />
                {TOP_FIX_EXAMPLE.to}
              </p>
              <CopyButton text={TOP_FIX_EXAMPLE.to} />
            </div>
          </div>
        </div>
      </div>

      <ol className={styles.statements}>
        {STATEMENTS.map((s, i) => (
          <li
            key={s.title}
            data-i={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`${styles.st} ${styles[`st${i}` as "st0"]}`}
          >
            <h3 className={styles.stTitle}>{s.title}</h3>
            <p className={styles.stText}>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
