// The typed stat value's step contract, kept pure and separate from the row that renders it. Every
// keystroke in play resolves here: what the field should read next, and what (if anything) the stat
// commits. Extracted for the same reason as the stat bar's geometry — the rules are all edge cases, and
// they are not worth re-deriving inside a component.

/** How a committed value reads in the field. Whole numbers only: the field steps by 1, matching the
 *  rounded readout it replaces, while the stat itself keeps whatever precision regen and code gave it. */
export function statFieldText(value: number): string {
  return String(Math.round(value));
}

/** What one keystroke resolves to. */
export interface StatFieldStep {
  /** The text the field shows afterwards. */
  text: string;
  /** The value to commit, or `null` to leave the stat where it is. */
  commit: number | null;
}

/**
 * Resolve one keystroke in the stat value field.
 *
 * A parseable entry commits immediately, clamped to the stat's range on both bounds, so the bar,
 * descriptor and morphs track typing the way they track the slider and the range is never violated even
 * for a frame. Clearing the field is the one allowed transient: the text goes blank and the stat holds its
 * last value, which a blur then snaps the text back to. Anything unparseable is refused outright.
 */
export function statFieldStep(raw: string, current: number, min: number, max: number): StatFieldStep {
  const trimmed = raw.trim();
  if (trimmed === '') return { text: '', commit: null };
  const parsed = parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return { text: statFieldText(current), commit: null };
  const clamped = Math.min(max, Math.max(min, parsed));
  return { text: statFieldText(clamped), commit: clamped };
}
