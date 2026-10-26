import type { ReactNode } from "react";
import type { BotVerdict, CategoryScore } from "@/lib/audit/types";
import { TONE_CLASSES, scoreTone, type Tone } from "../format";
import { PURPOSE_ORDER, checksHash, shortLabel } from "./labels";

function ChartCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="card flex min-w-0 flex-col p-5 print:break-inside-avoid"
    >
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Horizontal bars, one per category, label and weight above, value at the bar end. */
export function CategoryChart({
  categories,
  onOpenCategory,
}: {
  categories: CategoryScore[];
  onOpenCategory: (id: CategoryScore["id"]) => void;
}) {
  return (
    <ChartCard id="chart-categories" title="Score by category">
      <ul
        role="list"
        className="mt-3 flex flex-1 list-none flex-col justify-between gap-1"
      >
        {categories.map((category) => {
          const score = Math.round(category.score);
          const tone = TONE_CLASSES[scoreTone(category.score)];
          return (
            <li key={category.id}>
              <a
                href={`#${checksHash(category.id)}`}
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey
                  ) {
                    return;
                  }
                  event.preventDefault();
                  onOpenCategory(category.id);
                }}
                aria-label={`${shortLabel(category.id)}, weight ${Math.round(category.weight * 100)} percent, score ${score} out of 100. Show its checks.`}
                className="group -mx-2 grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-1.5 hover:bg-surface"
              >
                <span className="col-span-2 text-sm">
                  {shortLabel(category.id)}
                  <span className="text-muted">
                    {" "}
                    · {Math.round(category.weight * 100)}%
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="h-2 overflow-hidden rounded-full bg-surface-2"
                >
                  <span
                    className={`block h-full rounded-full ${tone.bg}`}
                    style={{ width: `${score}%` }}
                  />
                </span>
                <span
                  aria-hidden="true"
                  className="text-right text-sm font-semibold tabular-nums"
                >
                  {score}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

const GROUPS: { purpose: BotVerdict["purpose"]; label: string }[] = [
  { purpose: "answer", label: "Answer bots" },
  { purpose: "search", label: "Search bots" },
  { purpose: "training", label: "Training bots" },
];

/** Allowed of total per purpose, as a filled bar and a count. */
export function CrawlerChart({ bots }: { bots: BotVerdict[] }) {
  const rows = GROUPS.map((group) => {
    const members = bots.filter((b) => b.purpose === group.purpose);
    const allowed = members.filter((b) => b.allowed).length;
    return {
      ...group,
      total: members.length,
      allowed,
      blocked: members.filter((b) => !b.allowed).map((b) => b.bot),
    };
  })
    .filter((row) => row.total > 0)
    .sort((a, b) => PURPOSE_ORDER[a.purpose] - PURPOSE_ORDER[b.purpose]);

  return (
    <ChartCard id="chart-crawlers" title="Crawler access">
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No crawler data was returned for this site.
        </p>
      ) : (
        <ul
          role="list"
          className="mt-3 flex list-none flex-col gap-4"
        >
          {rows.map((row) => {
            // A blocked training bot is a choice, so that bar stays neutral.
            const tone: Tone | "info" =
              row.purpose === "training"
                ? "info"
                : row.allowed === row.total
                  ? "pass"
                  : row.allowed === 0
                    ? "fail"
                    : "warn";
            const fill =
              tone === "info" ? "bg-info" : TONE_CLASSES[tone].bg;
            return (
              <li key={row.purpose}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{row.label}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold">{row.allowed}</span>
                    <span className="text-muted"> of {row.total} allowed</span>
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
                >
                  {row.allowed > 0 && (
                    <div
                      className={`h-full rounded-full ${fill}`}
                      style={{ width: `${(row.allowed / row.total) * 100}%` }}
                    />
                  )}
                </div>
                <p className="mt-1.5 break-words text-[13px] text-muted">
                  {row.blocked.length === 0 ? (
                    "None blocked"
                  ) : (
                    <>
                      Blocked:{" "}
                      <span translate="no">{row.blocked.join(", ")}</span>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-[13px] text-muted">
        Answer bots fetch pages to cite them. Training bots only collect data;
        blocking them is your call.
      </p>
    </ChartCard>
  );
}
