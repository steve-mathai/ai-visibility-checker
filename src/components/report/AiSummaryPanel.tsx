import type { AiRewrite, AiSummaryResponse } from "@/lib/audit/types";
import { CopyButton } from "../CopyButton";

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

function Skeleton() {
  return (
    <div role="status" aria-live="polite" className="p-5 sm:p-6">
      <p className="font-medium">Writing a plain-English summary&hellip;</p>
      <p className="mt-1 text-sm text-muted">
        This can take up to 30 seconds. The results above are already complete.
      </p>
      <div className="mt-5 space-y-3" aria-hidden="true">
        <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 h-20 w-full animate-pulse rounded-xl bg-surface-2" />
      </div>
    </div>
  );
}

function RewriteCard({ rewrite }: { rewrite: AiRewrite }) {
  return (
    <li className="rounded-xl border border-line p-4">
      <p className="text-sm font-semibold">{KIND_LABEL[rewrite.kind]}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="min-w-0 rounded-lg bg-surface-2 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Current
          </p>
          <p className="mt-1 break-words text-sm">
            {rewrite.current ? (
              rewrite.current
            ) : (
              <span className="text-muted">Nothing found on the page</span>
            )}
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-accent/40 bg-accent-soft p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              Suggested
            </p>
            <CopyButton
              text={rewrite.suggested}
              ariaLabel={`Copy suggested ${KIND_LABEL[rewrite.kind].toLowerCase()}`}
            />
          </div>
          <p className="mt-1 break-words text-sm">{rewrite.suggested}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        <span className="font-medium text-fg">Why: </span>
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
  if (state.status === "loading") {
    return (
      <div className="card">
        <Skeleton />
      </div>
    );
  }

  const { response } = state;

  if (!response.enabled) {
    const reason = response.reason.trim().replace(/[.\s]+$/, "");
    return (
      <p className="rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted">
        AI summary is off: {reason}. The rule-based results above are
        complete.
      </p>
    );
  }

  const { result } = response;
  return (
    <div className="card p-5 sm:p-6">
      <p className="text-xs text-muted">
        {sample
          ? "Sample summary, written by hand for this demo."
          : `Written by an AI model (${result.model}) from the results above. Check it before acting on it.`}
      </p>
      <p className="mt-3 text-base leading-relaxed">{result.summary}</p>

      {result.topActions.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold">Do these first</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm marker:font-semibold marker:text-accent">
            {result.topActions.map((action, i) => (
              <li key={i} className="pl-1">
                {action}
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.rewrites.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold">Suggested rewrites</h3>
          <ul className="mt-3 space-y-3">
            {result.rewrites.map((rewrite, i) => (
              <RewriteCard key={i} rewrite={rewrite} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
