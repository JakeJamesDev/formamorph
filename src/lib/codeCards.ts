/**
 * What a hover card says about the name at a position. A pure reading of the code through the one resolver,
 * so the card and the completion list never describe a name two ways. The editor only draws the model.
 */

import { isMethodEntry, type CodeAccess, type SurfaceEntry } from '@/lib/codeSurface';
import type { CodeStatRecord, CodeWorldLookup } from '@/lib/codeWorldLookup';
import { REGEN_UNIT_LABELS, regenPer, regenUnitOf } from '@/lib/regenUnits';
import { isUnknownEntry, memberEntries, type SurfaceAnalysisOptions } from '@/lib/statCodeAnalysis';
import { isIdentifier } from '@/lib/statCodePaths';
import { resolveCodeName, type CodeMapOwner, type CodeValue } from '@/lib/statCodeResolver';
import type { Stat } from '@/types';

/** What a card names: a sandbox global, a member of one, or an entry of one of the world's maps. */
export type CodeCardKind = 'global' | 'property' | 'method' | 'stat' | 'trait' | 'placeholder' | 'entity' | 'dictionary';

/** The card's first line: what the name is, the path it reads as, and its type. */
export interface CodeCardSignature {
  kind: CodeCardKind;
  path: string;
  type: string;
}

/** One World Details row. */
export interface CodeCardRow {
  label: string;
  value: string;
}

/** The world item a card names, for links that open or search it. */
export type CodeCardItem =
  | { kind: 'stat'; statId: string; entityId?: string }
  | { kind: 'entity'; entityId: string };

export interface CodeCard {
  /** The span of code the card describes. */
  from: number;
  to: number;
  signature: CodeCardSignature;
  /** Absent where the name is no field a write could reach. */
  access?: CodeAccess;
  description?: string;
  /** World Details, from the box's lookup. */
  rows?: CodeCardRow[];
  item?: CodeCardItem;
}

