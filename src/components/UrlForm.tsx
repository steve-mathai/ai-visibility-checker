"use client";

import { useId, useState, useTransition, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "./Icons";
import { normaliseUrl } from "./format";

type Variant = "hero" | "dialog";

// Static class strings so Tailwind can see them.
const FIELD: Record<Variant, string> = {
  hero: "h-14 w-full shrink-0 sm:w-auto sm:flex-1 rounded-[4px] bg-surface px-4 text-body hover:bg-surface-2 focus:bg-surface",
  dialog:
    "h-12 w-full shrink-0 rounded-lg border border-line-strong bg-canvas px-3.5 text-body",
};

const BUTTON: Record<Variant, string> = {
  hero: "h-14 px-7 sm:shrink-0",
  dialog: "h-[52px] w-full",
};

/**
 * One field, one button. Accepts bare domains and full URLs, validates inline,
 * then goes to /report?url=<encoded>. Used by the landing hero, the closing
 * dialog and the report page's "no address" state.
 */
export function UrlForm({
  autoFocus = false,
  initialValue = "",
  id,
  variant = "hero",
  buttonLabel = "Check this page",
  label = "Page address",
  placeholder = "yourbrand.com/pricing…",
}: {
  autoFocus?: boolean;
  initialValue?: string;
  /** Id for the input, so other links can focus it. */
  id?: string;
  variant?: Variant;
  buttonLabel?: string;
  label?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
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
    if (!result.ok) {
      document.getElementById(inputId)?.focus();
      return;
    }
    startTransition(() => {
      router.push(`/report?url=${encodeURIComponent(result.url)}`);
    });
  }

  const stacked = variant === "dialog";

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <label
        htmlFor={inputId}
        className="mb-2 block text-small font-medium text-fg"
      >
        {label}
      </label>
      <div className={stacked ? "flex flex-col gap-3" : "flex flex-col gap-3 sm:flex-row"}>
        <input
          id={inputId}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={placeholder}
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
          className={`min-w-0 text-fg placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-accent ${FIELD[variant]} ${
            error ? "outline-2 outline-offset-2 outline-fail" : ""
          }`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`btn btn-primary ${BUTTON[variant]}`}
        >
          {pending ? (
            <>
              <Spinner className="size-4" />
              Opening report…
            </>
          ) : (
            buttonLabel
          )}
        </button>
      </div>
      <p
        id={errorId}
        role="alert"
        aria-live="polite"
        className={error ? "mt-2 text-small font-medium text-fail" : "sr-only"}
      >
        {error}
      </p>
    </form>
  );
}
