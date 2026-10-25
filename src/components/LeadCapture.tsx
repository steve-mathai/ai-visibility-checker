"use client";

import { useId, useState, type SyntheticEvent } from "react";

/**
 * Lead-magnet call to action.
 *
 * v1 has no backend for this: submitting shows an honest demo message and the
 * address is not sent or stored anywhere. To connect it to a CRM, pass an
 * `onSubmit` that posts the email (and `context`, e.g. the audited URL) to
 * your endpoint and throws on failure.
 */
export function LeadCapture({
  context,
  onSubmit,
}: {
  /** What was being checked, for the CRM record once this is wired up. */
  context?: string;
  onSubmit?: (email: string, context?: string) => Promise<void>;
}) {
  const inputId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setError("Enter a valid email address, for example name@company.com.");
      return;
    }
    setError(null);
    if (onSubmit) {
      setBusy(true);
      try {
        await onSubmit(trimmed, context);
      } catch {
        setError("Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setDone(true);
  }

  return (
    <section
      aria-labelledby="lead-title"
      className="rounded-2xl border border-line bg-accent-soft p-6 sm:p-8"
    >
      <div className="grid gap-6 md:grid-cols-2 md:items-center">
        <div>
          <h2
            id="lead-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Want this re-checked every month?
          </h2>
          <p className="mt-2 text-muted">
            Scores move when sites change. A monthly re-check would flag
            regressions, such as a new robots.txt rule or a lost schema block,
            before they cost you citations.
          </p>
        </div>

        <div aria-live="polite">
          {done ? (
            <p className="rounded-xl border border-line bg-surface p-4 text-sm">
              Thanks &mdash; this is a demo; email capture isn&rsquo;t wired up
              in v1.
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor={inputId} className="block text-sm font-medium">
                Work email
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id={inputId}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-base placeholder:text-muted/70"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="btn btn-primary min-h-11"
                >
                  Remind me monthly
                </button>
              </div>
              {error && (
                <p id={errorId} role="alert" className="mt-2 text-sm text-fail">
                  {error}
                </p>
              )}
              <p className="mt-2 text-xs text-muted">
                Demo only in v1. Nothing is sent or stored.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
