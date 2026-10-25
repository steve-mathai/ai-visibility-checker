import Link from "next/link";
import { Container } from "../Container";
import { ArrowRightIcon } from "../Icons";
import { UrlForm } from "../UrlForm";

const EXAMPLES = ["anthropic.com", "stripe.com", "wikipedia.org"];

export function Hero() {
  return (
    <section
      id="check"
      aria-labelledby="hero-title"
      className="border-b border-line bg-surface"
    >
      <Container className="py-14 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
            Free AEO and GEO page check
          </p>
          <h1
            id="hero-title"
            className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl"
          >
            Can AI engines find and cite your page?
          </h1>
          <div className="mx-auto mt-6 max-w-2xl space-y-3 text-lg leading-relaxed text-muted">
            <p>
              Search is turning into answers. ChatGPT, Perplexity and
              Google&rsquo;s AI Overviews now respond directly, and cite only a
              few sources.
            </p>
            <p>
              AEO and GEO (answer and generative engine optimisation) are about
              being one of them. This tool shows how citable your page is, and
              what to fix first.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <UrlForm autoFocus />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
            <span className="text-muted">Try an example:</span>
            {EXAMPLES.map((host) => (
              <Link
                key={host}
                href={`/report?url=${encodeURIComponent(host)}`}
                className="rounded-full border border-line-strong bg-surface px-3 py-1 font-medium hover:bg-surface-2"
              >
                {host}
              </Link>
            ))}
          </div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted">
            <span>Free, no sign-up, about five seconds.</span>
            <Link
              href="/report?demo=1"
              className="inline-flex items-center gap-1 font-medium text-accent underline underline-offset-4"
            >
              See a sample report
              <ArrowRightIcon className="size-4" />
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
