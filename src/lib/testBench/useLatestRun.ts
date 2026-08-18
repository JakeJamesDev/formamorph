/**
 * The staleness question the Bench's on-demand actions all ask: is the run I started still the one whose
 * result the author is waiting for? A run that outlived an edit is about a world that no longer exists, and
 * landing it would write a verdict over work the author has since done.
 *
 * The hook owns only that question. Status, spinners and result clearing stay at the call sites, which is
 * where the two actions genuinely differ.
 */
import { useCallback, useEffect, useRef } from 'react';

/** Whether the run that issued this predicate is still the current one. */
export type StillCurrent = () => boolean;

/**
 * Issues a ticket for one run. Consult the returned predicate after every await and drop the result where it
 * says no.
 *
 * A ticket goes stale when the watched value changes identity or when a newer run begins, so the last run
 * started against the world the author has now is the only one that can land.
 */
export function useLatestRun(dep: unknown): () => StillCurrent {
  const run = useRef(0);
  useEffect(() => { run.current += 1; }, [dep]);
  return useCallback(() => {
    const ticket = (run.current += 1);
    return () => ticket === run.current;
  }, []);
}