/** `base` and one key, by dot where the key allows it. */
const keyPath = (base: string, key: string) => (isIdentifier(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`);

/** The path to an owner's own maps, with its trailing dot. Empty for the world's maps. */
function ownerPrefix(owner: CodeMapOwner): string {
  switch (owner.route) {
    case 'world': return '';
    case 'owner': return 'owner.';
    case 'persona': return 'persona.';
    case 'entity': return `${keyPath('entities', owner.entity)}.`;
    case 'dictionary': return `${keyPath('dictionaries', owner.dictionary)}.`;
  }
}

/** What a member's path starts with: the type an entry of a map has, or the exact path of a one-off object. */
function holderName(value: CodeValue): string {
  switch (value.is) {
    case 'stat': return 'Stat';
    case 'statPrevious': return 'Stat.previous';
    case 'statDelta': return 'Stat.delta';
    case 'deltaSource': return `Stat.delta.${value.source}`;
    case 'trait': return 'Trait';
    case 'placeholders': return 'Placeholder';
    case 'entity': case 'owner': return 'Entity';
    case 'dictionary': return 'Dictionary';
    case 'persona': return 'persona';
    case 'clock': case 'listed': return value.path;
    default: return value.is;
  }
}

const STAT_TYPE_LABEL: Record<Stat['type'], string> = { number: 'Number', percentage: 'Percentage' };

/** A stat amount in the stat's own units. */
const amount = (stat: Stat, n: number) => `${n}${stat.type === 'percentage' ? '%' : ''}`;
const signed = (stat: Stat, n: number) => (n < 0 ? `−${amount(stat, -n)}` : `+${amount(stat, n)}`);

/** The value a stat seeds with. */
const startsAt = (stat: Stat) => stat.starting ?? stat.value ?? stat.min;

/**
 * A stat card's value rows, in order, with Owner among them. A row with `atDefault` drops while the stat sits
 * at that default (Q27, Q35); Type, Range and Owner always show.
 */
const STAT_ROWS: readonly {
  label: string;
  value: (record: CodeStatRecord & { stat: Stat }) => string;
  atDefault?: (stat: Stat) => boolean;
}[] = [
  { label: 'Type', value: ({ stat }) => STAT_TYPE_LABEL[stat.type] ?? stat.type },
  { label: 'Range', value: ({ stat }) => `${stat.min} – ${amount(stat, stat.max)}` },
  { label: 'Starts At', value: ({ stat }) => amount(stat, startsAt(stat)), atDefault: (stat) => startsAt(stat) === stat.min },
  {
    label: 'Regen',
    value: ({ stat }) => {
      const unit = regenUnitOf(stat);
      return `${signed(stat, regenPer(stat.regen, unit))} per story ${REGEN_UNIT_LABELS[unit].toLowerCase()}`;
    },
    atDefault: (stat) => !stat.regen,
  },
  { label: 'Owner', value: ({ owner }) => owner },
  { label: 'Shown To', value: ({ stat }) => (stat.hidden ? 'AI only' : 'AI and player'), atDefault: (stat) => !stat.hidden },
  { label: 'Off', value: () => 'Until a trait turns it on', atDefault: (stat) => stat.enabled !== false },
];

const bearersRow = (bearers: readonly string[]): CodeCardRow => ({ label: 'Bearers', value: bearers.join(', ') || 'No bearers' });

/** A stat's World Details, with a Bearers row where a Blueprint box names who runs it (Q30). Only the Owner row
 *  where the lookup has no single stat to show (Q34). */
export function statRows(record: CodeStatRecord): CodeCardRow[] {
  const { stat } = record;
  if (!stat) return [{ label: 'Owner', value: record.owner }];
  const rows = STAT_ROWS.filter((row) => !row.atDefault?.(stat)).map((row) => ({ label: row.label, value: row.value({ ...record, stat }) }));
  return record.bearers ? [...rows, bearersRow(record.bearers)] : rows;
}

const statItem = ({ stat, entityId }: CodeStatRecord): CodeCardItem | undefined =>
  (stat ? { kind: 'stat', statId: stat.id, ...(entityId ? { entityId } : {}) } : undefined);

/** A stat card's world half: the authored description, the rows and the item. */
function statDetails(record: CodeStatRecord): Pick<CodeCard, 'description' | 'rows' | 'item'> {
  const item = statItem(record);
  return {
    ...(record.stat?.description ? { description: record.stat.description } : {}),
    rows: statRows(record),
    ...(item ? { item } : {}),
  };
}

/** `self` and `owner` as the lookup's box holds them, laid over their surface card. */
function boxGlobal(card: CodeCard, lookup: CodeWorldLookup): CodeCard {
  if (card.signature.path === 'self') {
    const record = lookup.self();
    const { rows = [], item } = statDetails(record);
    return { ...card, rows: [{ label: 'Stat', value: record.stat.name }, ...rows], ...(item ? { item } : {}) };
  }
  if (card.signature.path !== 'owner') return card;
  const owner = lookup.owner();
  switch (owner.kind) {
    case 'empty': return { ...card, description: 'Holds nothing in a world stat’s code. Writing through it changes nothing.' };
    case 'blueprint': return { ...card, rows: [bearersRow(owner.bearers)] };
    case 'entity': return {
      ...card,
      rows: [{ label: 'Entity', value: owner.name }, { label: 'Stats', value: owner.stats.join(', ') || 'None' }],
      item: { kind: 'entity', entityId: owner.entityId },
    };
  }
}

const fromEntry = (
  entry: SurfaceEntry, kind: CodeCardKind, path: string, span: { from: number; to: number },
): CodeCard => ({
  ...span,
  signature: { kind, path, type: entry.detail },
  ...(entry.access ? { access: entry.access } : {}),
  description: entry.info,
});

/**
 * The card for the completion option labelled `label`, read as the code the option would make: the label
 * replaces `replaces`, and the card is the one for the name it spells. Null where the label is no name a
 * card describes, as with a keyword or a name the author declared.
 */
export function completionCard(
  code: string,
  replaces: { from: number; to: number },
  label: string,
  options: SurfaceAnalysisOptions,
): CodeCard | null {
  // A key typed inside a string has no closing quote yet, and the tree reads an open string as no key at all.
  const quote = code[replaces.from - 1];
  const close = quote === '"' || quote === "'" ? quote : '';
  const taken = code.slice(0, replaces.from) + label + close + code.slice(replaces.to);
  return codeCard(taken, replaces.from + Math.floor(label.length / 2), options);
}

/** The card for the name at `pos`, or null where the code names nothing a card can describe. */
export function codeCard(code: string, pos: number, options: SurfaceAnalysisOptions): CodeCard | null {
  const name = resolveCodeName(code, pos, options);
  // A misspelled name is the diagnostic's to explain, not a card's.
  if (!name || isUnknownEntry(name, options)) return null;
  const span = { from: name.from, to: name.to };
  const world = (kind: CodeCardKind, path: string, type: string): CodeCard => ({ ...span, signature: { kind, path, type } });
  switch (name.kind) {
    case 'global': {
      const entry = [...options.surface.globals, ...options.surface.builtins].find((candidate) => candidate.name === name.key);
      const card = entry ? fromEntry(entry, 'global', entry.name, span) : null;
      return card && options.lookup ? boxGlobal(card, options.lookup) : card;
    }
    case 'member': {
      // A member the value doesn't carry gets no card, though the resolver read the value as a stat.
      const entry = memberEntries(name.of, options)?.find((candidate) => candidate.name === name.key);
      return entry ? fromEntry(entry, isMethodEntry(entry) ? 'method' : 'property', `${holderName(name.of)}.${entry.name}`, span) : null;
    }
    case 'stat': {
      const card = world('stat', keyPath(`${ownerPrefix(name.owner)}stats`, name.key), 'Stat');
      const record = options.lookup?.stat(name.owner, name.key);
      return record ? { ...card, ...statDetails(record) } : card;
    }
    case 'trait': return world('trait', keyPath(`${ownerPrefix(name.owner)}traits`, name.key), 'Trait');
    case 'placeholder':
      return world('placeholder', name.path.reduce(keyPath, `${ownerPrefix(name.owner)}placeholders`), 'Placeholder');
    case 'entity': return world('entity', keyPath('entities', name.key), 'Entity');
    case 'dictionary': return world('dictionary', keyPath('dictionaries', name.key), 'Dictionary');
    default: return null;
  }
}
