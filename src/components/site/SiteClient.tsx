"use client";

import { useEffect, useState, useId, useTransition, type SyntheticEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SiteReport } from "@/lib/audit/wide-types";
import { requestSite } from "../compare/api";
import { WideLoading } from "../compare/Loading";
import { Spinner } from "../Icons";
import { hostOf, normaliseUrl } from "../format";
import { Column } from "../report/Column";
import { ErrorState } from "../report/ErrorState";
import { ReportFrame } from "../report/ReportFrame";
import { SiteView } from "./SiteView";

const STEPS = [
  { label: "Reading robots.txt and the sitemap…", startsAtMs: 0 },
  { label: "Choosing a sample of pages…", startsAtMs: 4000 },
  { label: "Checking the sampled pages…", startsAtMs: 8000 },
  { label: "Finding patterns across page types…", startsAtMs: 40000 },
];

type State =
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "done"; report: SiteReport };

/** One site audit request. Remounted (via `key`) to retry. */
function SiteRun({ url, onRetry }: { url: string; onRetry: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    requestSite(url, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(result.ok ? { status: "done", report: result.data } : { status: "error", code: result.code, message: result.message });
    });
    return () => controller.abort();
  }, [url]);

  useEffect(() => {
    document.title = `Auditing ${hostOf(url)} · AI Visibility Checker`;
  }, [url]);

  if (state.status === "done") return <SiteView report={state.report} />;

  return (
    <ReportFrame showShare>
      <Column className="py-12 sm:py-16">
        {state.status === "loading" ? (
          <WideLoading
            title={`Auditing a sample of pages on ${hostOf(url)}…`}
            expectation="This usually takes 20 to 50 seconds. We stop at 55 seconds and show what we have."
            steps={STEPS}
            slowAfterMs={45_000}
            slowNote="Nearly there. We show whatever has finished when the time limit passes…"
          />
        ) : (
          <ErrorState code={state.code} message={state.message} target={url} onRetry={onRetry} />
        )}
      </Column>
    </ReportFrame>
  );
}

function SiteStart() {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = normaliseUrl(value);
    if (!check.ok) {
      setError(check.message);
      document.getElementById(id)?.focus();
      return;
    }
    startTransition(() => router.push(`/site?url=${encodeURIComponent(check.url)}`));
  }

  return (
    <ReportFrame>
      <Column className="py-12 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">Audit a whole site</h1>
          <p className="mb-6 mt-2 text-sm text-muted">
            We read the sitemap, check a spread of 20 to 50 pages, and show which problems repeat and which page types they sit on.
          </p>
          <form onSubmit={onSubmit} noValidate>
            <label htmlFor={id} className="mb-2 block text-small font-medium text-fg">
              Site address
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id={id}
                type="text"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="yourbrand.com…"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-error`}
                className="h-12 w-full min-w-0 shrink-0 sm:w-auto sm:flex-1 rounded-[4px] bg-surface px-3.5 text-fg placeholder:text-muted hover:bg-surface-2 focus:bg-surface focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              />
              <button type="submit" disabled={pending} className="btn btn-primary">
                {pending ? (
                  <>
                    <Spinner className="size-4" />
                    Opening audit…
                  </>
                ) : (
                  "Audit this site"
                )}
              </button>
            </div>
            <p id={`${id}-error`} role="alert" aria-live="polite" className={error ? "mt-2 text-small font-medium text-fail" : "sr-only"}>
              {error}
            </p>
          </form>
        </div>
      </Column>
    </ReportFrame>
  );
}

/** Reads the query string; must be rendered inside a <Suspense> boundary. */
export function SiteClient() {
  const params = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const raw = params.get("url");
  if (!raw || !raw.trim()) return <SiteStart />;

  const check = normaliseUrl(raw);
  if (!check.ok) {
    return (
      <ReportFrame>
        <Column className="py-12 sm:py-16">
          <ErrorState code="invalid_url" message={check.message} target={raw} />
        </Column>
      </ReportFrame>
    );
  }
  return <SiteRun key={`${check.url}#${attempt}`} url={check.url} onRetry={() => setAttempt((n) => n + 1)} />;
}
