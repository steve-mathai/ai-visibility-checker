/**
 * Per-instance in-flight cap. `tryAcquire` never queues: when the cap is reached the caller answers
 * "busy" immediately, so a burst cannot pile up memory or threadpool work on one instance.
 */
export class Semaphore {
  private active = 0;
  constructor(private readonly max: number) {}

  get inFlight(): number {
    return this.active;
  }

  /** Returns a release function (idempotent), or null when the cap is reached. */
  tryAcquire(): (() => void) | null {
    if (this.active >= this.max) return null;
    this.active++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
    };
  }
}

export const MAX_CONCURRENT_AUDITS = 6;
export const MAX_CONCURRENT_SUMMARIES = 3;
export const auditSlots = new Semaphore(MAX_CONCURRENT_AUDITS);
export const summarySlots = new Semaphore(MAX_CONCURRENT_SUMMARIES);
