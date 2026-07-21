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
        for (const a of actions) {
          await sendGameActionRef.current(a);
          // Yield a macrotask so React flushes pending state (esp. isGameStarted after the opening turn)
          // and sendGameActionRef.current refreshes to the latest closure before the next action — the
          // opening turn's message content and isGameStarted flip both read this render's closure.
          await new Promise((r) => setTimeout(r, 500));
        }
      },
    };
    return () => {
      delete (w as { __baseline?: unknown }).__baseline;
    };
  }, [debugTurnsRef, sendGameActionRef]);
}
