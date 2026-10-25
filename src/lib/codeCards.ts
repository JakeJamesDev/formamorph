/**
 * What a hover card says about the name at a position. A pure reading of the code through the one resolver,
 * so the card and the completion list never describe a name two ways. The editor only draws the model.
 */

import type { SyntaxNode } from '@lezer/common';
import { isMethodEntry, type CodeAccess, type SurfaceEntry } from '@/lib/codeSurface';
import { canBePlayer } from '@/lib/owners';
import type { DocTarget } from '@/lib/docs/docsLinks';
import type {
  CodeDictionaryRecord, CodeEntityRecord, CodeItemScope, CodeLocationRecord, CodeOwnersRecord, CodeOwnerRecord, CodePlaceholderOwner,
  CodePlaceholderRecord, CodeStatRecord, CodeTraitRecord, CodeWorldLookup,
} from '@/lib/codeWorldLookup';
import { placeholderKindNoun, placeholderWeight } from '@/lib/placeholders';
import { REGEN_UNIT_LABELS, regenPer, regenUnitOf } from '@/lib/regenUnits';
import { statMin, statStartValue } from '@/lib/statDescriptorGeometry';
import { isUnknownEntry, memberEntries, placeholderAt, type SurfaceAnalysisOptions } from '@/lib/statCodeAnalysis';
import { isIdentifier } from '@/lib/statCodePaths';
import { parseCode, resolveCodeName, type ArrayElement, type CodeMapOwner, type CodeValue, type PlaceholderOwner } from '@/lib/statCodeResolver';
import { DAYPART_OPTIONS, parseTemplateSlots } from '@/lib/statCodeTemplates';
import type { Placeholder, Stat, TraitMode } from '@/types';

/** What a name the code declares is, as the author wrote it. */
export type DeclarationKind = 'const' | 'let' | 'var' | 'function' | 'class' | 'parameter';

/** What a card names: a sandbox global, a member of one, an entry of one of the world's maps, a name the
 *  code declares, or a template slot. */
export type CodeCardKind =
  | 'global' | 'property' | 'method' | 'stat' | 'trait' | 'placeholder' | 'entity' | 'dictionary' | 'entry' | 'location'
  | DeclarationKind | 'slot';

/** The card's first line: what the name is, the path it reads as, and its type. A declared name has no type. */
export interface CodeCardSignature {
  kind: CodeCardKind;
  /** Where an item no entity owns lives, named beside its kind (Q8). */
  scope?: CodeItemScope;
  path: string;
  type?: string;
}

const SCOPE_LABEL: Record<CodeItemScope, string> = { global: 'global', world: 'world', blueprint: 'Blueprint' };

/** What the name is, as the card's first line says it: "stat", or "global stat" and "Blueprint stat". */
export const scopedKind = ({ kind, scope }: Pick<CodeCardSignature, 'kind' | 'scope'>) => (scope ? `${SCOPE_LABEL[scope]} ${kind}` : kind);

/** One World Details row. */
export interface CodeCardRow {
  label: string;
  value: string;
}

/** The world item a card names, for links that open or search it. */
export type CodeCardItem =
  | { kind: 'stat'; statId: string; entityId?: string }
  | { kind: 'trait'; traitId: string; entityId?: string }
  | { kind: 'placeholder'; placeholderId: string }
  | { kind: 'entity'; entityId: string }
  | { kind: 'dictionary'; dictionaryId: string }
  | { kind: 'location'; locationId: string };
/** One Allowed Values line. A weight of 0 never draws, so the card fades it. */
export interface CodeCardValue {
  text: string;
  /** Absent where values carry no weight, as clock dayparts don't. */
  weight?: number;
}

/** What a name can hold, cut to {@link CARD_LIST_CAP} values. */
export interface CodeCardValues {
  values: readonly CodeCardValue[];
  /** How many values the cut left out. */
  more: number;
}

/** An action a card offers. */
export type CodeCardLink =
  /** Move the caret to the declaration at `at`, on `line` (from 1). */
  | { id: 'goToLine'; at: number; line: number }
  /** Read the global's section of the Guide. */
  | { id: 'guide'; target: DocTarget };

