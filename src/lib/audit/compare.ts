import { AuditFailure, runAudit } from "./index";
import type { RunAuditOptions } from "./index";
import { mapPool } from "./slots";
import type { CompareItem } from "./wide-types";

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 4;

/** Audit each address on its own. One failing address becomes an error entry and never fails the others. */
export async function runCompare(urls: string[], opts: RunAuditOptions & { concurrency?: number } = {}): Promise<CompareItem[]> {
  const { concurrency = COMPARE_MAX, ...auditOpts } = opts;
  return mapPool(urls, concurrency, async (url): Promise<CompareItem> => {
    try {
      return { url, ok: true, report: await runAudit(url, auditOpts) };
    } catch (err) {
      if (err instanceof AuditFailure) return { url, ok: false, error: err.message, code: err.code };
      // Anything else is a bug; its details stay on the server.
      return { url, ok: false, error: "Something went wrong while auditing that page.", code: "fetch_failed" };
    }
  });
}
