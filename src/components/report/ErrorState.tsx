import Link from "next/link";

interface Copy {
  title: string;
  body: string;
  showServerMessage: boolean;
}

function copyFor(code: string): Copy {
  switch (code) {
    case "invalid_url":
      return {
        title: "That doesn't look like a web address",
        body: "Check for typos. Something like example.com or https://example.com/pricing works.",
        showServerMessage: false,
      };
    case "blocked_host":
      return {
        title: "We can't check that address",
        body: "It points to a private or internal network, which the checker won't fetch. Use the public address of a website.",
        showServerMessage: false,
      };
    case "fetch_failed":
      return {
        title: "We couldn't fetch that page",
        body: "The site may block automated requests, be down, or be too slow to respond. Try again, or check a different page on the same site.",
        showServerMessage: true,
      };
    case "not_html":
      return {
        title: "That address isn't a web page",
        body: "It returned something other than HTML, such as a PDF, an image or a file download. Try the page's main address instead.",
        showServerMessage: false,
      };
    case "network":
      return {
        title: "We couldn't reach the checker",
        body: "The request failed or took too long. Check your connection and try again.",
        showServerMessage: false,
      };
    default:
      return {
        title: "Something went wrong",
        body: "The check didn't complete. Try again in a moment.",
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

  return (
    <div className="mx-auto max-w-xl py-16 sm:py-24">
      <div role="alert" className="card border-fail/40 p-6 sm:p-8">
        <p className="text-sm font-medium text-fail">Check not completed</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {copy.title}
        </h1>
        {target && (
          <p className="mt-2 break-all font-mono text-xs text-muted">{target}</p>
        )}
        <p className="mt-4 text-muted">{copy.body}</p>
        {copy.showServerMessage && message && (
          <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
            <span className="font-medium">Details: </span>
            {message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {onRetry && (
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              Try again
            </button>
          )}
          <Link href="/" className="btn btn-secondary">
            Check a different address
          </Link>
        </div>
      </div>
    </div>
  );
}
