import Link from "next/link";

interface Copy {
  title: string;
  body: string;
  /** Whether trying the same address again could help. */
  retryable: boolean;
  showServerMessage: boolean;
}

function copyFor(code: string): Copy {
  switch (code) {
    case "invalid_url":
      return {
        title: "That doesn't look like a web address",
        body: "Check for typos. An address like yourbrand.com or https://yourbrand.com/pricing works.",
        retryable: false,
        showServerMessage: false,
      };
    case "blocked_host":
      return {
        title: "We can't check that address",
        body: "It points to a private or internal network, which the checker won't fetch. Use the public address of a website.",
        retryable: false,
        showServerMessage: false,
      };
    case "not_html":
      return {
        title: "That address isn't a web page",
        body: "It returned something other than HTML, such as a PDF, an image or a file download. Try the page's main address instead.",
        retryable: false,
        showServerMessage: false,
      };
    case "fetch_failed":
      return {
        title: "We couldn't fetch that page",
        body: "The site may block automated requests, be down, or be too slow to respond. Try again, or check a different page.",
        retryable: true,
        showServerMessage: true,
      };
    case "network":
      return {
        title: "We couldn't reach the checker",
        body: "The request failed or took too long. Check your connection and try again.",
        retryable: true,
        showServerMessage: false,
      };
    case "rate_limited":
      return {
        title: "Too many checks in a short time",
        body: "Wait a few minutes, then try again. The limit keeps the checker free for everyone.",
        retryable: true,
        showServerMessage: false,
      };
    default:
      return {
        title: "Something went wrong",
        body: "The check didn't complete. Try again in a moment, or check a different page.",
        retryable: true,
        showServerMessage: true,
      };
  }
}

export function ErrorState({
  code,
  message,
  target,
  onRetry,
}: {
  code: string;
  message?: string;
  /** The address that was being checked, if known. */
  target?: string;
  onRetry?: () => void;
}) {
  const copy = copyFor(code);
  const canRetry = copy.retryable && Boolean(onRetry);

  return (
    <div
      role="alert"
      className="card mx-auto w-full max-w-xl p-5 sm:p-6"
    >
      <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
      {target && (
        <p
          translate="no"
          className="mt-1 break-all text-[13px] text-muted"
        >
          {target}
        </p>
      )}
      <p className="mt-3 text-sm">{copy.body}</p>
      {copy.showServerMessage && message && (
        <p className="mt-3 break-words rounded-lg bg-surface p-3 text-[13px] text-muted">
          <span className="font-semibold text-fg">Details: </span>
          {message}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {canRetry && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
            Try again
          </button>
        )}
        <Link
          href="/#check"
          className={`btn btn-sm ${canRetry ? "btn-secondary" : "btn-primary"}`}
        >
          Check a different page
        </Link>
      </div>
    </div>
  );
}
