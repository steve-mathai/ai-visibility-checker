import Link from "next/link";
import { UrlForm } from "../UrlForm";
import { HeroFragment } from "./HeroFragment";
import { vars } from "./css";
import styles from "./landing.module.css";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className={styles.frame}>
      <div className={styles.heroGrid}>
        <div className={styles.heroText}>
          <h1 id="hero-title" className={styles.h1}>
            <span className={styles.line}>
              <span className={styles.lineIn} style={vars({ "--i": 0 })}>
                Can AI engines
              </span>
            </span>{" "}
            <span className={styles.line}>
              <span className={styles.lineIn} style={vars({ "--i": 1 })}>
                <span className={styles.cite}>cite</span> your page?
              </span>
            </span>
          </h1>

          <div className={`${styles.explainer} ${styles.heroRise}`}>
            <p>
              Search is turning into answers. ChatGPT, Perplexity and
              Google’s AI Overviews reply directly, and cite only a few
              sources.
            </p>
            <p>
              AEO and GEO are about being one of them. Paste a page to see how
              citable it is and what to fix first.
            </p>
          </div>

          <div id="check" className={`${styles.formWrap} ${styles.heroRise}`}>
            <UrlForm id="url-hero" />
            <p className={styles.formNotes}>
              <span>Free, no sign-up, about five seconds.</span>
              <Link href="/report?demo=1">Or open a sample report</Link>
            </p>
          </div>
        </div>

        <div className={styles.heroStage}>
          <HeroFragment />
        </div>
      </div>
    </section>
  );
}
