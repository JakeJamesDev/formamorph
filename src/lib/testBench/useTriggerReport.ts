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
  /** The pins by content, not identity: the lens rebuilds its map whenever the world does, so comparing the
   *  object itself would read every keystroke in the editor as a change of character. */
  pinsKey: string;
  report: TriggerReport;
}

/** The lens PC's placeholder pins, as `buildTriggerReport` takes them. */
type Pins = Record<string, string>;

const keyOf = (pins: Pins | undefined): string => JSON.stringify(pins ?? {});

const trace = (
  world: TriggerWorld, text: string, history: string, semantic?: SemanticInput, pins?: Pins,
): TriggerRun => ({
  world,
  text,
  history,
  semantic,
  pinsKey: keyOf(pins),
  report: buildTriggerReport(world, text, { history: splitHistory(history), semantic, pins }),
});

export interface TriggerReportOptions {
  /** The vectors the semantic pass scores with; omitted (the default) means no semantic pass at all. Its
   *  identity is part of what schedules a run, so hand over the same object until the vectors change. */
  semantic?: SemanticInput;
  /** The lens PC's placeholder pins — what a chip resolves to under the character being tested as. */
  pins?: Pins;
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
  { semantic, pins, delayMs = TRIGGER_DEBOUNCE_MS }: TriggerReportOptions = {},
): TriggerReport {
  const [computed, setComputed] = useState(() => trace(world, text, history, semantic, pins));
  const pinsKey = keyOf(pins);
  useEffect(() => {
    if (computed.world === world && computed.text === text && computed.history === history
      && computed.semantic === semantic && computed.pinsKey === pinsKey) return;
    // Losing the semantic vectors is the one change that can't wait out a debounce: the toggle beside the
    // results already reads "off", and a score still on screen under it would contradict it.
    if (computed.semantic && !semantic) {
      setComputed(trace(world, text, history, undefined, pins));
      return;
    }
    // A lens change is the same case for the same reason: the selector above the results has already moved,
    // and there is no keystroke to wait out behind it.
    if (computed.pinsKey !== pinsKey) {
      setComputed(trace(world, text, history, semantic, pins));
      return;
    }
    const timer = setTimeout(() => setComputed(trace(world, text, history, semantic, pins)), delayMs);
    return () => clearTimeout(timer);
  }, [world, text, history, semantic, pins, pinsKey, delayMs,
    computed.world, computed.text, computed.history, computed.semantic, computed.pinsKey]);
  return computed.report;
}
