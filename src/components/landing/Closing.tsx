import { UrlForm } from "../UrlForm";
import { vars } from "./css";
import styles from "./landing.module.css";

/** The product's check dialog, already open, on the accent field. */
export function Closing() {
  return (
    <section
      aria-labelledby="close-title"
      data-section
      className={`${styles.close} ${styles.section}`}
    >
      <div className={`${styles.frame} ${styles.closeGrid}`}>
        <div className={styles.closeCopy}>
          <h2
            id="close-title"
            className={styles.closeH}
            data-reveal
            style={vars({ "--i": 0 })}
          >
            <span>Check your</span> <span>page.</span>
          </h2>
          <p
            className={styles.closeBody}
            data-reveal
            style={vars({ "--i": 1 })}
          >
            About five seconds. No account. The report gets its own link you
            can share.
          </p>
          <p
            className={styles.closeSmall}
            data-reveal
            style={vars({ "--i": 2 })}
          >
            The score estimates how citable a page is from what’s on it. It
            doesn’t measure actual citations or promise a place in an answer.
          </p>
        </div>

        <div className={styles.closeDialog}>
          <div
            data-ui
            role="group"
            aria-labelledby="dialog-title"
            className={styles.dialog}
            data-reveal
            style={vars({ "--i": 3 })}
          >
            <p id="dialog-title" className={styles.dialogTitle}>
              Check a page
            </p>
            <UrlForm
              id="url-close"
              variant="dialog"
              initialValue="yourbrand.com"
              buttonLabel="Run the check"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
