/**
 * Single place for the site's identity. Fill in `author` (and `repoUrl`, if the
 * code is public) before publishing; the footer and metadata read from here.
 */
export const SITE = {
  name: "AI Visibility Checker",
  /** Shown in the footer as "Built by ...". */
  author: "Steve Mathew",
  /** Link to the repository, or leave empty to hide the link. */
  repoUrl: "https://github.com/steve-mathai/ai-visibility-checker",
  description:
    "Paste a web address and see how likely ChatGPT, Perplexity, Google AI Overviews and Claude are to find and cite that page, with a ranked list of fixes.",
} as const;
