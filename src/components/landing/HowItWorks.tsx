"use client";

import { useEffect, useRef, useState } from "react";
import { ImpactBadge, EffortBadge } from "../Badges";
import { CopyButton } from "../CopyButton";
import { ChevronIcon } from "../Icons";
import {
  CATEGORY_ROWS,
  FIX_ROWS,
  REPORT,
  SAMPLE_HOST,
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

/**
 * Pinned fragment, changing state. The stage is sticky; three statements
 * scroll past it and an IntersectionObserver moves data-step. No scroll
 * hijacking. Without JavaScript every statement is in ink and the final
 * state shows.
 */
export function HowItWorks() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(0);
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

        {/* C: the ranked fix list, as the report shows it */}
        <div className={`${styles.layer} ${styles.layerC}`}>
          <div className={styles.mini}>
            <div className={styles.fixHead}>
              <p className={styles.miniTitle}>Fix these first</p>
              <p className={styles.fixCount}>{REPORT.fixes.length} fixes</p>
            </div>
            <ol role="list" className={styles.fixRanked}>
              {FIX_ROWS.map((fix, i) => {
                const isOpen = open === i;
                const bodyId = `how-fix-${i}`;
                return (
                  <li key={fix.checkId} className={styles.fixItem}>
                    <h3 className={styles.fixH}>
                      <button
                        type="button"
                        className={styles.fixBtn}
                        aria-expanded={isOpen}
                        aria-controls={bodyId}
                        onClick={() => setOpen(isOpen ? -1 : i)}
                      >
                        <span className={styles.rank} aria-hidden="true">
                          {i + 1}
                        </span>
                        <span className={styles.fixMain}>
                          <span className={styles.fixTitle}>{fix.title}</span>
                          <span className={styles.fixMeta}>
                            <ImpactBadge impact={fix.impact} />
                            <EffortBadge effort={fix.effort} />
                          </span>
                        </span>
                        <ChevronIcon
                          className={`${styles.chev} ${isOpen ? "" : styles.chevShut}`}
                        />
                      </button>
                    </h3>
                    <div id={bodyId} className={styles.fixBody} hidden={!isOpen}>
                      {i === 0 && (
                        <div className={styles.snip}>
                          <p className={styles.snipText}>
                            <span className={styles.snipFrom}>
                              {TOP_FIX_EXAMPLE.from}
                            </span>
                            <br />
                            {TOP_FIX_EXAMPLE.to}
                          </p>
                          <CopyButton
                            text={TOP_FIX_EXAMPLE.to}
                            ariaLabel={`Copy snippet for: ${fix.title}`}
                            compact
                          />
                        </div>
                      )}
                      {i !== 0 && fix.snippet && (
                        <div className={styles.snip}>
                          <pre className={styles.snipCode} translate="no">
                            <code>{fix.snippet}</code>
                          </pre>
                          <CopyButton
                            text={fix.snippet}
                            ariaLabel={`Copy snippet for: ${fix.title}`}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
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
