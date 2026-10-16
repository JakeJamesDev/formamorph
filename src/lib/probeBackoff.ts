/** First wait after a failed probe, in ms. Each further failure doubles it up to the max. */
export const PROBE_RETRY_MIN_MS = 15_000;
export const PROBE_RETRY_MAX_MS = 120_000;

/** The wait that follows `delay`, doubled and capped. */
export function nextProbeDelay(delay: number): number {
  return Math.min(delay * 2, PROBE_RETRY_MAX_MS);
}

interface ProbeState { inFlight: boolean; retryAt: number; delay: number }

/**
 * Gates one probe per key: never two in flight, and a failed key waits out a doubling backoff before it
 * is asked again. A key with no record is ready.
 */
export class ProbeBackoff {
  private readonly states = new Map<string, ProbeState>();

  /** Claims `key` for a probe at `now` when it is ready; false while one is in flight or backing off. */
  begin(key: string, now: number): boolean {
    const state = this.states.get(key);
    if (state && (state.inFlight || now < state.retryAt)) return false;
    this.states.set(key, { inFlight: true, retryAt: 0, delay: state?.delay ?? 0 });
    return true;
  }

  /** Records the probe's answer: a success clears the key, a failure schedules the next try. */
  end(key: string, ok: boolean, now: number): void {
    if (ok) { this.states.delete(key); return; }
    const prev = this.states.get(key)?.delay ?? 0;
    const delay = prev === 0 ? PROBE_RETRY_MIN_MS : nextProbeDelay(prev);
    this.states.set(key, { inFlight: false, retryAt: now + delay, delay });
  }
}
