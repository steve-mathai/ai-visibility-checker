import type { BotVerdict } from "@/lib/audit/types";
import { CheckIcon, CrossIcon } from "../Icons";

const PURPOSE_ORDER: Record<BotVerdict["purpose"], number> = {
  answer: 0,
  search: 1,
  training: 2,
};

const PURPOSE_LABEL: Record<BotVerdict["purpose"], string> = {
  answer: "Answer",
  search: "Search",
  training: "Training",
};

function Verdict({ bot }: { bot: BotVerdict }) {
  if (bot.allowed) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-pass">
        <CheckIcon className="size-4" />
        Allowed
      </span>
    );
  }
  // A blocked training bot is a legitimate choice, so it is not drawn as an alarm.
  const tone = bot.purpose === "training" ? "text-muted" : "text-fail";
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${tone}`}>
      <CrossIcon className="size-4" />
      Blocked
    </span>
  );
}

export function BotTable({ bots }: { bots: BotVerdict[] }) {
  if (bots.length === 0) {
    return (
      <p className="card p-6 text-muted">
        No crawler data was returned for this site.
      </p>
    );
  }

  const sorted = [...bots].sort(
    (a, b) =>
      PURPOSE_ORDER[a.purpose] - PURPOSE_ORDER[b.purpose] ||
      a.bot.localeCompare(b.bot),
  );
  const allowedCount = bots.filter((b) => b.allowed).length;

  return (
    <div className="card overflow-hidden">
      <div className="space-y-2 border-b border-line p-4 text-sm sm:p-5">
        <p className="font-medium">
          {allowedCount} of {bots.length} crawlers allowed
        </p>
        <p className="text-muted">
          <span className="font-medium text-fg">Answer</span> bots fetch a page
          when someone asks about it. <span className="font-medium text-fg">Search</span>{" "}
          bots build the index answer engines draw on.{" "}
          <span className="font-medium text-fg">Training</span> bots collect
          data to train models. Blocking training bots is a legitimate choice
          and does not stop live citation.
        </p>
      </div>

      {/* Table from sm up */}
      <table className="hidden w-full text-left text-sm sm:table">
        <caption className="sr-only">
          AI crawler access, as decided by robots.txt
        </caption>
        <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-5 py-2.5 font-medium">
              Bot
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Operator
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Purpose
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Access
            </th>
            <th scope="col" className="px-5 py-2.5 font-medium">
              Deciding rule
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((bot) => (
            <tr key={bot.bot}>
              <th scope="row" className="px-5 py-3 font-mono text-xs font-medium">
                {bot.bot}
              </th>
              <td className="px-3 py-3 text-muted">{bot.operator}</td>
              <td className="px-3 py-3">{PURPOSE_LABEL[bot.purpose]}</td>
              <td className="px-3 py-3">
                <Verdict bot={bot} />
              </td>
              <td className="px-5 py-3 font-mono text-xs text-muted">
                {bot.rule}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Stacked list on phones */}
      <ul className="divide-y divide-line sm:hidden">
        {sorted.map((bot) => (
          <li key={bot.bot} className="space-y-1 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs font-medium">{bot.bot}</span>
              <Verdict bot={bot} />
            </div>
            <p className="text-muted">
              {bot.operator} · {PURPOSE_LABEL[bot.purpose]}
            </p>
            <p className="break-words font-mono text-xs text-muted">{bot.rule}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
