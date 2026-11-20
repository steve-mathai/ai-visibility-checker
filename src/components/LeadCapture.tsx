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
  const noteId = useId();
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
      className="card grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start md:gap-8"
    >
      <div>
        <h2 id="lead-title" className="text-base font-semibold">
          Re-check this page every month
        </h2>
        <p className="mt-1 max-w-[56ch] text-[13px] text-muted">
          Scores move when a site changes: a new robots.txt rule, a lost
          structured-data block. A monthly reminder tells you when to run the
          check again.
        </p>
      </div>

      <div aria-live="polite">
        {done ? (
          <p className="rounded-lg bg-surface px-3 py-2.5 text-[13px]">
            Thanks. This is a demo, so nothing was sent or stored.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor={inputId} className="block text-[13px] font-medium">
              Email address
            </label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input
                id={inputId}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="name@company.com…"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${errorId} ${noteId}` : noteId}
                className="h-12 min-w-0 sm:h-8 sm:flex-1 rounded border border-line-strong bg-raised px-3 text-base text-fg sm:text-sm placeholder:text-muted focus-visible:outline-offset-0"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn btn-primary btn-sm shrink-0 max-sm:min-h-12 max-sm:w-full"
              >
                {busy ? "Saving…" : "Remind me monthly"}
              </button>
            </div>
            {error && (
              <p id={errorId} role="alert" className="mt-1.5 text-[13px] text-fail">
                {error}
              </p>
            )}
            <p id={noteId} className="mt-1.5 text-[13px] text-muted">
              Demo only: nothing is sent or stored.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
