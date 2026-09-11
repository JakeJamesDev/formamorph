import { useEffect, useRef, useState } from "react";

/**
 * Records a snapshot *after* React commits a batch of state updates, not in the middle of dispatching
 * them. A turn's completion fires several setStates together (finalized message, applied stat changes,
 * advanced time); reading the snapshot synchronously alongside those dispatches captures a stale,
 * half-applied state. Instead, `arm()` once the turn's updates are dispatched and the snapshot is taken
 * on the next commit — by which point every batched update has landed. Arming schedules a commit of its
 * own, so a turn whose last updates land after `watch` already committed (stat code awaited past the
 * narration) still snapshots them.
 *
 * `takeSnapshot` and `commit` are read through refs, so the effect fires only on the post-commit signal,
 * never merely because those callbacks were re-created on render.
 */
export function useDeferredSnapshot<S>(
  watch: unknown,
  takeSnapshot: () => S,
  commit: (snapshot: S) => void,
): { arm: () => void } {
  const armedRef = useRef(false);
  const [armedNonce, setArmedNonce] = useState(0);
  const takeRef = useRef(takeSnapshot);
  const commitRef = useRef(commit);
  takeRef.current = takeSnapshot;
  commitRef.current = commit;

  useEffect(() => {
    if (!armedRef.current) return;
    armedRef.current = false;
    commitRef.current(takeRef.current());
  }, [watch, armedNonce]);

  return { arm: () => { armedRef.current = true; setArmedNonce((n) => n + 1); } };
}
