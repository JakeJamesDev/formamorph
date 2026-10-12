import type { PlayerStat, Stat, StatDescriptor, StatGroup } from '@/types';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import { headingReachesAi } from './groupTree';
import { statPanelLayout, type StatLayoutNode } from './statGroupTree';
import { sortedDescriptors, thresholdValue, type BandedStat } from './statDescriptorGeometry';
import { xmlEscape } from './utils';
import { indentRuns, joinRuns, mark, runs, textOf, type MarkedRun, type MarkedText, type TextOrigin } from './markedText';

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

/** One owner's stats as a Stats chip lays them out: flat when `placement` is absent. */
export interface StatChipPart {
  stats: readonly PlayerStat[];
  placement?: StatPlacement;
}

/** The placement an owner authored: the world's, or an entity's. */
export const statPlacementOf = (owner: { stats?: readonly Stat[]; statGroups?: readonly StatGroup[] }): StatPlacement =>
  ({ groups: owner.statGroups ?? [], authored: owner.stats ?? [] });

/** One entity's stats as a Stats chip part, with the entity that owns them. */
export interface OwnerStatPart extends StatChipPart {
  ownerId: string;
}

/** Each owner's stats from `held` as a Stats chip part, placed as that owner authored them. */
export const ownerStatParts = (
  owners: readonly { id: string; stats?: readonly Stat[]; statGroups?: readonly StatGroup[] }[],
  held: Readonly<Record<string, readonly PlayerStat[]>>,
): OwnerStatPart[] => owners.map((owner) => ({ ownerId: owner.id, stats: held[owner.id] ?? [], placement: statPlacementOf(owner) }));

/** One stat in `format`: a line, or a multi-line `<stat>` block in xml. Each piece is marked as its own. */
function statEntry(stat: PlayerStat, pieces: StatPieces, format: ContextFormat): MarkedRun[] {
  const descriptor = activeDescriptor(stat, stat.value);
  const valueStr = statValueLabel(stat, stat.value);
  if (format === 'xml') {
    // The line break and indent stay unmarked, so a piece marks only its tag.
    const child = (tag: string, value: string | number, ...origins: TextOrigin[]) =>
      runs('\n  ', mark(origins, `<${tag}>${xmlEscape(String(value))}</${tag}>`));
    return runs(
      '<stat>',
      child('name', stat.name),
      pieces.values ? child('value', valueStr, 'range') : '',
      pieces.status && descriptor ? child('status', descriptor.description, 'descriptor') : '',
      pieces.meaning && stat.description ? child('meaning', stat.description, 'meaning') : '',
      '\n</stat>',
    );
  }
  let body: MarkedRun[] = pieces.values ? mark(['range'], valueStr) : [];
  // Descriptor is parenthesized when it trails a value, bare when it stands alone.
  if (pieces.status && descriptor) {
    const text = pieces.values ? `(${descriptor.description})` : descriptor.description;
    body = runs(body, pieces.values ? ' ' : '', mark(['descriptor'], text));
  }
  if (pieces.meaning && stat.description) body = runs(body, textOf(body) ? ' — ' : '', mark(['meaning'], stat.description));
  const hasBody = textOf(body) !== '';
  if (format === 'markdown') return hasBody ? runs(`- **${stat.name}:** `, body) : runs(`- **${stat.name}**`);
  return hasBody ? runs(`${stat.name}: `, body) : runs(stat.name);
}

/** The layout as the AI reads it: a group whose heading the AI can't see gives its slot to its children. */
const aiVisibleLayout = <T>(nodes: StatLayoutNode<T>[]): StatLayoutNode<T>[] => nodes.flatMap((node) => {
  if (node.kind === 'stat') return [node];
  const children = aiVisibleLayout(node.children);
  return headingReachesAi(node.group) ? [{ ...node, children }] : children;
});

/** One group as `format` heads it: its name and description, then its body indented one level. */
function groupBlock(group: StatGroup, body: MarkedText, format: ContextFormat): MarkedRun[] {
  const desc = group.aiDescription?.trim();
  if (format === 'xml') {
    const head = [`  <name>${xmlEscape(group.name)}</name>`, ...(desc ? [`  <description>${xmlEscape(desc)}</description>`] : [])];
    return joinRuns(['<group>', ...head, indentRuns(body, '  '), '</group>'], '\n');
  }
  if (format === 'markdown') return runs(`- **${group.name}:**${desc ? ` ${desc}` : ''}\n`, indentRuns(body, '  '));
  return joinRuns([`${group.name}:`, ...(desc ? [`  ${desc}`] : []), indentRuns(body, '  ')], '\n');
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
  return textOf(statContextRuns(stats, pieces, format, placement));
}

/** {@link buildStatContext} as marked runs, each Stat Detail piece marked inside its stat line. */
export function statContextRuns(
  stats: PlayerStat[],
  pieces: StatPieces,
  format: ContextFormat = 'simple',
  placement?: StatPlacement,
): MarkedRun[] {
  if (!stats.length) return runs(NONE_PLACEHOLDER);
  const entry = (stat: PlayerStat) => statEntry(stat, pieces, format);
  if (!placement?.groups.length) return joinRuns(stats.map(entry), '\n');
  const grouped = new Set<string>();
  // A group's own stats come before its subgroups; each stat rendered here counts as grouped.
  const render = (nodes: StatLayoutNode<PlayerStat>[]): MarkedRun[][] => {
    const own = nodes.flatMap((node) => (node.kind === 'stat' ? [node.item] : []));
    own.forEach((stat) => grouped.add(stat.id));
    return [...own.map(entry), ...nodes.flatMap((node) => (
      node.kind === 'group' ? [groupBlock(node.group, joinRuns(render(node.children), '\n'), format)] : []
    ))];
  };
  // A stat a hidden top-level group gives up lands at the top level, so it reads as loose.
  const groups = render(aiVisibleLayout(statPanelLayout(placement.groups, placement.authored, stats, (stat) => stat.id))
    .filter((node) => node.kind === 'group'));
  return joinRuns([...stats.filter((stat) => !grouped.has(stat.id)).map(entry), ...groups], '\n');
}
