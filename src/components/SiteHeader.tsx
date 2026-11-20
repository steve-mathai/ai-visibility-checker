import Link from "next/link";
import styles from "./landing/landing.module.css";
import { BrandLogo } from "./Brand";
import { SITE } from "./site";

/** Landing nav: a plain bar, not sticky. The hero holds the action. */
export function SiteHeader() {
  return (
    <header className={styles.frame}>
      <div className={styles.nav}>
        <Link href="/" className={styles.wordmark} translate="no">
          <BrandLogo />
        </Link>
        <nav aria-label="Primary">
          <ul className={styles.navLinks}>
            <li>
              <a href="#how" className={styles.navLink}>
                How it works
              </a>
            </li>
            <li>
              <Link href="/report?demo=1" className={styles.navLink}>
                Sample report
              </Link>
            </li>
            {SITE.repoUrl ? (
              <li>
                <a href={SITE.repoUrl} rel="noopener" className={styles.navLink}>
                  GitHub
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </header>
  );
}
