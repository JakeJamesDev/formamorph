import { useEffect, useState } from 'react';
import { buildTriggerReport, type TriggerReport, type TriggerWorld } from './triggers';

/** How still the typing has to go before the tracer re-runs. Short enough to read as live, long enough
 *  that a large dictionary is not re-scanned on every keystroke. */
const TRIGGER_DEBOUNCE_MS = 250;

/**
 * The trigger report for `text`, recomputed once the author stops typing (or the world changes). Pass a
 * `world` whose identity changes only when the world data does — the editor's memoized payload — since
 * that identity is half of what schedules the pass. The first pass is synchronous, so the tab has a
 * result the moment it opens.
 */
export function useDebouncedTriggerReport(
  world: TriggerWorld,
  text: string,
  delayMs = TRIGGER_DEBOUNCE_MS,
): TriggerReport {
  const [computed, setComputed] = useState(() => ({ world, text, report: buildTriggerReport(world, text) }));
  useEffect(() => {
    if (computed.world === world && computed.text === text) return;
    const timer = setTimeout(() => setComputed({ world, text, report: buildTriggerReport(world, text) }), delayMs);
    return () => clearTimeout(timer);
  }, [world, text, delayMs, computed.world, computed.text]);
  return computed.report;
}
