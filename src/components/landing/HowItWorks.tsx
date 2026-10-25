import Link from "next/link";
import { WEIGHTS_BY_SIZE } from "../categories";
import { Container } from "../Container";

const SEGMENT_CLASSES = [
  "bg-accent",
  "bg-accent/80",
  "bg-accent/60",
  "bg-accent/45",
  "bg-accent/30",
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="border-y border-line bg-surface py-16 sm:py-20"
    >
      <Container>
        <div className="max-w-2xl">
          <h2 id="how-title" className="text-3xl font-semibold tracking-tight">
            How the score works
          </h2>
          <p className="mt-3 text-lg text-muted">
            A weighted total out of 100, with a few hard limits for problems
            that make everything else irrelevant.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <div className="card p-6">
            <h3 className="text-lg font-semibold">Weighted categories</h3>
            <p className="mt-1 text-sm text-muted">
              Access matters most, because a page that can&rsquo;t be read
              can&rsquo;t be cited.
            </p>
            <div
              className="mt-5 flex h-3 overflow-hidden rounded-full bg-surface-2"
              role="img"
              aria-label={WEIGHTS_BY_SIZE.map((w) => `${w.label} ${w.pct}%`).join(
                ", ",
              )}
            >
              {WEIGHTS_BY_SIZE.map((w, i) => (
                <div
                  key={w.label}
                  className={SEGMENT_CLASSES[i]}
                  style={{ width: `${w.pct}%` }}
                />
              ))}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {WEIGHTS_BY_SIZE.map((w, i) => (
                <li key={w.label} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2.5 rounded-sm ${SEGMENT_CLASSES[i]}`}
                  />
                  <span className="flex-1">{w.label}</span>
                  <span className="font-medium tabular-nums">{w.pct}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold">Hard caps for blockers</h3>
            <p className="mt-1 text-sm text-muted">
              Some problems limit the overall score however good the rest is.
              When that happens, the report says so.
            </p>
            <ul className="mt-5 space-y-3 text-sm">
              <li>
                <span className="font-medium">noindex.</span> The page tells
                engines not to index it.
              </li>
              <li>
                <span className="font-medium">Blocked crawlers.</span>{" "}
                robots.txt shuts out the bots that fetch pages for live
                answers.
              </li>
              <li>
                <span className="font-medium">JavaScript-only pages.</span> The
                text isn&rsquo;t in the HTML, so most AI crawlers see an empty
                page.
              </li>
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold">Fixes ranked by impact</h3>
            <p className="mt-1 text-sm text-muted">
              Every fix is rated for how much it should help and how much work
              it takes, then sorted so the best return comes first.
            </p>
            <p className="mt-5 text-sm">
              <span className="font-medium">impact &times; effort</span> decides
              the order. A ten-minute robots.txt change beats a site rebuild
              that moves the score by the same amount.
            </p>
            <Link
              href="/report?demo=1"
              className="mt-4 inline-block text-sm font-medium text-accent underline underline-offset-4"
            >
              See the fix list in a sample report
            </Link>
          </div>
        </div>

        <aside
          aria-labelledby="honest-title"
          className="mt-8 rounded-2xl border border-line-strong bg-surface-2 p-6"
        >
          <h3 id="honest-title" className="font-semibold">
            What this score is, and is not
          </h3>
          <p className="mt-2 max-w-3xl text-muted">
            The score estimates how citable a page is from signals on the page
            itself. It does not measure whether ChatGPT, Perplexity or Google
            cite you today, and no tool can promise that a fix gets you into an
            answer. Treat it as a checklist of things that stand in the way,
            not a prediction.
          </p>
        </aside>
      </Container>
    </section>
  );
}
