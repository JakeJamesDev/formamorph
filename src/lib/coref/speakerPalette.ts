// Speaker quote colors. The tokens live in index.css (`--speaker-N`), one set per mode.
import type { SpeakerColors } from '@/lib/quoteSegments';

/** The swatches an author can pin, by key; a swatch's place in this list is its `--speaker-N` token. The first
 *  `SPEAKER_PALETTE_SIZE` are the auto palette. */
export const QUOTE_SWATCHES = [
  'amber', 'green', 'violet', 'rose', 'ocean', 'gold', 'lime', 'indigo',
  'red', 'coral', 'brown', 'olive', 'emerald', 'teal', 'sky', 'blue', 'plum', 'magenta', 'pink', 'slate',
] as const;

export type QuoteSwatch = (typeof QUOTE_SWATCHES)[number];

/** How many swatches the auto palette cycles through. */
export const SPEAKER_PALETTE_SIZE = 8;

/** The CSS color of an auto palette slot, following the active mode. */
export const slotColor = (slot: number): string => `hsl(var(--speaker-${slot % SPEAKER_PALETTE_SIZE}))`;

/** Whether a stored value is a swatch key. */
export const isQuoteSwatch = (key: unknown): key is QuoteSwatch => (QUOTE_SWATCHES as readonly unknown[]).includes(key);

/** The CSS color of a pinned swatch, following the active mode; undefined for an unknown key. */
export const swatchColor = (key: string | undefined): string | undefined =>
  isQuoteSwatch(key) ? `hsl(var(--speaker-${QUOTE_SWATCHES.indexOf(key)}))` : undefined;

/** The played persona's Auto color: the player's Quote Color for the active mode, else the theme's (Q61). */
export const PLAYER_QUOTE_COLOR = 'var(--dialogue-custom, hsl(var(--dialogue)))';

type Speaker = { id: string; quoteColor?: string };

/** Each entity's color: its pinned swatch, else the auto slot of its place in `cast`. `cast` is every world
 *  entity, then every runtime character in save order, ungated, so a gate never moves a color. The played
 *  persona takes no slot: its pinned swatch, else {@link PLAYER_QUOTE_COLOR}. */
export function speakerColors(cast: readonly Speaker[], player?: Speaker): SpeakerColors {
  const speakers = cast.filter((entity) => entity.id !== player?.id);
  const colors = new Map(speakers.map((entity, index) => [entity.id, swatchColor(entity.quoteColor) ?? slotColor(index)]));
  if (player) colors.set(player.id, swatchColor(player.quoteColor) ?? PLAYER_QUOTE_COLOR);
  return colors;
}
