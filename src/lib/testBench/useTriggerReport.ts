import { useEffect, useState } from 'react';
import { buildTriggerReport, splitHistory, type TriggerReport, type TriggerWorld } from './triggers';

/** How still the typing has to go before the tracer re-runs. Short enough to read as live, long enough
 *  that a large dictionary is not re-scanned on every keystroke. */
const TRIGGER_DEBOUNCE_MS = 250;

/** One pass's inputs, held together so the effect compares what it computed against what is being asked for. */
interface TriggerRun {
  world: TriggerWorld;
  text: string;
  history: string;
  report: TriggerReport;
}

const trace = (world: TriggerWorld, text: string, history: string): TriggerRun => ({
  world,
  text,
  history,
  report: buildTriggerReport(world, text, { history: splitHistory(history) }),
});

/**
 * The trigger report for `text` (with `history` as the messages behind it, blank-line separated), recomputed
 * once the author stops typing or the world changes. Pass a `world` whose identity changes only when the
 * world data does — the editor's memoized payload — since that identity is part of what schedules the pass.
 * The first pass is synchronous, so the tab has a result the moment it opens.
 */
export function useDebouncedTriggerReport(
  world: TriggerWorld,
  text: string,
  history = '',
  delayMs = TRIGGER_DEBOUNCE_MS,
): TriggerReport {
  const [computed, setComputed] = useState(() => trace(world, text, history));
  useEffect(() => {
    if (computed.world === world && computed.text === text && computed.history === history) return;
    const timer = setTimeout(() => setComputed(trace(world, text, history)), delayMs);
    return () => clearTimeout(timer);
  }, [world, text, history, delayMs, computed.world, computed.text, computed.history]);
  return computed.report;
}