export interface CodeCard {
  /** The span of code the card describes. */
  from: number;
  to: number;
  signature: CodeCardSignature;
  /** Absent where the name is no field a write could reach. */
  access?: CodeAccess;
  description?: string;
  allowedValues?: CodeCardValues;
  /** World Details, from the box's lookup. */
  rows?: CodeCardRow[];
  item?: CodeCardItem;
  /** What a slot starts as. Absent where the template declares none. */
  defaultValue?: string;
  links?: CodeCardLink[];
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

/** The type an element of each array shape has. */
const ELEMENT_ROOT: Record<ArrayElement, string> = { memory: 'Memory', entity: 'Entity', exit: 'Exit' };

/** What a member's path starts with: the type an entry of a map has, or the exact path of a one-off object. */
function memberRootName(value: CodeValue): string {
  switch (value.is) {
    case 'stat': return 'Stat';
    case 'statPrevious': return 'Stat.previous';
    case 'statDelta': return 'Stat.delta';
    case 'deltaSource': return `Stat.delta.${value.source}`;
    case 'trait': return 'Trait';
    case 'placeholders': return 'Placeholder';
    case 'entity': case 'owner': return 'Entity';
    case 'dictionary': return 'Dictionary';
    case 'dictionaryEntry': return 'DictionaryEntry';
    case 'locationEntry': return 'Location';
    case 'persona': return 'persona';
    case 'clock': case 'listed': return value.path;
    case 'array': return value.path ?? 'Array';
    case 'element': return ELEMENT_ROOT[value.of];
    default: return value.is;
  }
}

const STAT_TYPE_LABEL: Record<Stat['type'], string> = { number: 'Number', percentage: 'Percentage' };

/** A stat amount in the stat's own units. */
const amount = (stat: Stat, n: number) => `${n}${stat.type === 'percentage' ? '%' : ''}`;
const signed = (stat: Stat, n: number) => (n < 0 ? `−${amount(stat, -n)}` : `+${amount(stat, n)}`);

/** The tag and the Owners value where no one owns an item. */
export const NO_OWNERS_LABEL = 'No Owners';

/** An owner list as one value, cut at the cap. */
const ownersText = (owners: readonly string[]) => listText(owners, NO_OWNERS_LABEL);

type StatRecord = CodeStatRecord & { stat: Stat };

/**
 * A stat card's value rows, in order, with Owners among them. A row is left out where its `drops` holds: a field
 * at its default (Q27, Q35), or Owners on a global stat (Q8). Type and Range always show.
 */
const STAT_ROWS: readonly {
  label: string;
  value: (record: StatRecord) => string;
  drops?: (record: StatRecord) => boolean;
}[] = [
  { label: 'Type', value: ({ stat }) => STAT_TYPE_LABEL[stat.type] ?? stat.type },
  { label: 'Range', value: ({ stat }) => `${stat.min} – ${amount(stat, stat.max)}` },
  { label: 'Starts At', value: ({ stat }) => amount(stat, statStartValue(stat)), drops: ({ stat }) => statStartValue(stat) === statMin(stat) },
  {
    label: 'Regen',
    value: ({ stat }) => {
      const unit = regenUnitOf(stat);
      return `${signed(stat, regenPer(stat.regen, unit))} per story ${REGEN_UNIT_LABELS[unit].toLowerCase()}`;
    },
    drops: ({ stat }) => !stat.regen,
  },
  { label: 'Owners', value: ({ owners }) => ownersText(owners), drops: ({ scope }) => scope === 'global' },
  { label: 'Shown To', value: ({ stat }) => (stat.hidden ? 'AI only' : 'AI and player'), drops: ({ stat }) => !stat.hidden },
  { label: 'Off', value: () => 'Until a trait turns it on', drops: ({ stat }) => stat.enabled !== false },
];

/** The most names or values a card lists before "and N more". */
export const CARD_LIST_CAP = 12;

/** `names` as a comma list, cut at the cap. */
export function listText(names: readonly string[], empty = 'None'): string {
  if (!names.length) return empty;
  const shown = names.slice(0, CARD_LIST_CAP).join(', ');
  return names.length > CARD_LIST_CAP ? `${shown} and ${names.length - CARD_LIST_CAP} more` : shown;
}

const ownersRow = (owners: readonly string[]): CodeCardRow => ({ label: 'Owners', value: ownersText(owners) });

/** A stat's World Details. Only the Owners row where the lookup has no single stat to show (Q34). */
export function statRows(record: CodeStatRecord): CodeCardRow[] {
  const { stat } = record;
  if (!stat) return [ownersRow(record.owners)];
  const full = { ...record, stat };
  return STAT_ROWS.filter((row) => !row.drops?.(full)).map((row) => ({ label: row.label, value: row.value(full) }));
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

const TRAIT_MODE_LABEL: Record<TraitMode | 'optional', string> = { optional: 'Optional', alwaysOn: 'Automatic', hidden: 'Hidden' };

/** A trait's World Details: Mode, then Requires and Changes where set, then the owners. Only the owners where they differ (Q37). */
export function traitRows(record: CodeTraitRecord | CodeOwnersRecord): CodeCardRow[] {
  if (!record.trait) return [ownersRow(record.owners)];
  const { trait, requires, changes, owners, scope } = record;
  return [
    { label: 'Mode', value: TRAIT_MODE_LABEL[trait.mode ?? 'optional'] },
    // One line per Requirement Row; a row after the first holds instead of the ones above it.
    ...(requires.length ? [{ label: 'Requires', value: requires.map((row, i) => `${i ? 'or ' : ''}${row.join(' and ')}`).join('\n') }] : []),
    ...(changes.length ? [{ label: 'Changes', value: listText(changes) }] : []),
    // A global trait has no owner to list (Q8).
    ...(scope === 'global' ? [] : [ownersRow(owners)]),
  ];
}

function traitDetails(record: CodeTraitRecord | CodeOwnersRecord): Pick<CodeCard, 'description' | 'rows' | 'item'> {
  if (!record.trait) return { rows: traitRows(record) };
  const { trait, entityId } = record;
  const description = trait.playerDescription || trait.aiDescription;
  return {
    ...(description ? { description } : {}),
    rows: traitRows(record),
    item: { kind: 'trait', traitId: trait.id, ...(entityId ? { entityId } : {}) },
  };
}

/** Each value with its weight, weights a Copy changes included. */
export function placeholderValues(placeholder: Placeholder): CodeCardValues {
  const values = placeholder.values.map((value) => ({ text: value.text, weight: placeholderWeight(placeholder, value) }));
  return { values: values.slice(0, CARD_LIST_CAP), more: Math.max(0, values.length - CARD_LIST_CAP) };
}

function placeholderDetails(record: CodePlaceholderRecord | CodeOwnersRecord): Pick<CodeCard, 'rows' | 'item' | 'allowedValues'> {
  if (!record.placeholder) return { rows: [ownersRow(record.owners)] };
  const { placeholder, parent, pins, owners } = record;
  return {
    rows: [
      ...(owners.length ? [ownersRow(owners)] : []),
      ...(parent ? [{ label: 'Parent Placeholder', value: parent }] : []),
      { label: 'Kind', value: placeholderKindNoun(placeholder) },
      ...(pins.length ? [{ label: 'Pinned By', value: pins.join('\n') }] : []),
    ],
    item: { kind: 'placeholder', placeholderId: placeholder.id },
    allowedValues: placeholderValues(placeholder),
  };
}

/** Each entity `persona` or `owner` reaches, with options that read it as the only one. */
function reachedEntities(owner: PlaceholderOwner, options: SurfaceAnalysisOptions): [string, SurfaceAnalysisOptions][] {
  const { lookup } = options;
  if (owner.route === 'owner' && lookup) {
    return lookup.ownerEntityIds().map((id) => [id, { ...options, lookup: { ...lookup, ownerEntityIds: () => [id] } }]);
  }
  if (owner.route !== 'persona') return [];
  return (options.entities ?? []).filter((entity) => entity.persona).map((entity) => [entity.id, { ...options, entities: [entity] }]);
}

/** Each entity a `persona` or `owner` placeholder route reaches that owns the placeholder, with it. */
export function reachedPlaceholderOwners(
  owner: PlaceholderOwner, path: readonly string[], options: SurfaceAnalysisOptions,
  reached = reachedEntities(owner, options),
): CodePlaceholderOwner[] {
  return reached.flatMap(([entityId, each]) => {
    const placeholder = placeholderAt(owner, path, each);
    return placeholder ? [{ entityId, placeholder }] : [];
  });
}

/** An entity's World Details: what it is, then the names its maps hold. */
export function entityRows({ entity, stats, traits, placeholders }: CodeEntityRecord): CodeCardRow[] {
  return [
    ...(entity.type ? [{ label: 'Type', value: entity.type }] : []),
    ...(canBePlayer(entity) ? [{ label: 'Persona', value: 'Playable' }] : []),
    { label: 'Stats', value: listText(stats) },
    { label: 'Traits', value: listText(traits) },
    { label: 'Placeholders', value: listText(placeholders) },
  ];
}

function entityDetails(record: CodeEntityRecord): Pick<CodeCard, 'description' | 'rows' | 'item'> {
  const description = record.entity.playerDescription;
  return { ...(description ? { description } : {}), rows: entityRows(record), item: { kind: 'entity', entityId: record.entity.id } };
}

function dictionaryDetails({ dictionary, placeholders }: CodeDictionaryRecord): Pick<CodeCard, 'description' | 'rows' | 'item'> {
  return {
    ...(dictionary.description ? { description: dictionary.description } : {}),
    rows: [{ label: 'Placeholders', value: listText(placeholders) }, { label: 'Entries', value: String(dictionary.entries.length) }],
    item: { kind: 'dictionary', dictionaryId: dictionary.id },
  };
}

function locationDetails({ location, present }: CodeLocationRecord): Pick<CodeCard, 'description' | 'rows' | 'item'> {
  const description = location.playerDescription;
  return {
    ...(description ? { description } : {}),
    rows: [...(location.isStarting ? [{ label: 'Starting', value: 'Yes' }] : []), { label: 'Present', value: listText(present) }],
    item: { kind: 'location', locationId: location.id },
  };
}

const LIBRARY_PERSONA_NOTE = 'Under a library persona, reach the Custom Persona through entities[...]';

/** `self`, `owner` and `persona` as the lookup's world holds them, laid over their surface card. */
function boxGlobal(card: CodeCard, lookup: CodeWorldLookup, options: SurfaceAnalysisOptions): CodeCard {
  switch (card.signature.path) {
    case 'self': {
      // A trait script's `self` is its trait, as its owner's map keys it.
      if (options.surface.selfIs === 'trait') {
        const record = options.selfName ? lookup.trait({ route: options.owner ? 'owner' : 'world' }, options.selfName) : null;
        return record ? { ...card, ...traitDetails(record) } : card;
      }
      // A world script's `self` is empty, so its card keeps the surface line and names no stat.
      if (options.surface.selfIs === 'empty') return card;
      const record = lookup.self();
      const { rows = [], item } = statDetails(record);
      const scope = record.scope ? ` (${scopedKind({ kind: 'stat', scope: record.scope })})` : '';
      return { ...card, rows: [{ label: 'Stat', value: `${record.stat.name}${scope}` }, ...rows], ...(item ? { item } : {}) };
    }
    case 'persona': return {
      ...card,
      description: [card.description, LIBRARY_PERSONA_NOTE].filter(Boolean).join(' '),
      rows: [{ label: 'Can Play', value: listText(lookup.persona()) }],
    };
    // A world script's `owner` is empty too, and its surface line says so.
    case 'owner': return options.surface.selfIs === 'empty' ? card : ownerCard(card, lookup.owner());
    default: return card;
  }
}

function ownerCard(card: CodeCard, owner: CodeOwnerRecord | null): CodeCard {
  switch (owner?.kind) {
    case undefined: return card;
    case 'empty': return { ...card, description: 'Holds nothing in a global stat’s code. Writing through it changes nothing.' };
    case 'blueprint': return { ...card, rows: [ownersRow(owner.owners)] };
    // The entity is a world name, so its own description replaces the global's line (T16-1).
    case 'entity': return { ...card, ...entityDetails(owner.entity) };
  }
}

/** The six dayparts `clock.daypart` can hold, in the order a day runs. */
const DAYPARTS: CodeCardValues = { values: DAYPART_OPTIONS.map((text) => ({ text })), more: 0 };

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
 * card describes, as with a keyword.
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

/** The slot's type as the template wrote it: a choice keeps its options. */
const slotTypeText = (slot: { type: string; options?: string[] }) =>
  slot.options?.length ? `${slot.type}(${slot.options.join('|')})` : slot.type;

/** How the code declared the name at `at`, read from where the declaration sits in the tree. */
function declarationKind(code: string, at: number): DeclarationKind {
  for (let node: SyntaxNode | null = parseCode(code).resolveInner(at, 1); node; node = node.parent) {
    switch (node.name) {
      // A parameter reaches its ParamList first, so a FunctionDeclaration here is the function's own name.
      case 'FunctionDeclaration': return 'function';
      case 'ClassDeclaration': return 'class';
      case 'ParamList': case 'CatchClause': return 'parameter';
      case 'VariableDeclaration': case 'ForOfSpec': case 'ForSpec': case 'ForInSpec': {
        const keyword = /\b(const|let|var)\b/.exec(code.slice(node.from, at));
        if (keyword) return keyword[1] as DeclarationKind;
        break;
      }
    }
  }
  return 'var';
}

const withScope = (card: CodeCard, scope: CodeItemScope | undefined): CodeCard =>
  (scope ? { ...card, signature: { ...card.signature, scope } } : card);

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
      const base = entry ? fromEntry(entry, 'global', entry.name, span) : null;
      const target = entry && options.surface.guide?.[entry.name];
      const card = base && target ? { ...base, links: [{ id: 'guide' as const, target }] } : base;
      return card && options.lookup ? boxGlobal(card, options.lookup, options) : card;
    }
    case 'member': {
      // A member the value doesn't carry gets no card, though the resolver read the value as a stat.
      const entry = memberEntries(name.of, options)?.find((candidate) => candidate.name === name.key);
      if (!entry) return null;
      const card = fromEntry(entry, isMethodEntry(entry) ? 'method' : 'property', `${memberRootName(name.of)}.${entry.name}`, span);
      return name.of.is === 'clock' && entry.name === 'daypart' ? { ...card, allowedValues: DAYPARTS } : card;
    }
    case 'stat': {
      const card = world('stat', keyPath(`${ownerPrefix(name.owner)}stats`, name.key), 'Stat');
      const record = options.lookup?.stat(name.owner, name.key);
      return record ? { ...withScope(card, record.scope), ...statDetails(record) } : card;
    }
    case 'trait': {
      const card = world('trait', keyPath(`${ownerPrefix(name.owner)}traits`, name.key), 'Trait');
      const record = options.lookup?.trait(name.owner, name.key);
      return record ? { ...withScope(card, record.trait ? record.scope : undefined), ...traitDetails(record) } : card;
    }
    case 'placeholder': {
      const card = world('placeholder', name.path.reduce(keyPath, `${ownerPrefix(name.owner)}placeholders`), 'Placeholder');
      const { lookup } = options;
      if (!lookup) return card;
      // A route that reaches two or more entities follows Q37 (T15-1).
      const reached = reachedEntities(name.owner, options);
      const placeholder = reached.length < 2 && placeholderAt(name.owner, name.path, options);
      const record = reached.length > 1
        ? lookup.ownedPlaceholder(reachedPlaceholderOwners(name.owner, name.path, options, reached))
        : placeholder && lookup.placeholder(placeholder);
      return record ? { ...withScope(card, record.placeholder ? record.scope : undefined), ...placeholderDetails(record) } : card;
    }
    case 'entity': {
      const card = world('entity', keyPath('entities', name.key), 'Entity');
      const record = options.lookup?.entity(name.key);
      return record ? { ...card, ...entityDetails(record) } : card;
    }
    case 'dictionary': {
      const card = world('dictionary', keyPath('dictionaries', name.key), 'Dictionary');
      const record = options.lookup?.dictionary(name.key);
      return record ? { ...card, ...dictionaryDetails(record) } : card;
    }
    case 'dictionaryEntry': {
      const card = world('entry', keyPath(`${keyPath('dictionaries', name.dictionary)}.entries`, name.key), 'DictionaryEntry');
      const id = options.placeholders?.dictionaries?.findLast((book) => book.name === name.dictionary)
        ?.entries?.findLast((entry) => entry.name === name.key)?.id;
      const record = options.lookup?.dictionary(name.dictionary);
      const entry = id === undefined ? undefined : record?.dictionary.entries.find((each) => each.id === id);
      return entry && record
        ? { ...card, rows: [{ label: 'Trigger Keywords', value: listText(entry.key) }], item: { kind: 'dictionary', dictionaryId: record.dictionary.id } }
        : card;
    }
    case 'location': {
      const card = world('location', name.key, 'Location');
      const record = options.lookup?.location(name.key);
      return record ? { ...card, ...locationDetails(record) } : card;
    }
    case 'declared': {
      const line = code.slice(0, name.at).split('\n').length;
      return {
        ...span,
        signature: { kind: declarationKind(code, name.at), path: name.key },
        description: `Declared on line ${line}`,
        // On the declaration itself the caret is already there.
        ...(name.from === name.at ? {} : { links: [{ id: 'goToLine' as const, at: name.at, line }] }),
      };
    }
    case 'slot': {
      // A repeated name reads as its first declaration, as the form does.
      const slot = parseTemplateSlots(code).slots.find((candidate) => candidate.name === name.key);
      if (!slot) return null;
      return {
        ...span,
        signature: { kind: 'slot', path: slot.name, type: slotTypeText(slot) },
        ...(slot.defaultValue !== undefined ? { defaultValue: slot.defaultValue } : {}),
      };
    }
    default: return null;
  }
}
