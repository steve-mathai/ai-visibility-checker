"use client";

import { useId, useState, useTransition, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, Spinner } from "./Icons";
import { normaliseUrl } from "./format";

export function UrlForm({
  autoFocus = false,
  initialValue = "",
}: {
  autoFocus?: boolean;
  initialValue?: string;
}) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function validate(raw: string) {
    const result = normaliseUrl(raw);
    setError(result.ok ? null : result.message);
    return result;
  }

  function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validate(value);
    if (!result.ok) return;
    startTransition(() => {
      router.push(`/report?url=${encodeURIComponent(result.url)}`);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <label htmlFor={inputId} className="sr-only">
        Web address of the page to check
      </label>
      <div
        className={`flex flex-col gap-2 rounded-2xl border bg-surface p-2 shadow-sm focus-within:ring-2 focus-within:ring-accent sm:flex-row ${
          error ? "border-fail" : "border-line-strong"
        }`}
      >
        <input
          id={inputId}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="example.com/your-page"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onBlur={() => {
            if (value.trim()) validate(value);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-h-12 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-lg text-fg placeholder:text-muted/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary min-h-12 px-6 text-base"
        >
          {pending ? (
            <>
              <Spinner className="size-4" />
              Opening report
            </>
          ) : (
            <>
              Check this page
              <ArrowRightIcon className="size-4" />
            </>
          )}
        </button>
      </div>
      <p
        id={errorId}
        role="alert"
        className={`mt-2 min-h-6 px-1 text-sm text-fail ${error ? "" : "sr-only"}`}
      >
        {error}
      </p>
    </form>
  );
}
