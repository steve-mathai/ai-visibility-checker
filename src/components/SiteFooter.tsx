import { Container } from "./Container";
import { SITE } from "./site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <Container className="flex flex-col gap-3 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Built by <span className="font-medium text-fg">{SITE.author}</span>
          {SITE.repoUrl ? (
            <>
              {" · "}
              <a
                href={SITE.repoUrl}
                rel="noopener"
                className="underline underline-offset-4 hover:text-fg"
              >
                Source on GitHub
              </a>
            </>
          ) : null}
        </p>
        <p className="max-w-md sm:text-right">
          Scores estimate citability from on-page signals. They do not measure
          actual citations or guarantee inclusion.
        </p>
      </Container>
    </footer>
  );
}
