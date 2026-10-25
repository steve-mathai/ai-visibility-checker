import type { AiSummary, AuditReport } from "@/lib/audit/types";
import sample from "./sample-report.json";

/**
 * The sample report at /report?demo=1. The JSON is produced by the real engine
 * from a fictional page (scripts/generate-sample.ts), so it always matches what
 * a live audit returns. Regenerate it after changing any check.
 */
export const SAMPLE_REPORT = sample as AuditReport;

/** Hand-written stand-in for the AI summary, which needs an API key to generate. */
export const SAMPLE_SUMMARY: AiSummary = {
  summary:
    "Brightside Dental is easy for AI engines to reach: the answer and search bots are allowed, the page is indexable and the text is in the HTML. The blocked bots (GPTBot, CCBot and Google-Extended) only collect training data, so they do not stop the practice being cited. The gaps are in how the page answers questions. The opening paragraph is a welcome message instead of a plain statement of what the practice does, the section headings are labels rather than the questions patients ask, and nothing links the business to its Google Business Profile or Yelp listing. None of these is hard to fix.",
  topActions: [
    "Rename two or three section headings as patient questions, such as \"How much does a cleaning cost without insurance?\"",
    "Rewrite the opening paragraph as a two-sentence answer: what you offer, where, and for whom.",
    "Add sameAs links to the Dentist markup for your Google Business Profile, Yelp and Facebook pages.",
  ],
  rewrites: [
    {
      kind: "answer_paragraph",
      current:
        "Welcome to Brightside Dental, where your smile is our passion. Our friendly team has served South Austin families for over a decade...",
      suggested:
        "Brightside Dental is a family dental practice on South Lamar in Austin, Texas. We offer cleanings, fillings, crowns, Invisalign and emergency appointments for adults and children, and we accept most major PPO insurance plans.",
      why: "It answers who, what and where in the first two sentences, which makes it a passage an engine can quote on its own.",
    },
    {
      kind: "meta_description",
      current:
        "Welcome to Brightside Dental, Austin's friendliest family dental practice. We offer a full range of general, cosmetic and emergency dental services for the whole family, and we would love to meet you.",
      suggested:
        "Family dentist on South Lamar, Austin. Cleanings, fillings, crowns and Invisalign for adults and children. Same-week appointments, most PPO plans accepted.",
      why: "It fits within 160 characters, so it will not be cut off, and it leads with the facts people search for.",
    },
    {
      kind: "faq",
      current: "Pricing",
      suggested: "How much does a dental visit cost with or without insurance?",
      why: "A heading phrased the way patients ask makes the section below it a natural match for that question in an AI answer.",
    },
  ],
  model: "sample",
};
