"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { CompareItem } from "@/lib/audit/wide-types";
import { hostOf, normaliseUrl } from "../format";
import { Column } from "../report/Column";
import { ErrorState } from "../report/ErrorState";
import { ReportFrame } from "../report/ReportFrame";
import { requestCompare } from "./api";
import { CompareForm } from "./CompareForm";
import { CompareTable } from "./CompareTable";
import { WideLoading } from "./Loading";
import { WideFooter } from "./WideFooter";

const MAX_SITES = 4;

const STEPS = [
  { label: "Fetching each page…", startsAtMs: 0 },
  { label: "Reading robots.txt for each site…", startsAtMs: 2500 },
  { label: "Scoring every page…", startsAtMs: 6000 },
  { label: "Building the comparison…", startsAtMs: 10000 },
];

type State =
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "done"; items: CompareItem[] };

/** One comparison request. Remounted (via `key`) to retry. */
function CompareRun({ urls, onRetry }: { urls: string[]; onRetry: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    requestCompare(urls, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(result.ok ? { status: "done", items: result.data.results } : { status: "error", code: result.code, message: result.message });
    });
    return () => controller.abort();
  }, [urls]);

  useEffect(() => {
    document.title = `Comparing ${urls.map(hostOf).join(", ")} · AI Visibility Checker`;
  }, [urls]);

  return (
    <ReportFrame showShare>
      <Column className="py-12 sm:py-16">
        {state.status === "loading" && (
          <WideLoading
            title={`Comparing ${urls.length} sites…`}
            expectation="This usually takes 5 to 20 seconds."
            steps={STEPS}
            slowAfterMs={20_000}
            slowNote="Still working. Some sites respond slowly, and we wait for them…"
          />
        )}
        {state.status === "error" && <ErrorState code={state.code} message={state.message} onRetry={onRetry} />}
        {state.status === "done" && <CompareResult items={state.items} />}
      </Column>
    </ReportFrame>
  );
}

function CompareResult({ items }: { items: CompareItem[] }) {
  const failed = items.filter((i) => !i.ok).length;
  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold leading-8 tracking-tight">Comparison</h1>
        <p className="mt-1 text-[13px] leading-5 text-muted">
          {items.length} sites checked
          {failed > 0 ? `, ${failed} could not be read` : ""}.{" "}
          <Link href="/compare" className="text-accent underline underline-offset-4 hover:text-accent-hover">
            Compare different sites
          </Link>
        </p>
      </header>
      <CompareTable items={items} />
      <WideFooter note="Scores estimate how citable each page is from what is on it. They do not measure actual citations or promise a place in an answer." />
    </div>
  );
}

function CompareStart({ initial }: { initial: string[] }) {
  return (
    <ReportFrame>
      <Column className="py-12 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">Compare sites</h1>
          <p className="mb-6 mt-2 text-sm text-muted">
            Enter two to four pages, yours and your competitors. We check each one the same way and put the results side by side.
          </p>
          <CompareForm initial={initial} />
        </div>
      </Column>
    </ReportFrame>
  );
}

/** Reads the query string; must be rendered inside a <Suspense> boundary. */
export function CompareClient() {
  const params = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const raw = params.getAll("u").map((u) => u.trim()).filter(Boolean);
  const rawKey = raw.join("\n");

  const checked = useMemo(() => rawKey.split("\n").filter(Boolean).slice(0, MAX_SITES + 1).map((u) => ({ u, check: normaliseUrl(u) })), [rawKey]);
  const urls = useMemo(() => [...new Set(checked.flatMap((c) => (c.check.ok ? [c.check.url] : [])))], [checked]);

  if (raw.length === 0 || (raw.length === 1 && checked[0]?.check.ok)) {
    return <CompareStart initial={checked.map((c) => c.u)} />;
  }
  const bad = checked.find((c) => !c.check.ok);
  if (bad || checked.length > MAX_SITES || urls.length < 2) {
    return (
      <ReportFrame>
        <Column className="py-12 sm:py-16">
          <ErrorState
            code="invalid_url"
            message={bad && !bad.check.ok ? bad.check.message : "A comparison needs two to four different addresses."}
            target={bad?.u}
          />
        </Column>
      </ReportFrame>
    );
  }
  return <CompareRun key={`${urls.join("|")}#${attempt}`} urls={urls} onRetry={() => setAttempt((n) => n + 1)} />;
}
