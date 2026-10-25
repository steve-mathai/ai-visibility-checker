import { CATEGORIES } from "../categories";
import { Container } from "../Container";
import { CategoryIcon } from "../Icons";

export function WhatWeCheck() {
  return (
    <section aria-labelledby="what-title" className="py-16 sm:py-20">
      <Container>
        <div className="max-w-2xl">
          <h2
            id="what-title"
            className="text-3xl font-semibold tracking-tight"
          >
            What we check
          </h2>
          <p className="mt-3 text-lg text-muted">
            Five areas, each made of specific checks you can verify yourself.
            Nothing here is a guess about a secret ranking algorithm.
          </p>
        </div>

        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <li key={cat.id} className="card flex flex-col p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <CategoryIcon id={cat.id} />
                </span>
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
                  {cat.weightPct}% of score
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{cat.label}</h3>
              <p className="mt-1 text-sm text-muted">{cat.summary}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {cat.examples.map((example) => (
                  <li key={example} className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
                    />
                    <span>{example}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          <li className="flex flex-col rounded-2xl border border-dashed border-line-strong p-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-fg">
              <CategoryIcon id="fixes" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">A fix for every miss</h3>
            <p className="mt-1 text-sm text-muted">
              Each failed check comes with why it matters, what to do, and a
              paste-ready snippet where one helps: robots.txt lines, JSON-LD,
              a rewritten title.
            </p>
          </li>
        </ul>
      </Container>
    </section>
  );
}
