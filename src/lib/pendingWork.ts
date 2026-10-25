/** Fire-and-forget work still running, so a test can wait for it to end before it checks for absence. */
const pending = new Set<Promise<unknown>>();

/** Records `work` until it settles and hands it back. */
export function trackWork<T>(work: Promise<T>): Promise<T> {
  pending.add(work);
  const done = () => { pending.delete(work); };
  work.then(done, done);
  return work;
}

/** Whether any tracked work is still running. */
export const hasPendingWork = (): boolean => pending.size > 0;
