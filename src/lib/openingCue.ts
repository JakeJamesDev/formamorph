import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import type { WorldOverview } from '@/types';

/**
 * A world's own opening cue: the text the input box is pre-filled with when the player presses Start Game,
 * in place of the shipped default. The player still edits it freely before submitting, so this is a starting
 * point rather than a script — which is why it has no player-facing opt-out.
 *
 * Every fallback site (the pre-fill, the page-1 regenerate, the legacy sentinel mapping) resolves through
 * {@link resolveOpeningCue}, so none of them can drift from another.
 */

/** The find bar's target key for the stored cue — how a search hit navigates back to the field. */
export const OPENING_CUE_FIELD_KEY = 'openingCue';

/** The authored text regardless of whether it is switched on — what the editor edits and preserves. */
export function storedOpeningCue(overview: WorldOverview | null | undefined): string | undefined {
  const text = overview?.openingCue;
  return typeof text === 'string' ? text : undefined;
}

/**
 * Whether the author has the cue switched on. An explicit flag decides; with none, stored text counts as on,
 * so a world hand-authored without the flag still opens with its cue.
 */
export function openingCueEnabled(overview: WorldOverview | null | undefined): boolean {
  const flag = overview?.openingCueEnabled;
  if (typeof flag === 'boolean') return flag;
  return storedOpeningCue(overview) !== undefined;
}

/**
 * The world's own cue, or null when it has none to apply: no text, blank text, or text the author has
 * switched off. A switched-off cue is still stored on the world — that is the point of the flag — so this
 * is the only reading that decides whether it counts.
 */
export function openingCue(overview: WorldOverview | null | undefined): string | null {
  if (!openingCueEnabled(overview)) return null;
  const text = storedOpeningCue(overview);
  return text && text.trim() ? text : null;
}

/** True when this world actually supplies an opening cue of its own. */
export function hasOpeningCue(overview: WorldOverview | null | undefined): boolean {
  return openingCue(overview) !== null;
}

/** The cue to actually pre-fill: the world's when it has one, the shipped default otherwise. */
export function resolveOpeningCue(overview: WorldOverview | null | undefined): string {
  return openingCue(overview) ?? OPENING_SCENE_CUE;
}

/** The overview patch setting the cue's text, its switch, or both — how the editor writes the field. */
export function setOpeningCue(update: { text?: string; enabled?: boolean }): Partial<WorldOverview> {
  const patch: Partial<WorldOverview> = {};
  if (update.text !== undefined) patch.openingCue = update.text;
  if (update.enabled !== undefined) patch.openingCueEnabled = update.enabled;
  return patch;
}

/** The overview patch dropping the stored text, returning the field to tracking the default. The switch is
 *  left alone: a reset discards authored text, it does not decline the feature. */
export function clearOpeningCue(): Partial<WorldOverview> {
  return { openingCue: undefined };
}
