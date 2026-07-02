import { useEffect } from "react";
import type { MutableRefObject } from "react";

type SendAction = (action: string) => Promise<void>;

/**
 * DEV-only browser hook for the baseline test harness (`testing/baseline/harness`). Exposes
 * `window.__baseline` so an automation script can drive the fixed action script and read the AI-context dump
 * without fragile DOM waits:
 *   - `runScript(actions)` runs each action through `sendGameAction`, awaiting turn completion between them.
 *   - `getDebugTurns()` returns the current AI-context turns (the same array the Export button downloads).
 *
 * `import.meta.env.DEV` guards the body, so production builds dead-code-eliminate it (no `__baseline` ships).
 */
export function useBaselineTestHook(
  debugTurnsRef: MutableRefObject<unknown[]>,
  sendGameActionRef: MutableRefObject<SendAction>,
): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __baseline?: unknown };
    w.__baseline = {
      getDebugTurns: () => debugTurnsRef.current,
      runScript: async (actions: string[]) => {
        for (const a of actions) await sendGameActionRef.current(a);
      },
    };
    return () => {
      delete (w as { __baseline?: unknown }).__baseline;
    };
  }, [debugTurnsRef, sendGameActionRef]);
}
