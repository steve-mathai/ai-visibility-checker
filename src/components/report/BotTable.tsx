import type { BotVerdict } from "@/lib/audit/types";
import { Pill } from "../Badges";
import { PURPOSE_LABEL, PURPOSE_ORDER } from "./labels";

function Access({ bot }: { bot: BotVerdict }) {
  if (bot.allowed) return <Pill tone="pass">Allowed</Pill>;
  // A blocked training bot is a legitimate choice, so it is not drawn as an alarm.
  return (
    <Pill tone={bot.purpose === "training" ? "info" : "fail"}>Blocked</Pill>
  );
}

const TH = "h-9 px-3 text-left text-[13px] font-semibold text-muted";
const TD = "h-[37px] px-3 text-sm";

export function BotTable({ bots }: { bots: BotVerdict[] }) {
  // Array.prototype.sort is stable, so each purpose keeps the engine's own order.
  const sorted = [...bots].sort(
    (a, b) => PURPOSE_ORDER[a.purpose] - PURPOSE_ORDER[b.purpose],
  );

  return (
    <section
      aria-labelledby="crawlers-title"
      id="crawlers"
      className="card overflow-hidden"
    >
      <div className="px-5 pb-3 pt-4">
        <h2 id="crawlers-title" className="text-base font-semibold">
          Rules for each crawler
        </h2>
        <p className="mt-1 max-w-[80ch] text-[13px] text-muted">
          What robots.txt tells each AI crawler to do. Answer bots fetch a page
          when someone asks about it, search bots build the index answer engines
          draw on, and training bots collect data to train models. Blocking
          training bots is your call and doesn&rsquo;t stop live citation.
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="border-t border-line px-5 py-4 text-sm text-muted">
          No crawler data was returned for this site.
        </p>
      ) : (
        // Scrolls inside its own frame on a phone; the bot name stays put.
        <div
          role="region"
          aria-label="Crawler rules table"
          tabIndex={0}
          className="overflow-x-auto"
        >
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">
              AI crawler access, as decided by robots.txt
            </caption>
            <thead>
              <tr className="border-y border-line">
                <th
                  scope="col"
                  className={`${TH} sticky left-0 bg-raised pl-5`}
                >
                  Bot
                </th>
                <th scope="col" className={TH}>
                  Operator
                </th>
                <th scope="col" className={TH}>
                  Purpose
                </th>
                <th scope="col" className={TH}>
                  Access
                </th>
                <th scope="col" className={`${TH} pr-5`}>
                  Deciding rule
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((bot) => (
                <tr
                  key={bot.bot}
                  className="group border-t border-line first:border-t-0 hover:bg-surface print:break-inside-avoid"
                >
                  <th
                    scope="row"
                    translate="no"
                    className={`${TD} sticky left-0 whitespace-nowrap bg-raised pl-5 font-medium group-hover:bg-surface`}
                  >
                    {bot.bot}
                  </th>
                  <td className={`${TD} whitespace-nowrap text-muted`}>
                    {bot.operator}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {PURPOSE_LABEL[bot.purpose]}
                  </td>
                  <td className={TD}>
                    <Access bot={bot} />
                  </td>
                  <td className={`${TD} min-w-[11rem] break-words pr-5`}>
                    {bot.rule === "no matching rule" ? (
                      <span className="text-muted">{bot.rule}</span>
                    ) : (
                      <code className="break-words font-mono text-[13px]">
                        {bot.rule}
                      </code>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
