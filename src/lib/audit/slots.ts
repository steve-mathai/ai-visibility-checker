import { auditSlots, MAX_CONCURRENT_AUDITS } from "./concurrency";

/** Single audits (/api/audit) can always get at least this many of the shared slots. */
export const RESERVED_FOR_SINGLE_AUDITS = 2;

/**
 * Take up to `want` audit slots for a multi-URL job without ever eating into the slots reserved for single
 * audits, so a site audit or a compare cannot starve /api/audit. Returns the releases actually obtained
 * (possibly none: the caller answers "busy"). Synchronous, so two callers cannot both pass the reserve check.
 */
export function acquireWideSlots(want: number): (() => void)[] {
  const held: (() => void)[] = [];
  while (held.length < want && auditSlots.inFlight < MAX_CONCURRENT_AUDITS - RESERVED_FOR_SINGLE_AUDITS) {
    const release = auditSlots.tryAcquire();
    if (!release) break;
    held.push(release);
  }
  return held;
}

/** Run `fn` over `items` with at most `limit` in flight. Results keep the input order. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
