import Link from "next/link";
import { BrandMark } from "./Brand";
import { vars } from "./landing/css";
import styles from "./landing/landing.module.css";
import { SITE } from "./site";

/** The close: two rows of filled tiles, every cell used. */
export function SiteFooter() {
  return (
    <footer
      aria-label="Site"
      data-section
      className={`${styles.frame} ${styles.foot}`}
    >
      <div className={styles.tiles}>
        <div
          className={`${styles.ft} ${styles.ftState}`}
          data-reveal
          style={vars({ "--i": 0 })}
        >
          <p className={styles.ftLead}>
            A free AEO and GEO check, built by {SITE.author}.
          </p>
          <p className={styles.ftSmall}>
            Scores estimate citability from on-page signals.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className={`${styles.ft} ${styles.ftNav}`}
          data-reveal
          style={vars({ "--i": 1 })}
        >
          <ul className={styles.ftLinks}>
            <li>
              <a href="#how" className={styles.ftLink}>
                How it works
              </a>
            </li>
            <li>
              <Link href="/report?demo=1" className={styles.ftLink}>
                Sample report
              </Link>
            </li>
            <li>
              <a href="#checks" className={styles.ftLink}>
                What it checks
              </a>
            </li>
          </ul>
        </nav>

        <div
          className={`${styles.ft} ${styles.ftSrc}`}
          data-reveal
          style={vars({ "--i": 2 })}
        >
          <p className={styles.ftLead}>The code is open.</p>
          {SITE.repoUrl ? (
            <a
              href={SITE.repoUrl}
              rel="noopener"
              className={`${styles.ftLink} ${styles.ftLeadLink}`}
            >
              GitHub
            </a>
          ) : null}
        </div>

        <div
          className={`${styles.ft} ${styles.ftInk}`}
          data-reveal
          style={vars({ "--i": 3 })}
        >
          <p className={styles.ftMark} translate="no">
            <BrandMark on="fg" className={styles.ftMarkIcon} />
            <span>{SITE.name}</span>
          </p>
        </div>

        <a
          href="#check"
          className={`${styles.ft} ${styles.ftCheck}`}
          data-reveal
          style={vars({ "--i": 4 })}
        >
          <span className={styles.ftLead}>Check a page</span>
          <svg
            className={styles.arrow}
            viewBox="0 0 56 56"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="square"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M8 28h38M30 12l16 16-16 16" />
          </svg>
        </a>
      </div>
      <p className={styles.copy}>{SITE.copyright}</p>
    </footer>
  );
}
