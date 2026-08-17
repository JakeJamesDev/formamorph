import type { PlayerStat } from '@/types';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import { xmlEscape } from './utils';

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
 * line is just the stat's name. `markdown` bullets each line with a bold name; `xml` emits one `<stat>` per
 * stat with a nested child tag per selected piece. Pure and unit-testable; this is the single source of the
 * app's stat context (see buildContextValues).
 */
export function buildStatContext(
  stats: PlayerStat[],
  pieces: StatPieces,
  format: 'simple' | 'markdown' | 'xml' = 'simple',
): string {
  if (!stats.length) return NONE_PLACEHOLDER;
  return stats
    .map((stat) => {
      const range = stat.max - stat.min;
      const percentage = range === 0 ? 0 : ((stat.value - stat.min) / range) * 100;
      // Sort ascending: the band is the first threshold at/above the current %, so order must be low→high
      // regardless of how the world stored its descriptors. `?? []`: hand-edited world JSON can omit the
      // field — no bands means no status, not a failed turn.
      const descriptor = [...(stat.descriptors ?? [])]
        .sort((a, b) => a.threshold - b.threshold)
        .find((d) => percentage <= d.threshold);
      // Whole numbers only: regen and stat code scale by the turn's measured hours, so a raw value can be
      // `0.5833333333333333` — a parrotable numeral the model echoes into the prose, and pure token waste.
      const valueStr = stat.type === 'percentage'
        ? `${Math.round(stat.value)}%`
        : `${Math.round(stat.value)}/${Math.round(stat.max)}`;
      if (format === 'xml') {
        const child = (tag: string, value: string | number) => `\n  <${tag}>${xmlEscape(String(value))}</${tag}>`;
        let inner = child('name', stat.name);
        if (pieces.values) inner += child('value', valueStr);
        if (pieces.status && descriptor) inner += child('status', descriptor.description);
        if (pieces.meaning && stat.description) inner += child('meaning', stat.description);
        return `<stat>${inner}\n</stat>`;
      }
      let body = '';
      if (pieces.values) body += valueStr;
      // Descriptor is parenthesized when it trails a value, bare when it stands alone (matches prior output).
      if (pieces.status && descriptor) body += pieces.values ? ` (${descriptor.description})` : descriptor.description;
      if (pieces.meaning && stat.description) body += body ? ` — ${stat.description}` : stat.description;
      if (format === 'markdown') return `- ${body ? `**${stat.name}:** ${body}` : `**${stat.name}**`}`;
      return body ? `${stat.name}: ${body}` : stat.name;
    })
    .join('\n');
}
