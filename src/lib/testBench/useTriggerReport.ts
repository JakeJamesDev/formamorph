import { useEffect, useState } from 'react';
import type { SemanticInput } from './semantic';
import { buildTriggerReport, splitHistory, type TriggerReport, type TriggerWorld } from './triggers';

/** How still the typing has to go before the tracer re-runs. Short enough to read as live, long enough
 *  that a large dictionary is not re-scanned on every keystroke. */
const TRIGGER_DEBOUNCE_MS = 250;

/** One pass's inputs, held together so the effect compares what it computed against what is being asked for. */
interface TriggerRun {
  world: TriggerWorld;
  text: string;
  history: string;
  semantic: SemanticInput | undefined;
  report: TriggerReport;
}

const trace = (world: TriggerWorld, text: string, history: string, semantic?: SemanticInput): TriggerRun => ({
  world,
  text,
  history,
  semantic,
  report: buildTriggerReport(world, text, { history: splitHistory(history), semantic }),
});

export interface TriggerReportOptions {
  /** The vectors the semantic pass scores with; omitted (the default) means no semantic pass at all. Its
   *  identity is part of what schedules a run, so hand over the same object until the vectors change. */
  semantic?: SemanticInput;
  delayMs?: number;
}

/**
 * The trigger report for `text` (with `history` as the messages behind it, `---` separated), recomputed
 * once the author stops typing or the world changes. Pass a `world` whose identity changes only when the
 * world data does — the editor's memoized payload — since that identity is part of what schedules the pass.
 * The first pass is synchronous, so the tab has a result the moment it opens.
 */
export function useDebouncedTriggerReport(
  world: TriggerWorld,
  text: string,
  history = '',
  { semantic, delayMs = TRIGGER_DEBOUNCE_MS }: TriggerReportOptions = {},
): TriggerReport {
  const [computed, setComputed] = useState(() => trace(world, text, history, semantic));
  useEffect(() => {
    if (computed.world === world && computed.text === text && computed.history === history
      && computed.semantic === semantic) return;
    // Losing the semantic vectors is the one change that can't wait out a debounce: the toggle beside the
    // results already reads "off", and a score still on screen under it would contradict it.
    if (computed.semantic && !semantic) {
      setComputed(trace(world, text, history, undefined));
      return;
    }
    const timer = setTimeout(() => setComputed(trace(world, text, history, semantic)), delayMs);
    return () => clearTimeout(timer);
  }, [world, text, history, semantic, delayMs,
    computed.world, computed.text, computed.history, computed.semantic]);
  return computed.report;
}
