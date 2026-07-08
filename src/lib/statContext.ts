import type { PlayerStat } from '@/types';
import { NONE_PLACEHOLDER } from './promptFallbacks';

/** Which pieces of each stat the prompt embeds. The stat's Name is always present; these are the chip's
 *  multi-select toggles (Values / Status / Meaning). */
export interface StatPieces {
  /** The current value and its range, e.g. "62/100". */
  values: boolean;
  /** The descriptor for the current level (a threshold word like "Winded"). */
  status: boolean;
  /** The stat's authored description — what it represents. */
  meaning: boolean;
}

/**
 * Render the player's stats for a prompt: one line per stat, `Name:` followed by the selected pieces in a
 * fixed order — value/max, then the status descriptor, then ` — ` and the meaning. With no piece selected a
 * line is just the stat's name. `markdown` bullets each line with a bold name. Pure and unit-testable; this
 * is the single source of the app's stat context (see buildContextValues).
 */
export function buildStatContext(
  stats: PlayerStat[],
  pieces: StatPieces,
  format: 'simple' | 'markdown' = 'simple',
): string {
  if (!stats.length) return NONE_PLACEHOLDER;
  return stats
    .map((stat) => {
      const range = stat.max - stat.min;
      const percentage = range === 0 ? 0 : ((stat.value - stat.min) / range) * 100;
      const descriptor = stat.descriptors.find((d) => percentage <= d.threshold);
      let body = '';
      if (pieces.values) body += `${stat.value}/${stat.max}`;
      // Descriptor is parenthesized when it trails a value, bare when it stands alone (matches prior output).
      if (pieces.status && descriptor) body += pieces.values ? ` (${descriptor.description})` : descriptor.description;
      if (pieces.meaning && stat.description) body += body ? ` — ${stat.description}` : stat.description;
      if (format === 'markdown') return `- ${body ? `**${stat.name}:** ${body}` : `**${stat.name}**`}`;
      return body ? `${stat.name}: ${body}` : stat.name;
    })
    .join('\n');
}
