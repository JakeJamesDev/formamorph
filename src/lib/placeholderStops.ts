import { pinSourceKey, type PinRow } from './placeholderPins';
import type { DrawPinSource } from './placeholders';
import type { Placeholder } from '@/types';

/**
 * The stops a placeholder's chevrons walk on the Values tab: its own values in order, then every pin aimed
 * at it, one stop per pin. A pin that names one of the placeholder's own values is that value's stop, so no
 * stop repeats. A stop is a view for reading and editing; which pin wins in play does not change.
 */

/** One of the placeholder's own values. */
export interface ValueStop {
  key: string;
  valueId: string;
  /** Its place in the value list, from zero. */
  index: number;
  text: string;
}

/** A pin whose text is on no value list: the text lives on the pin's source, not on the placeholder. */
export interface PinStop {
  key: string;
  row: PinRow;
  /** Its place among the pins its source aims at this placeholder, from zero. A source may carry several. */
  place: number;
  text: string;
}

export type PlaceholderStop = ValueStop | PinStop;

export const stopKind = (stop: PlaceholderStop): 'value' | 'pin' => ('row' in stop ? 'pin' : 'value');

export const isPinStop = (stop: PlaceholderStop): stop is PinStop => 'row' in stop;

/** A value stop's key. Keys of both kinds are unique within one placeholder, and stable across an edit. */
export const valueStopKey = (valueId: string): string => `v:${valueId}`;

/** A pin stop's key: its source and its place there, so an edit to the pin's own text keeps the key. */
export const pinStopKey = (row: PinRow, place: number): string => `p:${pinSourceKey(row.source)}#${place}`;

/**
 * Every stop of `ph`, from the world's pin rows in the order the rows give them: strongest source kind
 * first, authored order within a kind.
 */
export function placeholderStops(ph: Placeholder, rows: readonly PinRow[]): PlaceholderStop[] {
  const values = ph.values ?? [];
  const listed = new Set(values.map((v) => v.id));
  const stops: PlaceholderStop[] = values.map((v, index) => ({ key: valueStopKey(v.id), valueId: v.id, index, text: v.text }));
  // Counted over every pin a source aims here, folded ones included, so a place names the same pin on the
  // source whichever of its neighbors is folded.
  const places = new Map<string, number>();
  for (const row of rows) {
    if (row.pin.placeholderId !== ph.id) continue;
    const source = pinSourceKey(row.source);
    const place = places.get(source) ?? 0;
    places.set(source, place + 1);
    if (row.pin.valueId && listed.has(row.pin.valueId)) continue;
    stops.push({ key: pinStopKey(row, place), row, place, text: row.pin.value });
  }
  return stops;
}

/** What the draw reported for one chip: the parts that say which stop it landed on. */
export interface DrawnStop {
  valueId?: string;
  text: string;
  pinned?: true;
  pinSource?: DrawPinSource;
}

/**
 * Which of `stops` a chip opens on, and whether a pin the draw laid itself decided it. A stop the author
 * stepped to comes first; then the pin the draw laid; then the value it rolled; then the first stop, which
 * is where an Object, a Variable and a placeholder with no values but some pins all open. -1 with no stops.
 */
export function openStopIndex(
  stops: readonly PlaceholderStop[],
  drawn: DrawnStop | undefined,
  chosenKey: string | undefined,
): { index: number; drawPinned: boolean } {
  const chosen = chosenKey === undefined ? -1 : stops.findIndex((s) => s.key === chosenKey);
  if (chosen >= 0) return { index: chosen, drawPinned: false };
  const valueAt = (id: string | undefined) => (id ? stops.findIndex((s) => !isPinStop(s) && s.valueId === id) : -1);
  if (drawn?.pinned) {
    const source = drawn.pinSource;
    // A value may pin one placeholder twice; the draw reads the last, so the last matching stop is it.
    const pinAt = source
      ? stops.findLastIndex((s) => isPinStop(s) && s.row.source.kind === 'value'
        && s.row.source.placeholderId === source.placeholderId && s.row.source.valueId === source.valueId
        && s.text === drawn.text)
      : -1;
    const index = pinAt >= 0 ? pinAt : valueAt(drawn.valueId);
    if (index >= 0) return { index, drawPinned: true };
  }
  const rolled = valueAt(drawn?.valueId);
  return { index: rolled >= 0 ? rolled : stops.length ? 0 : -1, drawPinned: false };
}
