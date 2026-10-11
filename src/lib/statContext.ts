import type { PlayerStat, Stat, StatDescriptor, StatGroup } from '@/types';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import { statPanelLayout, type StatLayoutNode } from './statGroupTree';
import { sortedDescriptors, thresholdValue, type BandedStat } from './statDescriptorGeometry';
import { xmlEscape } from './utils';

/**
 * The descriptor a value falls under, or undefined when it sits above every band. Bands sort ascending and
 * the first one at or above the value wins — so the order the author listed them in never decides anything.
 * A threshold reads as a raw stat value unless the stat opts into percent thresholds (lib/statDescriptorGeometry).
 * The single lookup behind the prompt's status piece; design-time surfaces (the Test Bench) call it too so
 * they can never band a value differently from play.
 */
export function activeDescriptor(
  stat: BandedStat,
  value: number,
): StatDescriptor | undefined {
  // `sortedDescriptors` reads the list as `?? []` because the field the type calls required can be absent
  // in hand-edited world JSON, and a stat with no bands has a status to omit rather than a turn to take down.
  return sortedDescriptors(stat).find((d) => value <= thresholdValue(stat, d.threshold));
}

/** A stat value as the prompt spells it: `62%` for a percentage stat, `62/100` otherwise. Whole numbers
 *  only — regen and stat code scale by measured hours, so a raw value can be a long fraction: a parrotable
 *  numeral the model echoes into the prose, and pure token waste. */
export function statValueLabel(stat: Pick<Stat, 'type' | 'max'>, value: number): string {
  return stat.type === 'percentage' ? `${Math.round(value)}%` : `${Math.round(value)}/${Math.round(stat.max)}`;
}

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

/** The shape a context block takes in a prompt. */
export type ContextFormat = 'simple' | 'markdown' | 'xml';

/** Where an owner's stats sit: its groups, and its authored stats, whose placement wins over a live copy's. */
export interface StatPlacement {
  groups: readonly StatGroup[];
  authored: readonly Stat[];
}

/** The placement an owner authored: the world's, or an entity's. */
export const statPlacementOf = (owner: { stats?: readonly Stat[]; statGroups?: readonly StatGroup[] }): StatPlacement =>
  ({ groups: owner.statGroups ?? [], authored: owner.stats ?? [] });

/** One stat in `format`: a line, or a multi-line `<stat>` block in xml. */
function statEntry(stat: PlayerStat, pieces: StatPieces, format: ContextFormat): string {
  const descriptor = activeDescriptor(stat, stat.value);
  const valueStr = statValueLabel(stat, stat.value);
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
  // Descriptor is parenthesized when it trails a value, bare when it stands alone.
  if (pieces.status && descriptor) body += pieces.values ? ` (${descriptor.description})` : descriptor.description;
  if (pieces.meaning && stat.description) body += body ? ` — ${stat.description}` : stat.description;
  if (format === 'markdown') return `- ${body ? `**${stat.name}:** ${body}` : `**${stat.name}**`}`;
  return body ? `${stat.name}: ${body}` : stat.name;
}

const indented = (text: string, pad: string) => text.split('\n').map((line) => `${pad}${line}`).join('\n');

/** One group as `format` heads it: its name and description, then its body indented one level. */
function groupBlock(group: StatGroup, body: string, format: ContextFormat): string {
  const desc = group.aiDescription?.trim();
  if (format === 'xml') {
    const head = [`  <name>${xmlEscape(group.name)}</name>`, ...(desc ? [`  <description>${xmlEscape(desc)}</description>`] : [])];
    return ['<group>', ...head, indented(body, '  '), '</group>'].join('\n');
  }
  if (format === 'markdown') return `- **${group.name}:**${desc ? ` ${desc}` : ''}\n${indented(body, '  ')}`;
  return [`${group.name}:`, ...(desc ? [`  ${desc}`] : []), indented(body, '  ')].join('\n');
}

/**
 * Render stats for a prompt: one entry per stat, `Name:` followed by the selected pieces in a fixed order —
 * value/max, then the status descriptor, then ` — ` and the meaning. With no piece selected an entry is just
 * the stat's name. `markdown` bullets each line with a bold name; `xml` emits one `<stat>` per stat with a
 * nested child tag per selected piece. With a `placement`, loose stats come first in the given order, then
 * each group that holds a stat, in authored order, nests its stats before its subgroups under its heading.
 * Pure and unit-testable; this is the single source of the app's stat context (see chipValues).
 */
export function buildStatContext(
  stats: PlayerStat[],
  pieces: StatPieces,
  format: ContextFormat = 'simple',
  placement?: StatPlacement,
): string {
  if (!stats.length) return NONE_PLACEHOLDER;
  const entry = (stat: PlayerStat) => statEntry(stat, pieces, format);
  if (!placement?.groups.length) return stats.map(entry).join('\n');
  const grouped = new Set<string>();
  // A group's own stats come before its subgroups; each stat rendered here counts as grouped.
  const render = (nodes: StatLayoutNode<PlayerStat>[]): string[] => {
    const own = nodes.flatMap((node) => (node.kind === 'stat' ? [node.item] : []));
    own.forEach((stat) => grouped.add(stat.id));
    return [...own.map(entry), ...nodes.flatMap((node) => (
      node.kind === 'group' ? [groupBlock(node.group, render(node.children).join('\n'), format)] : []
    ))];
  };
  const groups = render(statPanelLayout(placement.groups, placement.authored, stats, (stat) => stat.id)
    .filter((node) => node.kind === 'group'));
  return [...stats.filter((stat) => !grouped.has(stat.id)).map(entry), ...groups].join('\n');
}
