"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SAMPLE_REPORT, SAMPLE_SUMMARY } from "@/dev/sample-report";
import type { AuditReport } from "@/lib/audit/types";
import { requestAudit } from "../api";
import { Container } from "../Container";
import { UrlForm } from "../UrlForm";
import { hostOf, normaliseUrl } from "../format";
import { ErrorState } from "./ErrorState";
import { LoadingSteps } from "./LoadingSteps";
import { ReportView } from "./ReportView";

type AuditState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "done"; report: AuditReport };

/** One audit request. Remounted (via `key`) to retry, so state starts fresh each time. */
function AuditRun({ url, onRetry }: { url: string; onRetry: () => void }) {
  const [state, setState] = useState<AuditState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    requestAudit(url, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(
        result.ok
          ? { status: "done", report: result.report }
          : { status: "error", code: result.code, message: result.message },
      );
    });
    return () => controller.abort();
  }, [url]);

  useEffect(() => {
    document.title = `Checking ${hostOf(url)} · AI Visibility Checker`;
  }, [url]);

  if (state.status === "loading") {
    return (
      <Container>
        <LoadingSteps host={hostOf(url)} />
      </Container>
    );
  }
  if (state.status === "error") {
    return (
      <Container>
        <ErrorState
          code={state.code}
          message={state.message}
          target={url}
          onRetry={onRetry}
        />
      </Container>
    );
  }
  return <ReportView report={state.report} />;
}

function AuditRunner({ url }: { url: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <AuditRun
      key={`${url}#${attempt}`}
      url={url}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

function MissingUrl() {
  return (
    <Container>
      <div className="mx-auto max-w-2xl py-16 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight">
          Which page should we check?
        </h1>
        <p className="mb-6 mt-2 text-muted">
          This link has no web address in it. Enter one below.
        </p>
        <UrlForm autoFocus />
      </div>
    </Container>
  );
}

/** Reads the query string; must be rendered inside a <Suspense> boundary. */
export function ReportClient() {
  const params = useSearchParams();

  if (params.get("demo") === "1") {
    return <ReportView report={SAMPLE_REPORT} sampleSummary={SAMPLE_SUMMARY} />;
  }

  const rawUrl = params.get("url");
  if (!rawUrl || !rawUrl.trim()) return <MissingUrl />;

  const check = normaliseUrl(rawUrl);
  if (!check.ok) {
    return (
      <Container>
        <ErrorState code="invalid_url" message={check.message} target={rawUrl} />
      </Container>
    );
  }
  return <AuditRunner url={check.url} />;
}
