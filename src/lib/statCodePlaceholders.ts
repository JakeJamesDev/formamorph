import type { Placeholder, PlaceholderRolls } from '@/types';
import { readPlaceholders, weightedPick, type PlaceholderPick } from './placeholders';
import type { SandboxPlaceholder } from './statCodeExecutor';

/** The placeholders one stat-code run reads, and what they resolve under. */
export interface StatCodePlaceholderSet {
  placeholders: readonly Placeholder[];
  /** The playthrough's rolls. Read, never written. */
  rolls: PlaceholderRolls;
  /** Placeholder id → the text every pin in force holds it to. */
  pins?: Readonly<Record<string, string>>;
  /** Chooser for `roll()` and for any placeholder with no roll yet. Defaults to the weighted draw. */
  pick?: PlaceholderPick;
}

/** The sandbox's `placeholders` entries, in authored order. `roll()` draws with the author's weights and
 *  hands back the drawn value's resolved text; nothing it draws is kept. */
export function sandboxPlaceholders(set: StatCodePlaceholderSet): SandboxPlaceholder[] {
  const pick = set.pick ?? weightedPick;
  const readings = readPlaceholders({
    placeholders: [...set.placeholders], rolls: set.rolls, pins: set.pins && { ...set.pins }, pick,
  });
  return readings.map((reading, index) => {
    const values = set.placeholders[index].values ?? [];
    const weights = set.placeholders[index].weights;
    return {
      name: reading.name,
      value: reading.value,
      values: reading.values,
      roll: () => {
        if (!values.length) return '';
        const drawn = pick(values, weights);
        const at = values.findIndex((v) => v.text === drawn);
        return at >= 0 ? reading.values[at] : drawn;
      },
    };
  });
}
