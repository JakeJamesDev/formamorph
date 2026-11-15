// The auto palette for speaker colors. The tokens live in index.css (`--speaker-N`), one set per mode.
import type { SpeakerColors } from '@/lib/quoteSegments';

/** How many `--speaker-N` tokens index.css defines. */
export const SPEAKER_PALETTE_SIZE = 8;

/** The CSS color of a palette slot, following the active mode. */
export const slotColor = (slot: number): string => `hsl(var(--speaker-${slot % SPEAKER_PALETTE_SIZE}))`;

/** Each entity's color by its place in `cast`: every world entity, then every runtime character in save order,
 *  ungated, so a gate never moves a color. `playerId` takes no slot. */
export function speakerColors(cast: readonly { id: string }[], playerId?: string): SpeakerColors {
  const speakers = cast.filter((entity) => entity.id !== playerId);
  return new Map(speakers.map((entity, index) => [entity.id, slotColor(index)]));
}
