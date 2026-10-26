"use client";

import { useState } from "react";
import { vars } from "./css";
import styles from "./landing.module.css";

/**
 * One robots.txt line as a working switch. The control is built in em units
 * and scaled by the font size of its root; flipping it swaps the field
 * between two palette colours and the verdict line.
 */
export function Switch() {
  const [allowed, setAllowed] = useState(true);

  return (
    <section
      aria-labelledby="switch-title"
      data-section
      data-allowed={allowed ? "true" : "false"}
      className={`${styles.sw} ${styles.section}`}
    >
      <div className={styles.swField} aria-hidden="true" />

      <div className={`${styles.frame} ${styles.swCopy}`}>
        <h2
          id="switch-title"
          className={styles.h2Head}
          data-reveal
          style={vars({ "--i": 0 })}
        >
          One line decides it.
        </h2>
        <p
          className={styles.verdict}
          aria-live="polite"
          data-reveal
          style={vars({ "--i": 1 })}
        >
          {allowed
            ? "Perplexity can fetch this page and cite it."
            : "Perplexity can’t fetch this page, so it can’t cite it."}
        </p>
        <p
          className={styles.swSentence}
          data-reveal
          style={vars({ "--i": 2 })}
        >
          A single robots.txt rule lets PerplexityBot in or keeps it out. Flip
          it and see what changes for your citations.
        </p>
      </div>

      <div
        data-ui
        className={styles.swCtl}
        data-reveal
        style={vars({ "--i": 3 })}
      >
        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          className={styles.swBtn}
          onClick={() => setAllowed((v) => !v)}
        >
          <span className={styles.swHead}>
            <span translate="no">PerplexityBot</span>
            <span
              key={allowed ? "on" : "off"}
              className={styles.swState}
              aria-hidden="true"
            >
              {allowed ? "Allowed" : "Blocked"}
            </span>
          </span>
          <span className={styles.track}>
            <span className={styles.thumb}>
              <span className={styles.thumbOn} />
            </span>
          </span>
        </button>
        <pre className={styles.code} translate="no">
          <code>
            <span className={styles.codeLine}>User-agent: PerplexityBot</span>
            <span key={allowed ? "allow" : "disallow"} className={styles.codeKey}>
              {allowed ? "Allow: /" : "Disallow: /"}
            </span>
          </code>
        </pre>
      </div>
    </section>
  );
}
