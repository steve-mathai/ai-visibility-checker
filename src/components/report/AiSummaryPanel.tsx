import type { ReactNode } from "react";
import type { AiRewrite, AiSummaryResponse } from "@/lib/audit/types";
import { CopyButton } from "../CopyButton";
import { ArrowRightIcon } from "../Icons";

export type SummaryState =
  | { status: "loading" }
  | { status: "ready"; response: AiSummaryResponse };

const KIND_LABEL: Record<AiRewrite["kind"], string> = {
  title: "Title tag",
  meta_description: "Meta description",
  h1: "Main heading (H1)",
  answer_paragraph: "Opening answer paragraph",
  faq: "FAQ entry",
};

function CardHeading({ children }: { children?: ReactNode }) {
  return (
    <div className="px-5 pb-3 pt-4">
      <h2 id="summary-title" className="text-base font-semibold">
        Plain-English summary
      </h2>
      {children && (
        <p className="mt-1 max-w-[80ch] text-[13px] text-muted">{children}</p>
      )}
    </div>
  );
}

/** Static tone blocks at the size of the text that will replace them. No shimmer, no pulse. */
function Loading() {
  return (
    <section
      id="summary"
      aria-labelledby="summary-title"
      className="card overflow-hidden"
    >
      <CardHeading />
      <div
        role="status"
        aria-live="polite"
        className="border-t border-line px-5 py-4"
      >
        <p className="text-sm font-medium">Writing a plain-English summary…</p>
        <p className="mt-1 text-[13px] text-muted">
          This can take up to 30 seconds. The results above are already
          complete.
        </p>
        <div className="mt-4 space-y-2.5" aria-hidden="true">
          <div className="h-3.5 w-full rounded bg-surface" />
          <div className="h-3.5 w-11/12 rounded bg-surface" />
          <div className="h-3.5 w-3/5 rounded bg-surface" />
        </div>
      </div>
    </section>
  );
}

function RewriteRow({ rewrite }: { rewrite: AiRewrite }) {
  const kind = KIND_LABEL[rewrite.kind];
  return (
    <li className="border-t border-line px-5 py-4 first:border-t-0 print:break-inside-avoid">
      <p className="text-sm font-semibold">{kind}</p>
      <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted">Current</p>
          <p className="mt-0.5 break-words text-sm text-muted">
            {rewrite.current ? rewrite.current : "Nothing found on the page"}
          </p>
        </div>
        <ArrowRightIcon className="mt-6 hidden size-4 text-muted md:block print:hidden" />
        <div className="min-w-0 rounded-lg bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-muted">Suggested</p>
            <CopyButton
              text={rewrite.suggested}
              ariaLabel={`Copy suggested ${kind.toLowerCase()}`}
            />
          </div>
          <p className="mt-0.5 break-words text-sm">{rewrite.suggested}</p>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-muted">
        <span className="font-semibold">Why: </span>
        {rewrite.why}
      </p>
    </li>
  );
}

export function AiSummaryPanel({
  state,
  sample = false,
}: {
  state: SummaryState;
  sample?: boolean;
}) {
  if (state.status === "loading") return <Loading />;

  const { response } = state;

  // Off is not an error: one quiet line, no card, nothing to print.
  if (!response.enabled) {
    const reason = response.reason.trim().replace(/[.\s]+$/, "");
    return (
      <p
        id="summary"
        className="px-1 text-[13px] text-muted print:hidden"
      >
        AI summary is off: {reason}. The results above are complete.
      </p>
    );
  }

  const { result } = response;
  return (
    <section
      id="summary"
      aria-labelledby="summary-title"
      className="card overflow-hidden"
    >
      <CardHeading>
        {sample
          ? "Sample summary, written by hand for this demo."
          : `Written by an AI model (${result.model}) from the results above. Check it before acting on it.`}
      </CardHeading>

      <div className="border-t border-line px-5 py-4">
        <p className="max-w-[72ch] text-[15px] leading-relaxed">
          {result.summary}
        </p>
      </div>

      {result.topActions.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <h3 className="text-sm font-semibold">Do these first</h3>
          <ol className="mt-2 max-w-[72ch] list-decimal space-y-1.5 pl-5 text-sm marker:tabular-nums marker:text-muted">
            {result.topActions.map((action, i) => (
              <li key={i} className="pl-1">
                {action}
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.rewrites.length > 0 && (
        <div className="border-t border-line">
          <h3 className="px-5 pt-4 text-sm font-semibold">Suggested rewrites</h3>
          <ul role="list" className="mt-1 list-none">
            {result.rewrites.map((rewrite, i) => (
              <RewriteRow key={i} rewrite={rewrite} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
