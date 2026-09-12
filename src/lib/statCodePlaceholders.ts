import type { CodePins, Placeholder, PlaceholderRolls } from '@/types';
import {
  drawablePlaceholderValues, placeholderKindNoun, readPlaceholders, weightedPick,
  type PlaceholderPick, type PlaceholderReading,
} from './placeholders';
import type { SandboxPlaceholder } from './statCodeExecutor';

/** The placeholders one stat-code run reads, and what they resolve under. */
export interface StatCodePlaceholderSet {
  placeholders: readonly Placeholder[];
  /** The playthrough's rolls. Read, never written. */
  rolls: PlaceholderRolls;
  /** Placeholder id → the text every pin in force holds it to. */
  pins?: Readonly<Record<string, string>>;
  /** The Code Pins as stored, so an Object pinned to a list reads that list back rather than its join.
   *  A Code Pin outranks every authored source, so an id in here is the pin in force. */
  codePins?: CodePins;
  /** Chooser for `roll()` and for any placeholder with no roll yet. Defaults to the weighted draw. */
  pick?: PlaceholderPick;
}

/**
 * What an Object reads as: the list in force. The pinned list where code pinned one, else the one text a
 * pin of any other kind holds it to, else its drawable values. The unpinned list drops a value that
 * resolves to nothing, exactly as the prompt's join does, so the `", "` join of this list is the text.
 *
 * A code pin reads back as it was stored, so a value carrying a comma survives the round trip. Code writes
 * plain text, so the join of those items is the pin the collection laid, and `text` is that pin resolved.
 */
function objectValue(ph: Placeholder, reading: PlaceholderReading, set: StatCodePlaceholderSet): string[] {
  const pinned = set.codePins?.[ph.id];
  if (Array.isArray(pinned)) return [...pinned];
  if (set.pins?.[ph.id] != null) return [reading.value];
  const drawable = new Set(drawablePlaceholderValues(ph).map((v) => v.id));
  return (ph.values ?? [])
    .map((v, index) => (drawable.has(v.id) ? reading.values[index] : ''))
    .filter((text) => text !== '');
}

/** The sandbox's `placeholders` entries, in authored order. `roll()` draws with the author's weights and
 *  hands back the drawn value's resolved text; nothing it draws is kept. */
export function sandboxPlaceholders(set: StatCodePlaceholderSet): SandboxPlaceholder[] {
  const pick = set.pick ?? weightedPick;
  const resolveOpts = {
    placeholders: [...set.placeholders], rolls: set.rolls, pins: set.pins && { ...set.pins }, pick,
  };
  const readings = readPlaceholders(resolveOpts);
  return readings.map((reading, index) => {
    const ph = set.placeholders[index];
    const values = ph.values ?? [];
    const weights = ph.weights;
    return {
      name: reading.name,
      value: placeholderKindNoun(ph) === 'Object' ? objectValue(ph, reading, set) : reading.value,
      values: reading.values,
      text: reading.value,
      roll: () => {
        if (!values.length) return '';
        const drawn = pick(values, weights);
        const at = values.findIndex((v) => v.text === drawn);
        return at >= 0 ? reading.values[at] : drawn;
      },
    };
  });
}
