"use client";

import { useId, useState, useTransition, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../Icons";
import { normaliseUrl } from "../format";

const MIN_SITES = 2;
const MAX_SITES = 4;

/** 2 to 4 address fields. Submitting goes to /compare?u=...&u=..., which is the shareable form of the result. */
export function CompareForm({ initial = [] }: { initial?: string[] }) {
  const router = useRouter();
  const baseId = useId();
  const [values, setValues] = useState<string[]>(() => {
    const start = initial.slice(0, MAX_SITES);
    while (start.length < MIN_SITES) start.push("");
    return start;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fieldId = (i: number) => `${baseId}-site-${i}`;
  const errorId = `${baseId}-error`;

  function setValue(index: number, value: string) {
    setValues((current) => current.map((v, i) => (i === index ? value : v)));
    if (error) setError(null);
  }

  function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const urls: string[] = [];
    for (let i = 0; i < values.length; i++) {
      if (!values[i].trim()) continue;
      const check = normaliseUrl(values[i]);
      if (!check.ok) {
        setError(`Site ${i + 1}: ${check.message}`);
        document.getElementById(fieldId(i))?.focus();
        return;
      }
      urls.push(check.url);
    }
    if (new Set(urls).size < MIN_SITES) {
      setError("Enter at least two different web addresses to compare.");
      document.getElementById(fieldId(0))?.focus();
      return;
    }
    const query = [...new Set(urls)].map((u) => `u=${encodeURIComponent(u)}`).join("&");
    startTransition(() => router.push(`/compare?${query}`));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <ul className="list-none space-y-4">
        {values.map((value, i) => (
          <li key={i}>
            <label htmlFor={fieldId(i)} className="mb-2 block text-small font-medium text-fg">
              Site {i + 1}
            </label>
            <div className="flex gap-2">
              <input
                id={fieldId(i)}
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={i === 0 ? "yourbrand.com" : "competitor.com…"}
                value={value}
                onChange={(e) => setValue(i, e.target.value)}
                aria-describedby={error ? errorId : undefined}
                className="h-12 min-w-0 flex-1 rounded-[4px] bg-surface px-3.5 text-fg placeholder:text-muted hover:bg-surface-2 focus:bg-surface focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              />
              {i >= MIN_SITES && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label={`Remove site ${i + 1}`}
                  onClick={() => setValues((current) => current.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? (
            <>
              <Spinner className="size-4" />
              Opening comparison…
            </>
          ) : (
            "Compare these sites"
          )}
        </button>
        {values.length < MAX_SITES && (
          <button type="button" className="btn btn-secondary" onClick={() => setValues((current) => [...current, ""])}>
            Add another site
          </button>
        )}
      </div>
      <p id={errorId} role="alert" aria-live="polite" className={error ? "mt-3 text-small font-medium text-fail" : "sr-only"}>
        {error}
      </p>
    </form>
  );
}
