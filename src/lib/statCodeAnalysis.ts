/**
 * Reading sandboxed code without running it: what a caret can be completed with, and what looks wrong.
 *
 * Both halves are plain functions over a code string — the editor's autocomplete source and linter are
 * thin adapters over these, so the behavior is testable without an editor mounted. What the code can
 * reach comes from the surface it is read against; nothing here widens what QuickJS exposes.
 */

import type { SyntaxNode, Tree } from '@lezer/common';
import type { CodeWorldLookup } from '@/lib/codeWorldLookup';
import type { PlaceholderOwners } from '@/lib/placeholderHomes';
import { placeholderKindNoun } from '@/lib/placeholders';
import { hasEntityKey } from '@/lib/statCodeNames';
import { memberRenameKey } from '@/lib/codeRenameChains';
import { rewrittenKey } from '@/lib/statCodeRename';
import { findSlotRanges, parseTemplateSlots } from '@/lib/statCodeTemplates';
import type { Placeholder } from '@/types';
import {
  isMethodEntry, nearestName, readOnlyEntries, surfaceHasGlobal, surfaceKnownNames, type CodeSurface, type SurfaceEntry,
} from '@/lib/codeSurface';
import type { SandboxDictionaryEntry } from '@/lib/statCodeExecutor';
import {
  clockFieldsAt, DELTA_FIELDS, DELTA_MEMBERS, PREVIOUS_FIELDS, SELF_WRITABLE_FIELDS, STAT_CODE_SURFACE, STAT_FIELDS,
  DICTIONARY_ENTRY_FIELDS, DICTIONARY_FIELDS, ENTITY_FIELDS, LOCATION_ENTRY_FIELDS, LOCATION_EXIT_FIELDS, MEMORY_ENTRY_FIELDS, PERSONA_FIELDS, SELF_TRAIT_FIELDS, SWITCHED_TRAIT_FIELDS, TRAIT_ENTRY_FIELDS, TRAIT_WRITABLE_FIELD, placeholderEntryFields,
} from '@/lib/statCodeSurface';
import {
  isIdentifier, isPlaceholderEntryMember, placeholderKeyWinner, placeholderPathLabel, placeholderPathMap,
  walkPlaceholderPath, type PlaceholderPathMap, type PlaceholderPathNode,
} from '@/lib/statCodePaths';
import {
  codeResolver, declaredNames, keyOwner, memberKey, parseCode, statLikeNames,
  type ArrayElement, type CodeOwnerKind, type CodeValue, type EntryRef, type PlaceholderOwner, type ResolvedCodeName, type StatOwner,
  type TraitOwner,
} from '@/lib/statCodeResolver';

export type { CodeOwnerKind };

export type DiagnosticSeverity = 'error' | 'warning';

export interface CodeDiagnostic {
  from: number;
  to: number;
  severity: DiagnosticSeverity;
  message: string;
  /** Set on an unknown name that no owner in the world holds and no near name matches. */
  missing?: MissingName;
  /** What can fix it, the near name first. */
  fixes?: CodeFix[];
}

/** One fix for a diagnostic: the text that replaces a stretch of the code. */
export interface CodeFix {
  label: string;
  from: number;
  to: number;
  insert: string;
}

/** A name the world does not have yet, by the global the code reaches it through. */
export interface MissingName {
  kind: EntryNoun;
  root: 'stats' | 'traits' | 'placeholders' | 'entities' | 'persona' | 'dictionaries';
  /** The keys from the root to the name, the owner's name first under `entities` and `dictionaries`. */
  segments: readonly string[];
}

/** Which list a completion came from, so the popup can badge it. Mirrors CodeMirror's own vocabulary. */
export type CompletionKind = 'variable' | 'property' | 'text' | 'keyword';

export interface CodeCompletion {
  label: string;
  detail?: string;
  info?: string;
  type: CompletionKind;
  /** Higher sorts nearer the top. Left off for the ordinary case. */
  boost?: number;
}

export interface CompletionResult {
  /** Start of the text being replaced — the word already typed. */
  from: number;
  to: number;
  options: CodeCompletion[];
}

/** One owner of placeholders by id, under its code name. */
export interface CodeOwnerName {
  id: string;
  name: string;
}

/** The world's placeholders, the entity or book each scoped one lives on, and every book. */
export interface CodePlaceholders {
  list: readonly Placeholder[];
  owners?: PlaceholderOwners;
  /** Every dictionary in authored order. Absent, dictionary names are neither offered nor checked. A book's
   *  `entries`, absent, leaves its entry names neither offered nor checked. */
  dictionaries?: readonly CodeDictionaryNames[];
}

/** A book's code name and its enabled entries under their code names. */
export interface CodeDictionaryNames extends CodeOwnerName {
  entries?: readonly SandboxDictionaryEntry[];
}

/** One trait as a template slot lists it, placed in its owner's tree. */
export interface CodeTraitPlace {
  id: string;
  name: string;
  /** Group names under their code names, outermost first. Empty at the top level. */
  path: readonly string[];
  /** Its place in its owner's Traits tab. Absent ⇒ list order. */
  tabPosition?: number;
}

/** One entity as the editor reads it: its code name and the code names of its trait set, owned or linked. */
export interface CodeEntityNames extends CodeOwnerName {
  /** Its type and pronouns as code reads them. Absent ⇒ empty. */
  type?: string;
  pronouns?: string;
  traits: readonly CodeTraitPlace[];
  /** The code names of its own stats, in authored order. Absent ⇒ none. */
  stats?: readonly string[];
  /** Whether a persona choice can play it, so `persona.placeholders` can reach its own. */
  persona: boolean;
  /** Its Entity folder names, outermost first. Absent ⇒ top level. */
  folder?: readonly string[];
  /** Its place in the Entities tab. Absent ⇒ authored order. */
  tabPosition?: number;
}

export interface AnalysisOptions {
  /** Treat `{{name:type=default}}` spans as opaque. Template editing only. */
  slots?: boolean;
  /** Absent, placeholder names are neither offered nor checked. */
  placeholders?: CodePlaceholders;
  /** The world's trait names, in authored order. Absent, trait names are neither offered nor checked. */
  traits?: readonly string[];
  /** The world's entities, in authored order. Absent, entity and persona trait names are neither offered nor
   *  checked. A library entity can carry another name, so an unknown one is only a warning. */
  entities?: readonly CodeEntityNames[];
  /** The world's location code names, in authored order. Absent, location names are not offered. */
  locations?: readonly string[];
  /** The global stat names, in authored order: what `stats` keys in every box. Absent, stat names are neither
   *  offered nor checked. */
  statNames?: readonly string[];
  /** Whose code this is. Absent in a global stat's box. */
  owner?: CodeOwnerKind;
  /** The stat names `owner.stats` keys: the entity's own, or a Blueprint group's. None in a global stat's box,
   *  where `owner` is empty. Absent, `owner.stats` names are neither offered nor checked. */
  ownerStatNames?: readonly string[];
  /** The name of the stat the code belongs to, so a write to that name counts as its own: through
   *  `owner.stats` in an owned box, through `stats` in a global stat's. */
  selfName?: string;
  /** What a card asks the world when it opens. Absent, cards show no World Details. Never a lint input. */
  lookup?: CodeWorldLookup;
}

/** The options a reader takes for any surface. */
export interface SurfaceAnalysisOptions extends AnalysisOptions {
  /** What the code can reach. */
  surface: CodeSurface;
}

/** Which of the stat-code maps the surface injects, and so which of their rules apply. */
function statRulesOf(surface: CodeSurface) {
  const has = (name: string) => surface.statMaps && surfaceHasGlobal(surface, name);
  return {
    stats: has('stats'), self: has('self'), owner: has('owner'), placeholders: has('placeholders'), traits: has('traits'),
    persona: has('persona'), entities: has('entities'), dictionaries: has('dictionaries'),
  };
}

type StatRules = ReturnType<typeof statRulesOf>;

const isWordChar = (character: string) => /[A-Za-z0-9_$]/.test(character);

/** Where the word under `pos` starts, so a completion replaces what has been typed rather than doubling it. */
function wordStart(code: string, pos: number): number {
  let start = pos;
  while (start > 0 && isWordChar(code[start - 1])) start -= 1;
  return start;
}

/** The slot spans to leave alone, or none when the surface has no slots. */
const slotRanges = (code: string, options?: AnalysisOptions) =>
  options?.slots ? findSlotRanges(code) : [];

const overlapsAny = (from: number, to: number, ranges: { from: number; to: number }[]) =>
  ranges.some((range) => from <= range.to && to >= range.from);

/** Whether stat-like source reaches the current stat's own entry: `self`, or the map that holds it indexed by
 *  its own name. That map is `owner.stats` in an owned box and `stats` in a global stat's.
 *  A `!==` against `self.id` finds some other stat, so it doesn't count. */
const reachesOwnStat = (text: string, selfName: string | undefined, owned: boolean) =>
  /\bself\b/.test(text.replace(/!==?\s*self\.id\b|\bself\.id\s*!==?/g, ''))
  || (selfName !== undefined && indexesStat(text, selfName, owned));

/** What one entry of a name-keyed sandbox map is called in a message. */
export type EntryNoun = 'placeholder' | 'trait' | 'stat' | 'entity' | 'dictionary';

const PLURAL: Record<EntryNoun, string> = {
  placeholder: 'placeholders', trait: 'traits', stat: 'stats', entity: 'entities', dictionary: 'dictionaries',
};

/** One entry per distinct name of a `kind` of map entry. `dotted` keeps only the names a `.` can reach; the
 *  rest need bracket syntax. */
function mapNameEntries(names: readonly string[], kind: EntryNoun, dotted: boolean): SurfaceEntry[] {
  return [...new Set(names)]
    .filter((name) => !dotted || isIdentifier(name))
    .map((name) => ({ name, detail: kind, info: `The “${name}” ${kind} in this world` }));
}

/** One key of a member chain, by dot or by quoted bracket; the name is in group 1 or group 2. No
 *  backreference, so the pattern can repeat in one expression. */
const KEY_STEP = String.raw`(?:\??\.([A-Za-z_$][\w$]*)|\??\.?\[\s*["']([^"'\\]*)["']\s*\])`;
/** The source of an owner's stat map: `entities.Name.stats`, `persona.stats` or `owner.stats`. The entity name is
 *  in group 1 or 2, absent for the other two. */
const OWNER_STATS_MAP = `(?:entities${KEY_STEP}|persona|owner)\\??\\.stats`;
const OWNER_STATS_EXPRESSION = new RegExp(`^${OWNER_STATS_MAP}$`);
/** One entry of any stat map, the key literal or computed: every key reads a stat, if only a blank one. The
 *  map is `stats`, or an owner's `stats`. */
const STAT_ENTRY_EXPRESSION = new RegExp(`^(?:stats|${OWNER_STATS_MAP})(\\??\\.[A-Za-z_$][\\w$]*|\\??\\.?\\[[^[\\]]*\\])$`);
/** One stat picked out of `Object.values(<stat map>)`, the call's arguments captured. `filter` hands back
 *  another array, so it stays quiet. */
const ITERATED_STAT_EXPRESSION = new RegExp(
  `^Object\\.values\\(\\s*(?:stats|${OWNER_STATS_MAP})\\s*\\)(?:\\.(?:find|at|pop|shift)(?<args>\\(.*\\))|\\[[^[\\]]*\\])$`,
);

/** The entity an `entities.Name…` expression names, from a match of one of the patterns above. */
const entityNamed = (match: RegExpExecArray) => match[1] ?? match[2];

/** One entry per distinct entity name. `dotted` keeps only the names a `.` can reach. */
const entityNameEntries = (entities: readonly CodeEntityNames[], dotted: boolean): SurfaceEntry[] =>
  mapNameEntries(keyedEntityNames(entities), 'entity', dotted);

/** The entity names the sandbox keys. */
export const keyedEntityNames = (entities: readonly CodeEntityNames[]): string[] =>
  entities.map((entity) => entity.name).filter(hasEntityKey);

/** The trait names of the last authored entity called `name`, as the sandbox keys it. An unnamed one is not keyed. */
export const traitsOfEntity = (entities: readonly CodeEntityNames[], name: string): readonly string[] | null =>
  keyedEntity(entities, name)?.traits.map((trait) => trait.name) ?? null;

/** The last authored entity called `name`, which the sandbox keys. An unnamed one is not keyed. */
export const keyedEntity = (entities: readonly CodeEntityNames[], name: string): CodeEntityNames | undefined =>
  (hasEntityKey(name) ? entities.findLast((entity) => entity.name === name) : undefined);

/** The global an owner-stats match starts at: `persona`, `owner`, or `entities`. */
const statsRootOf = (match: RegExpExecArray): 'persona' | 'owner' | 'entities' =>
  (match[0].startsWith('persona') ? 'persona' : match[0].startsWith('owner') ? 'owner' : 'entities');

/** The stat names a stat map keys: the world's, the box owner's, every persona entity's, or one entity's.
 *  Null where the names are not given. */
function statNamesOf(options: AnalysisOptions, owner: StatOwner): readonly string[] | null {
  if (owner.route === 'world') return options.statNames ?? null;
  if (owner.route === 'owner') return options.ownerStatNames ?? null;
  const { entities } = options;
  if (!entities) return null;
  if (owner.route === 'persona') return entities.filter((entity) => entity.persona).flatMap((entity) => entity.stats ?? []);
  return keyedEntity(entities, owner.entity)?.stats ?? [];
}

/** The trait names a trait map keys, or null where they are not given. The box owner's come from the card
 *  lookup, so they never reach lint. */
function traitNamesOf(options: AnalysisOptions, owner: TraitOwner): readonly string[] | null {
  if (owner.route === 'world') return options.traits ?? null;
  if (owner.route === 'persona') return personaTraitsOf(options.entities);
  if (owner.route === 'entity') return options.entities ? traitsOfEntity(options.entities, owner.entity) : null;
  const ids = options.lookup?.ownerEntityIds();
  const held = ids && options.entities?.filter((entity) => ids.includes(entity.id));
  return held ? [...new Set(held.flatMap((entity) => entity.traits.map((trait) => trait.name)))] : null;
}

/** The trait names a persona in the world can hold, or null when no entities are given. */
export const personaTraitsOf = (entities: readonly CodeEntityNames[] | undefined): readonly string[] | null =>
  (entities ? entities.filter((entity) => entity.persona).flatMap((entity) => entity.traits.map((trait) => trait.name)) : null);

/** One entry per distinct persona trait name. `dotted` keeps only the names a `.` can reach. */
const personaTraitEntries = (names: readonly string[], dotted: boolean): SurfaceEntry[] =>
  [...new Set(names)]
    .filter((name) => !dotted || isIdentifier(name))
    .map((name) => ({ name, detail: 'trait', info: `The “${name}” trait of a persona in this world` }));

/** Which tree a placeholder chain walks: the world's `placeholders`, or one owner entry's `placeholders`. */
type PlaceholderRouteKind = 'world' | 'entity' | 'persona' | 'dictionary';

/** One placeholder chain: where it starts, the owner's name where an entry names one, and its keys. */
interface PlaceholderRoute {
  kind: PlaceholderRouteKind;
  owner?: string;
  segments: string[];
}

/** The global each route hangs off. */
const ROUTE_GLOBAL: Record<PlaceholderRouteKind, Exclude<MissingName['root'], 'stats' | 'traits'>> = {
  world: 'placeholders', entity: 'entities', persona: 'persona', dictionary: 'dictionaries',
};

/** The route a resolved `placeholders` value walks. */
function placeholderRouteOf(owner: PlaceholderOwner, path: readonly string[]): PlaceholderRoute | null {
  const segments = [...path];
  switch (owner.route) {
    case 'entity': return { kind: 'entity', owner: owner.entity, segments };
    case 'dictionary': return { kind: 'dictionary', owner: owner.dictionary, segments };
    // The box owner's placeholders are not given to the editor.
    case 'owner': return null;
    default: return { kind: owner.route, segments };
  }
}

/** The map a set of options describes, built through the one resolver. */
const pathMapOf = (placeholders: CodePlaceholders): PlaceholderPathMap =>
  placeholderPathMap({ list: placeholders.list, owners: placeholders.owners });

/** An owner node that holds nothing, for an owner the world knows with no placeholders of its own. */
const emptyOwner = (name: string): PlaceholderPathNode => ({ name, placeholder: null, path: [name], children: [] });

/** The node a route starts from: null for the world's map, the owner's node, or every playable entity's node
 *  for `persona`. Undefined for an owner the world lacks or the surface doesn't inject. */
function routeStart(
  route: PlaceholderRoute, placeholders: CodePlaceholders, options: AnalysisOptions, rules: StatRules,
): PlaceholderPathNode | null | undefined {
  if (!rules[ROUTE_GLOBAL[route.kind]]) return undefined;
  if (route.kind === 'world') return null;
  const map = pathMapOf(placeholders);
  if (route.kind === 'persona') {
    const played = (options.entities ?? []).filter((entity) => entity.persona);
    return { ...emptyOwner('persona'), children: played.flatMap((entity) => map.owners.get(entity.id)?.children ?? []) };
  }
  const named = (route.kind === 'entity' ? options.entities : placeholders.dictionaries)?.findLast((owner) => owner.name === route.owner);
  return named ? map.owners.get(named.id) ?? emptyOwner(named.name) : undefined;
}

/** One node as a completion: the placeholder it reads, or the owner whose placeholders it carries. */
function nodeEntry(node: PlaceholderPathNode): SurfaceEntry {
  if (!node.placeholder) {
    const noun = node.owner?.kind === 'dictionary' ? 'book' : 'entity';
    return { name: node.name, detail: noun, info: `The “${node.name}” ${noun}, with its own placeholders` };
  }
  const own = node.children.length ? '. It has placeholders of its own.' : '';
  return { name: node.name, detail: 'placeholder', info: `The “${node.name}” placeholder in this world${own}` };
}

/** Whether a parenthesized argument list closes only at its last character, so nothing chains after it. */
function closesAtEnd(args: string): boolean {
  let depth = 0;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '(') depth += 1;
    else if (args[i] === ')' && (depth -= 1) === 0 && i < args.length - 1) return false;
  }
  return depth === 0;
}

/** Whether the expression before a `.` is recognizably a stat, so its fields are the honest list. */
function looksLikeStat(code: string, tree: Tree, expression: string): boolean {
  if (expression === 'self' || STAT_ENTRY_EXPRESSION.test(expression)) return true;
  const iterated = ITERATED_STAT_EXPRESSION.exec(expression);
  if (iterated) return iterated.groups?.args === undefined || closesAtEnd(iterated.groups.args);
  return statLikeNames(code, tree).has(expression);
}

/** Whether `text` indexes the map that holds the running stat by the literal `name`, by dot or by bracket:
 *  `owner.stats` when `owned`, else the global `stats`, which no member of another owner's `stats` is. */
function indexesStat(text: string, name: string, owned: boolean): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The global `stats` has no dot in front of it: a dotted one is a member of another object, caught in group 1.
  const map = owned ? String.raw`()\bowner\s*\??\.\s*stats` : String.raw`(\??\.\s*)?\bstats`;
  const reaches = (pattern: string) => [...text.matchAll(new RegExp(pattern, 'g'))].some((match) => !match[1]);
  if (reaches(`${map}\\s*(?:\\?\\.)?\\[\\s*(["'\`])${escaped}\\2\\s*\\]`)) return true;
  return isIdentifier(name) && reaches(`${map}\\s*\\??\\.\\s*${escaped}(?![\\w$])`);
}

/** Where a `placeholders` value's walk starts and the keys it walks. The box owner's start is every entity
 *  the card lookup says `owner` holds. Null where the world or the owner is unknown. */
function placeholderWalk(
  owner: PlaceholderOwner, path: readonly string[], options: AnalysisOptions, rules: StatRules,
): { start: PlaceholderPathNode | null; segments: readonly string[] } | null {
  const { placeholders } = options;
  if (!placeholders) return null;
  if (owner.route === 'owner') {
    const ids = rules.owner ? options.lookup?.ownerEntityIds() : undefined;
    if (!ids) return null;
    const map = pathMapOf(placeholders);
    return { start: { ...emptyOwner('owner'), children: ids.flatMap((id) => map.owners.get(id)?.children ?? []) }, segments: path };
  }
  const route = placeholderRouteOf(owner, path);
  const start = route && routeStart(route, placeholders, options, rules);
  return route && start !== undefined ? { start, segments: route.segments } : null;
}

/** The keys a `placeholders` bracket can reach, quoted names included, or null where the world or the owner is unknown. */
function placeholderKeysInBrackets(
  owner: PlaceholderOwner, path: readonly string[], options: AnalysisOptions, rules: StatRules,
): SurfaceEntry[] | null {
  const walk = placeholderWalk(owner, path, options, rules);
  if (!walk || !options.placeholders) return null;
  const map = pathMapOf(options.placeholders);
  // Keys only, never paths: one bracket holds one key, so a path has to be written bracket by bracket.
  if (!walk.start && walk.segments.length === 0) return map.top.map(nodeEntry);
  const { node, rest } = walkPlaceholderPath(map, walk.segments, walk.start);
  return rest.length === 0 && node ? node.children.map(nodeEntry) : [];
}

/** The placeholder a resolved placeholder name reads, or null where the editor can't tell. */
export function placeholderAt(
  owner: PlaceholderOwner, path: readonly string[], options: SurfaceAnalysisOptions,
): Placeholder | null {
  const walk = placeholderWalk(owner, path, options, statRulesOf(options.surface));
  if (!walk || !options.placeholders) return null;
  const { node, rest } = walkPlaceholderPath(pathMapOf(options.placeholders), walk.segments, walk.start);
  return rest.length === 0 ? node?.placeholder ?? null : null;
}

/** The names a stat, trait, entity or dictionary map keys, as entries: null where they are not given, undefined
 *  for any other value. `dotted` keeps only the names a `.` can reach. */
function mapKeyEntries(map: CodeValue, options: AnalysisOptions, dotted: boolean): SurfaceEntry[] | null | undefined {
  switch (map.is) {
    case 'statMap': {
      const names = statNamesOf(options, map.owner);
      return names && mapNameEntries(names, 'stat', dotted);
    }
    case 'traitMap': {
      const names = traitNamesOf(options, map.owner);
      return names && (map.owner.route === 'persona' ? personaTraitEntries(names, dotted) : mapNameEntries(names, 'trait', dotted));
    }
    case 'entityMap': return options.entities ? entityNameEntries(options.entities, dotted) : null;
    case 'dictionaryMap': {
      const books = options.placeholders?.dictionaries;
      return books ? mapNameEntries(books.map((book) => book.name), 'dictionary', dotted) : null;
    }
    case 'dictionaryEntryMap': {
      const books = options.placeholders?.dictionaries;
      if (!books) return null;
      // An unknown book reads as the blank book, whose entries map is empty.
      const book = books.findLast((each) => each.name === map.dictionary);
      const entries = book ? book.entries : [];
      return entries && [...new Set(entries.map((entry) => entry.name))]
        .filter((name) => !dotted || isIdentifier(name))
        .map((name) => ({ name, detail: 'entry', info: `The “${name}” entry in the “${map.dictionary}” dictionary` }));
    }
    case 'locationMap': return options.locations ? [...new Set(options.locations)].filter((name) => !dotted || isIdentifier(name))
      .map((name) => ({ name, detail: 'location', info: `The “${name}” location in this world` })) : null;
    default: return undefined;
  }
}

/** The object of the member expression whose bracket key holds `node` at any depth, as in `stats["a" + b]`. */
function bracketObjectAround(node: SyntaxNode): SyntaxNode | null {
  for (let at: SyntaxNode = node; at.parent; at = at.parent) {
    const member = keyOwner(at);
    if (member) return member.firstChild && member.firstChild.from < at.from ? member.firstChild : null;
  }
  return null;
}

/** The keys to offer inside a bracket on `map`, or null where the map is none the sandbox keys by name. */
function bracketKeys(map: CodeValue, options: AnalysisOptions, rules: StatRules): SurfaceEntry[] | null {
  if (map.is === 'placeholders') return placeholderKeysInBrackets(map.owner, map.path, options, rules);
  const keys = mapKeyEntries(map, options, false);
  return keys === undefined ? null : keys ?? [];
}

/**
 * What a path reaches, as the members to offer after its dot. An owner node lists its placeholders; a
 * placeholder lists its own members, then the placeholders it holds. One trailing segment nothing answers
 * reads as an entry being named, so a half-typed name still offers the members it will have.
 */
function placeholderMembersAt(
  placeholders: CodePlaceholders, segments: readonly string[], start: PlaceholderPathNode | null,
): readonly SurfaceEntry[] | null {
  const map = pathMapOf(placeholders);
  if (!start && segments.length === 0) return map.top.filter((node) => isIdentifier(node.name)).map(nodeEntry);
  const { node, rest } = walkPlaceholderPath(map, segments, start);
  if (rest.length === 0 && node) {
    const children = node.children.filter((child) => isIdentifier(child.name)).map(nodeEntry);
    if (!node.placeholder) return children;
    // A child named like a member lost to it, so the member is what the list offers for that name.
    const fields = placeholderEntryFields(placeholderKindNoun(node.placeholder));
    return [...fields, ...children.filter((child) => !isPlaceholderEntryMember(child.name))];
  }
  // Past one unknown segment nothing is known; a member read off an entry carries no sandbox members at all.
  if (rest.length === 1 && !isPlaceholderEntryMember(rest[0])) return placeholderEntryFields('Wildcard');
  return null;
}

/** The members of one element of each array shape. */
const ELEMENT_FIELDS: Record<ArrayElement, readonly SurfaceEntry[]> = { memory: MEMORY_ENTRY_FIELDS, entity: ENTITY_FIELDS, exit: LOCATION_EXIT_FIELDS };

/** What a resolved expression carries after its dot, or null where nothing can be shown. A wrong list would
 *  claim the sandbox holds something it doesn't. */
function membersOf(value: CodeValue, options: SurfaceAnalysisOptions, rules: StatRules): readonly SurfaceEntry[] | null {
  const keys = mapKeyEntries(value, options, true);
  if (keys !== undefined) return keys;
  switch (value.is) {
    case 'stat': return STAT_FIELDS;
    case 'statPrevious': return PREVIOUS_FIELDS;
    case 'statDelta': return DELTA_MEMBERS;
    case 'deltaSource': return DELTA_FIELDS;
    case 'trait': return TRAIT_ENTRY_FIELDS;
    case 'selfTrait': return SELF_TRAIT_FIELDS;
    case 'switchedTrait': return SWITCHED_TRAIT_FIELDS;
    case 'placeholders': {
      const walk = placeholderWalk(value.owner, value.path, options, rules);
      return walk && options.placeholders ? placeholderMembersAt(options.placeholders, walk.segments, walk.start) : null;
    }
    case 'entity': case 'owner': return ENTITY_FIELDS;
    case 'persona': return PERSONA_FIELDS;
    case 'dictionary': return DICTIONARY_FIELDS;
    case 'dictionaryEntry': return DICTIONARY_ENTRY_FIELDS;
    case 'locationEntry': return LOCATION_ENTRY_FIELDS;
    case 'clock': return clockFieldsAt(value.path);
    case 'array': return value.path === null ? null : options.surface.members.get(value.path) ?? null;
    case 'element': return ELEMENT_FIELDS[value.of];
    case 'listed': return options.surface.members.get(value.path) ?? null;
    default: return null;
  }
}

/** The members a resolved value carries, as completion offers them after its dot. */
export const memberEntries = (value: CodeValue, options: SurfaceAnalysisOptions): readonly SurfaceEntry[] | null =>
  surfaceMembersOf(value, options, statRulesOf(options.surface));

/** `membersOf` as the surface exposes it: on a read-only surface, the sandbox's own values have no method and
 *  every field read-only. A built-in such as `Math` keeps its members. */
function surfaceMembersOf(value: CodeValue, options: SurfaceAnalysisOptions, rules: StatRules): readonly SurfaceEntry[] | null {
  const members = membersOf(value, options, rules);
  const { surface } = options;
  const builtin = value.is === 'listed' && surface.builtins.some((entry) => entry.name === value.path.split('.')[0]);
  return members && surface.readOnly && !builtin ? readOnlyEntries(members.filter((entry) => !isMethodEntry(entry))) : members;
}

/** Whether a map entry's key is missing from the names its map holds. False where those names are not given. */
export function isUnknownEntry(name: ResolvedCodeName, options: SurfaceAnalysisOptions): boolean {
  const keysOf = (): readonly SurfaceEntry[] | null | undefined => {
    switch (name.kind) {
      case 'stat': return mapKeyEntries({ is: 'statMap', owner: name.owner }, options, false);
      case 'trait': return mapKeyEntries({ is: 'traitMap', owner: name.owner }, options, false);
      case 'entity': return mapKeyEntries({ is: 'entityMap' }, options, false);
      case 'dictionary': return mapKeyEntries({ is: 'dictionaryMap' }, options, false);
      case 'dictionaryEntry': return mapKeyEntries({ is: 'dictionaryEntryMap', dictionary: name.dictionary }, options, false);
      case 'placeholder': return placeholderKeysInBrackets(name.owner, name.path.slice(0, -1), options, statRulesOf(options.surface));
      default: return null;
    }
  };
  const keys = keysOf();
  return !!keys && !keys.some((entry) => entry.name === name.key);
}

/** The span of a retired global's member read at `name`, `scene.traits`, and the sentence naming its new form. */
function retiredRead(name: SyntaxNode, code: string, surface: CodeSurface): { from: number; to: number; newForm: string } | null {
  const members = surface.retired?.[code.slice(name.from, name.to)];
  const read = name.parent;
  if (!members || read?.name !== 'MemberExpression' || read.firstChild?.from !== name.from) return null;
  const property = read.getChild('PropertyName');
  const member = property ? code.slice(property.from, property.to) : '';
  return Object.hasOwn(members, member) ? { from: read.from, to: read.to, newForm: members[member] } : null;
}

/** The member expression an assignment, `++` or `--` writes to, or null when it writes something else. */
function writeTarget(node: SyntaxNode, code: string): SyntaxNode | null {
  if (node.name === 'AssignmentExpression') {
    return node.firstChild?.name === 'MemberExpression' ? node.firstChild : null;
  }
  if (node.name !== 'PostfixExpression' && node.name !== 'UnaryExpression') return null;
  const op = node.getChild('ArithOp');
  if (!op || !['++', '--'].includes(code.slice(op.from, op.to))) return null;
  return node.getChild('MemberExpression');
}

/** The writable fields as code spells them off `path`: `self.value, self.min, …`. */
const writableList = (path: string) => SELF_WRITABLE_FIELDS.map((field) => `${path}.${field}`).join(', ');

/** One write to a member: whether it reaches a stat's field, and what is wrong with it. */
interface WriteCheck {
  /** Whether the write reaches a field of a stat, the code's own or another's. */
  writes: boolean;
  problem: CodeDiagnostic | null;
}

/** A write to `field` on a stat's entry, reached as `path`: fine for a writable field, an error otherwise.
 *  The error lists the writable fields off `listedAs`: `self` for the own entry, else the path. */
function checkField(field: SyntaxNode | null, path: string, code: string, listedAs: string): WriteCheck {
  // A bracketed field can't be named without running the code.
  if (!field) return { writes: true, problem: null };
  const name = code.slice(field.from, field.to);
  const known = STAT_FIELDS.some((entry) => entry.name === name);
  if (known && SELF_WRITABLE_FIELDS.includes(name)) return { writes: true, problem: null };
  const suggestion = known ? null : nearestName(name, STAT_FIELDS.map((entry) => entry.name));
  const message = known ? `${path}.${name} can’t be written. Only ${writableList(listedAs)} can.`
    : suggestion ? `${path} has no field “${name}”. Did you mean “${suggestion}”?` : `${path} has no field “${name}”.`;
  return { writes: true, problem: suggested({ from: field.from, to: field.to, severity: 'error', message }, suggestion) };
}

function checkWrite(
  target: SyntaxNode, code: string, tree: Tree, declared: Set<string>, selfName: string | undefined, owned: boolean,
): WriteCheck {
  const reachesOwn = (text: string) => reachesOwnStat(statLikeNames(code, tree).get(text) ?? text, selfName, owned);
  // `stats.Name = …` replaces the whole entry, which the host never reads back, even for the stat's own name.
  const targetText = code.slice(target.from, target.to);
  if (STAT_ENTRY_EXPRESSION.test(targetText)) {
    const message = `Write to ${reachesOwn(targetText) ? 'self' : targetText}.value instead.`;
    return { writes: false, problem: { from: target.from, to: target.to, severity: 'warning', message } };
  }
  // Walk in to the stat the chain starts from, so a write nested in `previous` or `delta` is caught too.
  for (let member: SyntaxNode | null = target; member?.name === 'MemberExpression'; member = member.firstChild) {
    const entry = member.firstChild;
    if (!entry) break;
    const text = code.slice(entry.from, entry.to);
    if (text === 'self' && declared.has('self')) return { writes: true, problem: null };
    if (!looksLikeStat(code, tree, text)) continue;
    return checkField(member.getChild('PropertyName'), text, code, reachesOwn(text) ? 'self' : text);
  }
  return { writes: false, problem: null };
}

/** The variable a member chain starts from, like `placeholders` in `placeholders.Mood.value`. */
function memberRoot(member: SyntaxNode, code: string): string | null {
  let innermost = member;
  while (innermost.firstChild?.name === 'MemberExpression') innermost = innermost.firstChild;
  const root = innermost.firstChild;
  return root?.name === 'VariableName' ? code.slice(root.from, root.to) : null;
}

/** Whether `node` is a `.pin(text)` or `.unpin()` call off `placeholders` or an owner entry — a write, exactly
 *  as an assignment to `.value` is. */
function isPlaceholderWriteCall(node: SyntaxNode, code: string, inScope: (root: string | null) => boolean): boolean {
  const callee = node.firstChild;
  if (callee?.name !== 'MemberExpression') return false;
  const property = callee.getChild('PropertyName');
  if (!property) return false;
  const name = code.slice(property.from, property.to);
  return (name === 'pin' || name === 'unpin') && inScope(memberRoot(callee, code));
}

/** The name a `root.Name` or `root["Name"]` member names, or null for any other member and for a key only a
 *  run could know. */
function entryRef(
  node: SyntaxNode, code: string, root: 'placeholders' | 'traits' | 'stats' | 'persona' | 'owner' | 'entities' | 'dictionaries',
): EntryRef | null {
  const object = node.firstChild;
  if (object?.name !== 'VariableName' || code.slice(object.from, object.to) !== root) return null;
  return memberKey(node, code);
}

/** Whether `node` is `persona.traits` or `owner.traits`, `root`'s trait map. */
function isRootTraits(node: SyntaxNode | null, code: string, root: 'persona' | 'owner'): boolean {
  if (node?.name !== 'MemberExpression') return false;
  const property = node.getChild('PropertyName');
  return !!property && code.slice(property.from, property.to) === 'traits' && !!entryRef(node, code, root);
}

/** The name a `persona.traits.Name` or `persona.traits["Name"]` member names, as `entryRef` reads `traits`. */
const personaTraitRef = (node: SyntaxNode, code: string): EntryRef | null =>
  (isRootTraits(node.firstChild, code, 'persona') ? memberKey(node, code) : null);

/** The trait an `owner.traits.Name` member names. */
const ownerTraitRef = (node: SyntaxNode, code: string): EntryRef | null =>
  (isRootTraits(node.firstChild, code, 'owner') ? memberKey(node, code) : null);

/** An `entities.Name.traits.Trait` member: the entity and the trait it names. */
function entityTraitParts(node: SyntaxNode, code: string): { entity: EntryRef; trait: EntryRef } | null {
  const traits = node.firstChild;
  if (traits?.name !== 'MemberExpression') return null;
  const property = traits.getChild('PropertyName');
  const entry = traits.firstChild;
  if (!property || code.slice(property.from, property.to) !== 'traits' || entry?.name !== 'MemberExpression') return null;
  const entity = entryRef(entry, code, 'entities');
  const trait = entity && memberKey(node, code);
  return entity && trait ? { entity, trait } : null;
}

/** The trait an `entities.Name.traits.Trait` member names. */
const entityTraitRef = (node: SyntaxNode, code: string): EntryRef | null => entityTraitParts(node, code)?.trait ?? null;

/** A trait map's entry reader: `traits`, `persona.traits` or an entity's `traits`. */
type TraitEntryOf = (node: SyntaxNode, code: string) => EntryRef | null;
const worldTraitRef: TraitEntryOf = (node, code) => entryRef(node, code, 'traits');

/** A placeholder chain off the tree: its route, the owner's key where an entry names one, and its keys, each
 *  with where it is written. A step whose key only a run could know ends the chain, as the text parser does. */
interface PlaceholderChain {
  kind: PlaceholderRouteKind;
  owner?: EntryRef;
  refs: EntryRef[];
}

/** The chain `node` is, through `placeholders` or an owner entry's `placeholders`, or null for any other. */
function placeholderChainRoute(node: SyntaxNode, code: string): PlaceholderChain | null {
  const members: SyntaxNode[] = [];
  let at: SyntaxNode | null = node;
  while (at?.name === 'MemberExpression') {
    members.unshift(at);
    at = at.firstChild;
  }
  if (at?.name !== 'VariableName') return null;
  const root = code.slice(at.from, at.to);
  const keys = members.map((member) => memberKey(member, code));
  const take = (from: number): EntryRef[] => {
    const refs: EntryRef[] = [];
    for (const key of keys.slice(from)) {
      if (!key) break;
      refs.push(key);
    }
    return refs;
  };
  if (root === 'placeholders') return { kind: 'world', refs: take(0) };
  if (root === 'persona' && keys[0]?.name === 'placeholders') return { kind: 'persona', refs: take(1) };
  const owner = keys[0];
  if ((root === 'entities' || root === 'dictionaries') && owner && keys[1]?.name === 'placeholders') {
    return { kind: root === 'entities' ? 'entity' : 'dictionary', owner, refs: take(2) };
  }
  return null;
}

/** The route a chain off the tree walks, as the text reader would name it. */
const routeOfChain = (chain: PlaceholderChain): PlaceholderRoute =>
  ({ kind: chain.kind, owner: chain.owner?.name, segments: chain.refs.map((ref) => ref.name) });

/** What is wrong with a reference to the `noun` called `name`: none has it, or several share it. `winner`
 *  is how the last-authored one displays, where that differs from the name as written. `missing` tags a
 *  miss with no near name. */
function checkEntryName(
  { name, from, to }: EntryRef,
  names: readonly string[],
  noun: EntryNoun,
  winner: (last: number) => string = () => name,
  missing?: MissingName,
): CodeDiagnostic | null {
  const count = names.filter((n) => n === name).length;
  if (count === 1) return null;
  if (count > 1) {
    const display = winner(names.lastIndexOf(name));
    const reads = display === name ? 'the last one authored' : `“${display}”, the last one authored`;
    const rule = noun === 'stat'
      ? `A stat that is on wins the name over a switched-off one. Otherwise this reads ${reads}.`
      : `This reads ${reads}.`;
    return { from, to, severity: 'warning', message: `${count} ${PLURAL[noun]} are named “${name}”. ${rule}` };
  }
  const suggestion = nearestName(name, [...new Set(names)]);
  const message = suggestion ? `No ${noun} is named “${name}”. Did you mean “${suggestion}”?` : `No ${noun} is named “${name}”.`;
  return suggested({ from, to, severity: 'error', message }, suggestion, missing ?? false);
}

/** Whether some owner holds `name` or a name near it: a wrong owner or a typo, not a missing name. */
const heldNear = (name: string, held: ReadonlySet<string>) => held.has(name) || nearestName(name, [...held]) !== null;

/** A world trait name. One an entity holds is a wrong owner, not a missing trait. */
const checkTraitName = (ref: EntryRef, names: readonly string[], held: ReadonlySet<string>) =>
  checkEntryName(ref, names, 'trait', undefined, heldNear(ref.name, held) ? undefined : { kind: 'trait', root: 'traits', segments: [ref.name] });

/** The diagnostic with its near name as the first fix, or with `missing` set when it suggests no name. */
const suggested = (diagnostic: CodeDiagnostic, suggestion: string | null, missing: MissingName | false = false): CodeDiagnostic => {
  if (suggestion) {
    const { from, to } = diagnostic;
    return { ...diagnostic, fixes: [{ label: `Change to ${suggestion}`, from, to, insert: suggestion }] };
  }
  return missing ? { ...diagnostic, missing } : diagnostic;
};

/** A fix on a map key, rewritten by the rename offer's key splice. Any other fix stays as it is. */
function keyFix(fix: CodeFix, code: string, tree: Tree): CodeFix {
  const node = tree.resolveInner(fix.from, 1);
  const member = node.from === fix.from && node.to === fix.to ? keyOwner(node) : null;
  const object = member?.firstChild;
  const key = member && object && object.from < fix.from ? memberRenameKey(member, object, code) : null;
  return key ? { ...fix, ...rewrittenKey(key, fix.insert) } : fix;
}

/** Every name a node of `map` takes, under any owner. */
function placeholderNames(map: PlaceholderPathMap): Set<string> {
  const names = new Set<string>();
  const walk = (nodes: readonly PlaceholderPathNode[]) => nodes.forEach((node) => { names.add(node.name); walk(node.children); });
  walk(map.top);
  for (const owner of map.owners.values()) walk(owner.children);
  return names;
}

/** What is wrong with a name several of the world's own rows share: the last one authored reads. */
function checkSharedKey(map: PlaceholderPathMap, { name, from, to }: EntryRef): CodeDiagnostic | null {
  const { count } = placeholderKeyWinner(map, name);
  if (count < 2) return null;
  return { from, to, severity: 'warning', message: `${count} placeholders are named “${name}”. This reads the last one authored.` };
}

/**
 * What is wrong with a path: a name several world rows share, a segment no entry answers, or a child whose
 * name loses to a member every entry has. Each complaint lands on the segment that carries it.
 */
function checkPlaceholderPath(refs: readonly EntryRef[], placeholders: CodePlaceholders): CodeDiagnostic[] {
  const map = pathMapOf(placeholders);
  const out: CodeDiagnostic[] = [];
  // The first segment is the only one a duplicate rule applies to; below it, a name is either a child or
  // nothing at all.
  const shared = checkSharedKey(map, refs[0]);
  if (shared) out.push(shared);
  const { node, rest, shadowed } = walkPlaceholderPath(map, refs.map((ref) => ref.name));
  if (rest.length === 0) return out;
  const ref = refs[refs.length - rest.length];
  if (shadowed && node) {
    out.push(shadowedChild(ref, node));
    return out;
  }
  // A member read off an entry is the path ending, not a miss.
  if (node?.placeholder && isPlaceholderEntryMember(ref.name)) return out;
  const candidates = node ? node.children.map((entry) => entry.name) : [...map.keys.keys()];
  const suggestion = nearestName(ref.name, candidates);
  const lead = node ? `Unknown placeholder name “${ref.name}” under “${placeholderPathLabel(node.path)}”`
    : `Unknown placeholder name “${ref.name}”`;
  const segments = refs.slice(0, refs.length - rest.length + 1).map((at) => at.name);
  out.push(suggested({
    from: ref.from, to: ref.to, severity: 'error',
    message: suggestion ? `${lead}. Did you mean “${suggestion}”?` : `${lead}.`,
  }, suggestion, !suggestion && !heldNear(ref.name, placeholderNames(map)) && { kind: 'placeholder', root: 'placeholders', segments }));
  return out;
}

/** The warning for a child whose name loses to a member every placeholder entry has. */
const shadowedChild = (ref: EntryRef, parent: PlaceholderPathNode): CodeDiagnostic => ({
  from: ref.from, to: ref.to, severity: 'warning',
  message: `Every placeholder has a ${ref.name} member, so this reads the member. `
    + `The placeholder named “${ref.name}” under “${placeholderPathLabel(parent.path)}” is not reachable from code.`,
});

/** What is wrong with a path through an owner's `placeholders`: a key no placeholder answers, or a child that
 *  loses to a member. A warning, since a library owner can carry it. */
function checkOwnedPlaceholderPath(
  chain: PlaceholderChain, placeholders: CodePlaceholders, options: AnalysisOptions, rules: StatRules,
): CodeDiagnostic | null {
  const route = routeOfChain(chain);
  const start = routeStart(route, placeholders, options, rules);
  if (!start || !chain.refs.length) return null;
  const map = pathMapOf(placeholders);
  const { node, rest, shadowed } = walkPlaceholderPath(map, route.segments, start);
  if (rest.length === 0 || !node) return null;
  const ref = chain.refs[chain.refs.length - rest.length];
  if (shadowed) return shadowedChild(ref, node);
  if (node.placeholder && isPlaceholderEntryMember(ref.name)) return null;
  const lead = node !== start ? `Unknown placeholder name “${ref.name}” under “${placeholderPathLabel(node.path)}”.`
    : chain.kind === 'persona' ? `Unknown persona placeholder name “${ref.name}”. A library persona can have it.`
      : `“${route.owner}” has no placeholder named “${ref.name}”.`;
  const suggestion = nearestName(ref.name, node.children.map((child) => child.name));
  const segments = [...route.owner === undefined ? [] : [route.owner], ...route.segments.slice(0, route.segments.length - rest.length + 1)];
  return suggested({
    from: ref.from, to: ref.to, severity: 'warning',
    message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead,
  }, suggestion, !suggestion && !heldNear(ref.name, placeholderNames(map)) && { kind: 'placeholder', root: ROUTE_GLOBAL[chain.kind], segments });
}

/** What is wrong with an assignment to a whole owned placeholder rather than to its `value`. */
function checkOwnedEntryWrite(
  target: SyntaxNode, code: string, options: AnalysisOptions, rules: StatRules,
): CodeDiagnostic | null {
  const chain = placeholderChainRoute(target, code);
  if (!chain || chain.kind === 'world' || !chain.refs.length) return null;
  const { from, to } = target;
  const written = code.slice(from, to);
  // An owner's own keys are always placeholders, so one key needs no world to name the fix.
  const fix: CodeDiagnostic = { from, to, severity: 'warning', message: `Write to ${written}.value instead.` };
  const { placeholders } = options;
  const start = placeholders && routeStart(routeOfChain(chain), placeholders, options, rules);
  if (!placeholders || !start) return chain.refs.length === 1 ? fix : null;
  const { node, rest } = walkPlaceholderPath(pathMapOf(placeholders), chain.refs.map((ref) => ref.name), start);
  return rest.length === 0 && node?.placeholder ? fix : null;
}

/** What is wrong with a write into `dictionaries`: to an entry, or to one of its members. */
function checkDictionaryWrite(target: SyntaxNode, code: string): CodeDiagnostic | null {
  const readOnly = (from: number, to: number): CodeDiagnostic =>
    ({ from, to, severity: 'error', message: `${code.slice(target.from, target.to)} is read-only.` });
  const entry = entryRef(target, code, 'dictionaries');
  if (entry) return readOnly(entry.from, entry.to);
  const own = target.firstChild && entryRef(target.firstChild, code, 'dictionaries') ? memberKey(target, code) : null;
  return own ? readOnly(own.from, own.to) : null;
}

/**
 * What is wrong with an assignment to a whole `placeholders` node rather than to its `value`. Without the
 * world's placeholders the path can't be walked, so only the one-segment case is named.
 */
function checkPlaceholderEntryWrite(
  target: SyntaxNode, code: string, placeholders?: CodePlaceholders,
): CodeDiagnostic | null {
  const { from, to } = target;
  const written = code.slice(from, to);
  const warn = (message: string): CodeDiagnostic => ({ from, to, severity: 'warning', message });
  if (!placeholders) return entryRef(target, code, 'placeholders') ? warn(`Write to ${written}.value instead.`) : null;
  const chain = placeholderChainRoute(target, code);
  const refs = chain?.kind === 'world' ? chain.refs : [];
  if (!refs.length) return null;
  const { node, rest } = walkPlaceholderPath(pathMapOf(placeholders), refs.map((ref) => ref.name));
  return rest.length === 0 && node ? warn(`Write to ${written}.value instead.`) : null;
}

/** The error on a write to a trait script's own `self`. */
const SELF_TRAIT_READ_ONLY = 'self is read-only in a trait’s script. Switch a trait through traits or owner.traits.';
const SWITCHED_TRAIT_READ_ONLY = 'trait is read-only. Switch a trait through traits or owner.traits.';

/** What is wrong with a write into a trait map: to the entry itself, or to a field other than `enabled`. */
function checkTraitWrite(
  target: SyntaxNode, code: string, assignment: boolean, entryOf: TraitEntryOf = worldTraitRef,
): CodeDiagnostic | null {
  const { from, to } = target;
  if (entryOf(target, code)) {
    return assignment ? { from, to, severity: 'warning', message: `Write to ${code.slice(from, to)}.${TRAIT_WRITABLE_FIELD} instead.` } : null;
  }
  const entry = target.firstChild;
  const field = target.getChild('PropertyName');
  if (!entry || !field || !entryOf(entry, code)) return null;
  const name = code.slice(field.from, field.to);
  if (name === TRAIT_WRITABLE_FIELD) return null;
  const path = code.slice(entry.from, entry.to);
  const known = TRAIT_ENTRY_FIELDS.some((f) => f.name === name);
  const suggestion = known ? null : nearestName(name, TRAIT_ENTRY_FIELDS.map((f) => f.name));
  const message = known ? `${path}.${name} can’t be written. Only ${path}.${TRAIT_WRITABLE_FIELD} can.`
    : suggestion ? `A trait has no field “${name}”. Did you mean “${suggestion}”?` : `A trait has no field “${name}”.`;
  return suggested({ from: field.from, to: field.to, severity: 'error', message }, suggestion);
}

/** What is wrong with a write into `persona`: to one of its own members, or into its traits as `traits`. */
function checkPersonaWrite(target: SyntaxNode, code: string, assignment: boolean): CodeDiagnostic | null {
  const own = entryRef(target, code, 'persona');
  if (own) {
    const message = `persona.${own.name} is read-only.`;
    return { from: own.from, to: own.to, severity: 'error', message };
  }
  return checkTraitWrite(target, code, assignment, personaTraitRef);
}

/** What is wrong with a write into `owner`: to one of its own members, or into its traits as `traits`. A write
 *  to a stat below `owner.stats` is a stat write, which `checkWrite` reads. */
function checkOwnerWrite(target: SyntaxNode, code: string, assignment: boolean): CodeDiagnostic | null {
  const own = entryRef(target, code, 'owner');
  if (own) return { from: own.from, to: own.to, severity: 'error', message: `owner.${own.name} is read-only.` };
  return checkTraitWrite(target, code, assignment, ownerTraitRef);
}

/** What is wrong with a write into `entities`: to the map, to an entry or one of its members, or into an
 *  entry's traits as `traits`. */
function checkEntityWrite(target: SyntaxNode, code: string, assignment: boolean): CodeDiagnostic | null {
  const readOnly = (from: number, to: number): CodeDiagnostic =>
    ({ from, to, severity: 'error', message: `${code.slice(target.from, target.to)} is read-only.` });
  const entry = entryRef(target, code, 'entities');
  if (entry) return readOnly(entry.from, entry.to);
  const own = target.firstChild && entryRef(target.firstChild, code, 'entities') ? memberKey(target, code) : null;
  if (own) return readOnly(own.from, own.to);
  return checkTraitWrite(target, code, assignment, entityTraitRef);
}

/** What is wrong with a read of `clock.<field>` or `clock.previous.<field>`: the clock carries no such field. */
function checkClockField(member: SyntaxNode, code: string): CodeDiagnostic | null {
  const object = member.firstChild;
  const field = member.getChild('PropertyName');
  if (!object || !field) return null;
  // `clock?.previous` and `clock . previous` name the same object as `clock.previous`.
  const path = code.slice(object.from, object.to).replace(/\s+/g, '').replace(/\?\./g, '.');
  const fields = clockFieldsAt(path);
  const name = code.slice(field.from, field.to);
  if (!fields || fields.some((entry) => entry.name === name)) return null;
  const suggestion = nearestName(name, fields.map((entry) => entry.name));
  const lead = `${path} has no field “${name}”.`;
  return suggested({ from: field.from, to: field.to, severity: 'error', message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead }, suggestion);
}

/** What is wrong with a read of `<root>.<field>` on a trait entry, `self` in a trait's script or `trait` in a
 *  switch script: the trait carries no such field. */
function checkTraitEntryField(
  member: SyntaxNode, code: string, root: 'self' | 'trait', fields: readonly SurfaceEntry[],
): CodeDiagnostic | null {
  const object = member.firstChild;
  const field = member.getChild('PropertyName');
  if (!object || !field || code.slice(object.from, object.to) !== root) return null;
  const name = code.slice(field.from, field.to);
  if (fields.some((entry) => entry.name === name)) return null;
  const suggestion = nearestName(name, fields.map((entry) => entry.name));
  const lead = `A trait has no field “${name}”.`;
  return suggested({ from: field.from, to: field.to, severity: 'error', message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead }, suggestion);
}

/** Operators that read their operands as numbers. */
const NUMERIC_OPS = new Set(['<', '>', '<=', '>=', '+', '-', '*', '/', '%', '**']);
/** Operators that compare by identity, so an entry is only wrong against a number. */
const EQUALITY_OPS = new Set(['==', '===', '!=', '!==']);
/** Unary operators that read their operand as a number. */
const SIGN_OPS = new Set(['-', '+']);

/** A node's children without comments. */
function codeChildren(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) if (!child.type.isSkipped) children.push(child);
  return children;
}

/** The expression inside any parentheses around `node`. */
function unwrapParens(node: SyntaxNode): SyntaxNode {
  let at = node;
  while (at.name === 'ParenthesizedExpression') {
    const inner = codeChildren(at).find((child) => child.name !== '(' && child.name !== ')');
    if (!inner) break;
    at = inner;
  }
  return at;
}

/** Whether `node` is a number literal, signed or not. */
function isNumberLiteral(node: SyntaxNode, code: string): boolean {
  const at = unwrapParens(node);
  if (at.name !== 'UnaryExpression') return at.name === 'Number';
  const [op, operand] = codeChildren(at);
  return !!op && !!operand && SIGN_OPS.has(code.slice(op.from, op.to)) && unwrapParens(operand).name === 'Number';
}

/** The operands an operator reads as numbers. Equality reads an entry as a number only against a number. */
function numericOperands(node: SyntaxNode, code: string, inSlot: (from: number, to: number) => boolean): SyntaxNode[] {
  const children = codeChildren(node);
  const [op, ...operands] = node.name === 'UnaryExpression' ? children : [children[1], children[0], children[2]];
  if (!op || operands.some((operand) => !operand) || inSlot(op.from, op.to)) return [];
  const text = code.slice(op.from, op.to);
  if (node.name === 'UnaryExpression') return SIGN_OPS.has(text) ? operands : [];
  if (NUMERIC_OPS.has(text)) return operands;
  if (!EQUALITY_OPS.has(text)) return [];
  const [left, right] = operands;
  return [isNumberLiteral(right, code) ? left : null, isNumberLiteral(left, code) ? right : null]
    .filter((operand): operand is SyntaxNode => operand !== null);
}

/** What is wrong with an operator that reads a whole stat entry as a number: a comparison is false, and arithmetic gives NaN. */
function checkWholeStatOperands(
  node: SyntaxNode, code: string, isEntry: (operand: SyntaxNode) => boolean, inSlot: (from: number, to: number) => boolean,
): CodeDiagnostic[] {
  return numericOperands(node, code, inSlot).map(unwrapParens).filter(isEntry).map(({ from, to }) => {
    const entry = code.slice(from, to);
    return { from, to, severity: 'error', message: `${entry} is a whole stat, not a number. Use ${entry}.value.` };
  });
}

/** What is wrong with an entity or dictionary name: several share it, or nothing authored has it. A library
 *  item can still have it, so the miss is only a warning. */
function checkOwnerName(ref: EntryRef, names: readonly string[], noun: 'entity' | 'dictionary'): CodeDiagnostic | null {
  if (names.includes(ref.name)) return checkEntryName(ref, names, noun);
  const lead = `Unknown ${noun} name “${ref.name}”. A library ${noun} can have it.`;
  const suggestion = nearestName(ref.name, [...new Set(names)]);
  return suggested(
    { from: ref.from, to: ref.to, severity: 'warning', message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead },
    suggestion, { kind: noun, root: noun === 'entity' ? 'entities' : 'dictionaries', segments: [ref.name] },
  );
}

const checkEntityName = (ref: EntryRef, entities: readonly CodeEntityNames[]) =>
  checkOwnerName(ref, keyedEntityNames(entities), 'entity');

/** A stat key off an owner's `stats`: the map `entities.Name.stats`, `persona.stats` or `owner.stats`, and the key. */
function ownerStatRef(node: SyntaxNode, code: string): { match: RegExpExecArray; ref: EntryRef } | null {
  const map = node.firstChild;
  if (map?.name !== 'MemberExpression') return null;
  const match = OWNER_STATS_EXPRESSION.exec(code.slice(map.from, map.to));
  const ref = match && memberKey(node, code);
  return match && ref?.name ? { match, ref } : null;
}

/** What is wrong with a stat name off an owner's `stats`. The owner's own list is exact: an unknown name is an
 *  error, but a warning in a Blueprint box, where an owner can hold more than its group. Another entity's or the
 *  persona's can be a library entity's, so it is only a warning. */
function checkOwnerStatName(
  { match, ref }: { match: RegExpExecArray; ref: EntryRef }, options: AnalysisOptions,
): CodeDiagnostic | null {
  const root = statsRootOf(match);
  if (root === 'owner') {
    const problem = options.ownerStatNames ? checkEntryName(ref, options.ownerStatNames, 'stat') : null;
    return problem && options.owner === 'blueprint' ? { ...problem, severity: 'warning' } : problem;
  }
  const entity = root === 'entities' && options.entities ? keyedEntity(options.entities, entityNamed(match)) : undefined;
  const withStats = root === 'persona' ? (options.entities ?? []).filter((each) => each.persona && each.stats) : entity?.stats ? [entity] : [];
  if (withStats.length === 0) return null;
  const names = [...new Set(withStats.flatMap((each) => each.stats ?? []))];
  if (names.includes(ref.name)) return null;
  const lead = entity ? `“${entity.name}” has no stat named “${ref.name}”.` : `Unknown persona stat name “${ref.name}”. A library persona can have it.`;
  const suggestion = nearestName(ref.name, names);
  return suggested({ from: ref.from, to: ref.to, severity: 'warning', message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead }, suggestion);
}

/** What is wrong with a trait name on a known entity: its set has no trait called that. A later library
 *  entity can take the name with another set, so this is only a warning. */
function checkEntityTraitName(
  { entity, trait }: { entity: EntryRef; trait: EntryRef }, entities: readonly CodeEntityNames[], held: ReadonlySet<string>,
): CodeDiagnostic | null {
  const names = traitsOfEntity(entities, entity.name);
  if (!names || names.includes(trait.name)) return null;
  const suggestion = nearestName(trait.name, [...new Set(names)]);
  const lead = `“${entity.name}” has no trait named “${trait.name}”.`;
  return suggested(
    { from: trait.from, to: trait.to, severity: 'warning', message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead },
    suggestion, !heldNear(trait.name, held) && { kind: 'trait', root: 'entities', segments: [entity.name, trait.name] },
  );
}

/** What is wrong with a persona trait name: no persona in the world holds it. A library persona may still
 *  hold it, so this is only a warning. */
function checkPersonaTraitName({ name, from, to }: EntryRef, names: readonly string[], held: ReadonlySet<string>): CodeDiagnostic | null {
  if (names.includes(name)) return null;
  const lead = `Unknown persona trait name “${name}”. A library persona can have it.`;
  const suggestion = nearestName(name, [...new Set(names)]);
  return suggested(
    { from, to, severity: 'warning', message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead },
    suggestion, !heldNear(name, held) && { kind: 'trait', root: 'persona', segments: [name] },
  );
}


const asCompletion = (entry: SurfaceEntry, type: CompletionKind, boost?: number): CodeCompletion => ({
  label: entry.name, detail: entry.detail, info: entry.info, type, ...(boost === undefined ? {} : { boost }),
});

/** The keywords worth offering: what a function body of a few lines actually uses. */
const KEYWORDS = ['return', 'const', 'let', 'if', 'else', 'for', 'of', 'function', 'true', 'false', 'null'];

/**
 * What the caret at `pos` can be completed with, or null where nothing sensible applies. Synchronous and
 * pure: doc and cursor in, options out, with no editor and no network involved.
 */
export function codeCompletions(
  code: string,
  pos: number,
  options: SurfaceAnalysisOptions,
): CompletionResult | null {
  const { surface } = options;
  const known = surfaceKnownNames(surface);
  const resolver = codeResolver(code, options);
  const { tree } = resolver;
  const node = tree.resolveInner(pos, -1);
  const from = wordStart(code, pos);
  const ranges = slotRanges(code, options);
  const rules = statRulesOf(surface);

  // Inside a string literal the useful list is the world's own stat names — the one place a typo fails
  // silently rather than throwing.
  if (node.name === 'String') {
    const quote = code[node.from];
    const innerFrom = node.from + 1;
    const innerTo = code[node.to - 1] === quote && node.to - 1 > node.from ? node.to - 1 : node.to;
    if (pos < innerFrom) return null;
    // A string in a bracket key on a map the sandbox keys by name: that map's own keys, quoted names included.
    const object = bracketObjectAround(node);
    const map = object ? resolver.valueOf(object) : null;
    const keys = map && bracketKeys(map, options, rules);
    if (keys) return { from: innerFrom, to: innerTo, options: keys.map((entry) => asCompletion(entry, 'text')) };
    // Any other string. The whole literal is replaced, not the part before the caret — a name half-typed in
    // the middle of an old one would otherwise leave its tail behind.
    if (!rules.stats) return null;
    const names = mapNameEntries(options.statNames ?? [], 'stat', false);
    return { from: innerFrom, to: innerTo, options: names.map((entry) => asCompletion(entry, 'text')) };
  }

  // `{{` in the template editor offers the slots the template already declares, so a second reference to
  // one is spelled the same as the first.
  const beforeWord = code.slice(0, from);
  if (options.slots && /\{\{\s*$/.test(beforeWord)) {
    // The slot being named is itself a declaration, so offering it back to the author is noise.
    const partial = code.slice(from, pos);
    const names = parseTemplateSlots(code).slots.map((slot) => slot.name).filter((name) => name !== partial);
    if (names.length === 0) return null;
    return {
      from,
      to: pos,
      options: names.map((name) => ({
        label: name, type: 'variable', detail: 'slot', info: `The “${name}” slot declared in this template`,
      })),
    };
  }

  // A completion inside a slot would be filling in template syntax with sandbox names.
  if (overlapsAny(from, pos, ranges)) return null;

  // After a dot the list is only ever as good as what the expression can be shown to be. A wrong guess
  // here is worse than silence: it reads as the editor asserting the sandbox has something it doesn't.
  const punctuationAt = beforeWord.trimEnd().length - 1;
  if (/\.\s*$/.test(beforeWord)) {
    const value = resolver.valueBefore(punctuationAt);
    const members = value && surfaceMembersOf(value, options, rules);
    if (!members) return null;
    return { from, to: pos, options: members.map((member) => asCompletion(member, 'property')) };
  }

  const declared = declaredNames(code, tree);
  // The word being typed is itself a definition while it's being typed; offering it back is noise.
  const typed = code.slice(from, pos);
  // Right after a stat map's `[` a quoted name leads the list; `self.name` or a variable of the author's can go
  // there too. The list is the map's own: an owner's `stats` keys the owner's stats, and the bare `stats` the global stats.
  const bracketMap = /\[\s*$/.test(beforeWord) ? resolver.valueBefore(punctuationAt) : null;
  const quotedNames = bracketMap?.is === 'statMap' ? statNamesOf(options, bracketMap.owner) ?? [] : null;
  const quotedStats = quotedNames
    ? mapNameEntries(quotedNames, 'stat', false).map((entry) => ({ ...asCompletion(entry, 'text', 2), label: JSON.stringify(entry.name) }))
    : [];
  return {
    from,
    to: pos,
    options: [
      ...quotedStats,
      ...surface.globals.map((entry) => asCompletion(entry, 'variable', 1)),
      ...[...declared]
        .filter((name) => name !== typed && !known.has(name))
        .map((name) => ({ label: name, type: 'variable' as const, detail: 'yours', info: 'Declared in this code' })),
      ...surface.builtins.map((entry) => asCompletion(entry, 'variable')),
      ...KEYWORDS.map((keyword) => ({ label: keyword, type: 'keyword' as const })),
    ],
  };
}

/** `codeCompletions` against the stat-code surface. */
export const statCodeCompletions = (code: string, pos: number, options: AnalysisOptions = {}) =>
  codeCompletions(code, pos, { ...options, surface: STAT_CODE_SURFACE });

/**
 * What the reader found, as one line. Running the code reports what it returned, which says nothing
 * about a typo on a branch the run never took — so a successful test carries this rather than reading
 * as a clean bill of health. Null when there is nothing to report.
 */
export function summarizeProblems(diagnostics: readonly CodeDiagnostic[]): string | null {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  if (errors === 0 && warnings === 0) return null;
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 's'}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  return `${parts.join(', ')} in this code`;
}

/**
 * What looks wrong with a piece of code: syntax the grammar can't read, references to names the surface
 * never provides, and code that can never hand a result back. Advisory — the Test button remains the
 * ground truth, and nothing here blocks saving.
 */
export function codeDiagnostics(code: string, options: SurfaceAnalysisOptions): CodeDiagnostic[] {
  if (!code.trim()) return [];

  const { surface } = options;
  const known = surfaceKnownNames(surface);
  const rules = statRulesOf(surface);
  const tree = parseCode(code);
  const ranges = slotRanges(code, options);
  const diagnostics: CodeDiagnostic[] = [];
  const declared = declaredNames(code, tree);
  let sawReturn = false;
  let sawSyntaxError = false;
  let sawStatWrite = false;
  let sawPlaceholderWrite = false;
  let sawTraitWrite = false;
  const placeholdersInScope = rules.placeholders && !declared.has('placeholders');
  const traitsInScope = rules.traits && !declared.has('traits');
  const personaInScope = rules.persona && !declared.has('persona');
  const ownerInScope = rules.owner && !declared.has('owner');
  const personaTraits = personaTraitsOf(options.entities);
  // Every trait name any owner holds: a miss among these is a wrong owner, not a missing trait.
  const heldTraits = new Set([...options.traits ?? [], ...(options.entities ?? []).flatMap((entity) => entity.traits.map((trait) => trait.name))]);
  const entitiesInScope = rules.entities && !declared.has('entities');
  const dictionariesInScope = rules.dictionaries && !declared.has('dictionaries');
  const statsInScope = rules.stats && !declared.has('stats');
  const clockInScope = rules.stats && !declared.has('clock');
  const selfInScope = rules.self && !declared.has('self');
  const switchedTraitInScope = surfaceHasGlobal(surface, 'trait') && !declared.has('trait');
  /** Whether an operand is a whole stat entry: `self`, or one key of `stats` or of an owner's `stats`. */
  const isStatEntry = (operand: SyntaxNode) => {
    if (operand.name === 'VariableName') return selfInScope && code.slice(operand.from, operand.to) === 'self';
    const root = operand.name === 'MemberExpression' ? operand.firstChild : null;
    if (statsInScope && root?.name === 'VariableName' && code.slice(root.from, root.to) === 'stats') return true;
    const route = operand.name === 'MemberExpression' ? memberRoot(operand, code) : null;
    return STAT_ENTRY_EXPRESSION.test(code.slice(operand.from, operand.to)) && ownerRootInScope(route);
  };
  const inSlot = (from: number, to: number) => overlapsAny(from, to, ranges);
  /** Whether a chain's root is an owner global the code has not shadowed. */
  const ownerRootInScope = (root: string | null) =>
    (root === 'entities' && entitiesInScope) || (root === 'persona' && personaInScope) || (root === 'owner' && ownerInScope)
    || (root === 'dictionaries' && dictionariesInScope);
  /** Whether a placeholder chain's root is in scope: the world's map, or an owner global. */
  const chainRootInScope = (root: string | null) => (root === 'placeholders' ? placeholdersInScope : ownerRootInScope(root));
  const statWrites = rules.stats || rules.self;

  const cursor = tree.cursor();
  do {
    const { from, to } = cursor;
    if (cursor.type.isError) {
      sawSyntaxError = true;
      // A slot stands where an expression, an operator or a whole clause will be, so a template is only
      // valid JavaScript once filled. The parser's complaint can land anywhere after the slot rather than
      // inside it, which makes position-based skipping useless — a template gets no syntax check at all.
      if (ranges.length > 0) continue;
      // Error nodes are usually empty — they mark where the parser gave up, so widen to a character the
      // author can actually see underlined.
      const end = to > from ? to : Math.min(code.length, from + 1);
      const start = end > from ? from : Math.max(0, from - 1);
      diagnostics.push({ from: start, to: end, severity: 'error', message: 'Syntax error — the code can’t be read as JavaScript.' });
      continue;
    }
    if (cursor.type.name === 'ReturnStatement') { sawReturn = true; continue; }
    const target = writeTarget(cursor.node, code);
    if (target && !overlapsAny(target.from, target.to, ranges)) {
      if (surface.selfIs === 'trait' && !declared.has('self') && memberRoot(target, code) === 'self') {
        diagnostics.push({ from: target.from, to: target.to, severity: 'error', message: SELF_TRAIT_READ_ONLY });
      } else if (switchedTraitInScope && memberRoot(target, code) === 'trait') {
        diagnostics.push({ from: target.from, to: target.to, severity: 'error', message: SWITCHED_TRAIT_READ_ONLY });
      } else if (statWrites) {
        const { writes, problem } = checkWrite(target, code, tree, declared, options.selfName, options.owner !== undefined);
        if (writes) sawStatWrite = true;
        if (problem) diagnostics.push(problem);
      }
      if (placeholdersInScope && memberRoot(target, code) === 'placeholders') {
        sawPlaceholderWrite = true;
        const problem = cursor.type.name === 'AssignmentExpression'
          ? checkPlaceholderEntryWrite(target, code, options.placeholders) : null;
        if (problem) diagnostics.push(problem);
      }
      if (traitsInScope && memberRoot(target, code) === 'traits') {
        sawTraitWrite = true;
        const traitProblem = checkTraitWrite(target, code, cursor.type.name === 'AssignmentExpression');
        if (traitProblem) diagnostics.push(traitProblem);
      }
      if (personaInScope && memberRoot(target, code) === 'persona') {
        sawTraitWrite = true;
        const personaProblem = checkPersonaWrite(target, code, cursor.type.name === 'AssignmentExpression');
        if (personaProblem) diagnostics.push(personaProblem);
      }
      if (ownerInScope && memberRoot(target, code) === 'owner') {
        sawTraitWrite = true;
        const ownerProblem = checkOwnerWrite(target, code, cursor.type.name === 'AssignmentExpression');
        if (ownerProblem) diagnostics.push(ownerProblem);
      }
      if (entitiesInScope && memberRoot(target, code) === 'entities') {
        sawTraitWrite = true;
        const entityProblem = checkEntityWrite(target, code, cursor.type.name === 'AssignmentExpression');
        if (entityProblem) diagnostics.push(entityProblem);
      }
      if (dictionariesInScope && memberRoot(target, code) === 'dictionaries') {
        sawPlaceholderWrite = true;
        const dictionaryProblem = checkDictionaryWrite(target, code);
        if (dictionaryProblem) diagnostics.push(dictionaryProblem);
      }
      const ownedProblem = cursor.type.name === 'AssignmentExpression' && ownerRootInScope(memberRoot(target, code))
        ? checkOwnedEntryWrite(target, code, options, rules) : null;
      if (ownedProblem) diagnostics.push(ownedProblem);
    }
    if (cursor.type.name === 'CallExpression' && isPlaceholderWriteCall(cursor.node, code, chainRootInScope)) {
      sawPlaceholderWrite = true;
    }
    const chain = cursor.type.name === 'MemberExpression' && options.placeholders ? placeholderChainRoute(cursor.node, code) : null;
    if (chain && options.placeholders && chainRootInScope(ROUTE_GLOBAL[chain.kind])) {
      // Every nesting of one chain is visited, and each reports the same complaint at the same span, so the
      // duplicate filter below leaves one of each rather than one per nesting.
      const refs = chain.refs.filter((ref) => !overlapsAny(ref.from, ref.to, ranges));
      const owned = chain.kind === 'world' ? null : checkOwnedPlaceholderPath({ ...chain, refs }, options.placeholders, options, rules);
      if (chain.kind === 'world' && refs.length) diagnostics.push(...checkPlaceholderPath(refs, options.placeholders));
      if (owned) diagnostics.push(owned);
    }
    if (cursor.type.name === 'MemberExpression' && options.placeholders?.dictionaries && dictionariesInScope) {
      const ref = entryRef(cursor.node, code, 'dictionaries');
      const names = options.placeholders.dictionaries.map((book) => book.name);
      const problem = ref && !overlapsAny(ref.from, ref.to, ranges) ? checkOwnerName(ref, names, 'dictionary') : null;
      if (problem) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression' && options.traits && traitsInScope) {
      const ref = entryRef(cursor.node, code, 'traits');
      const problem = ref && !overlapsAny(ref.from, ref.to, ranges) ? checkTraitName(ref, options.traits, heldTraits) : null;
      if (problem) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression' && personaTraits && personaInScope) {
      const ref = personaTraitRef(cursor.node, code);
      const problem = ref && !overlapsAny(ref.from, ref.to, ranges) ? checkPersonaTraitName(ref, personaTraits, heldTraits) : null;
      if (problem) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression' && options.entities && entitiesInScope) {
      const entity = entryRef(cursor.node, code, 'entities');
      const parts = entityTraitParts(cursor.node, code);
      const problem = entity && !overlapsAny(entity.from, entity.to, ranges) ? checkEntityName(entity, options.entities)
        : parts && !overlapsAny(parts.trait.from, parts.trait.to, ranges) ? checkEntityTraitName(parts, options.entities, heldTraits) : null;
      if (problem) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression' && options.statNames && statsInScope) {
      const ref = entryRef(cursor.node, code, 'stats');
      // The empty key reaches an unnamed stat, which no name list carries.
      const problem = ref?.name && !overlapsAny(ref.from, ref.to, ranges) ? checkEntryName(ref, options.statNames, 'stat', undefined, { kind: 'stat', root: 'stats', segments: [ref.name] }) : null;
      if (problem) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression') {
      const statRef = ownerStatRef(cursor.node, code);
      const root = statRef && statsRootOf(statRef.match);
      const reachable = root === 'owner' ? ownerInScope : root === 'persona' ? personaInScope : root === 'entities' && entitiesInScope;
      const problem = statRef && reachable && !overlapsAny(statRef.ref.from, statRef.ref.to, ranges) ? checkOwnerStatName(statRef, options) : null;
      if (problem) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression' && clockInScope) {
      const problem = checkClockField(cursor.node, code);
      if (problem && !overlapsAny(problem.from, problem.to, ranges)) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression' && surface.selfIs === 'trait' && !declared.has('self')) {
      const problem = checkTraitEntryField(cursor.node, code, 'self', SELF_TRAIT_FIELDS);
      if (problem && !overlapsAny(problem.from, problem.to, ranges)) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression' && switchedTraitInScope) {
      const problem = checkTraitEntryField(cursor.node, code, 'trait', SWITCHED_TRAIT_FIELDS);
      if (problem && !overlapsAny(problem.from, problem.to, ranges)) diagnostics.push(problem);
    }
    if (cursor.type.name === 'BinaryExpression' || cursor.type.name === 'UnaryExpression') {
      diagnostics.push(...checkWholeStatOperands(cursor.node, code, isStatEntry, inSlot));
    }
    if (cursor.type.name !== 'VariableName') continue;

    const name = code.slice(from, to);
    if (declared.has(name) || known.has(name)) continue;
    if (overlapsAny(from, to, ranges)) continue;
    const retired = retiredRead(cursor.node, code, surface);
    if (retired) {
      diagnostics.push({ ...retired, severity: 'error', message: `“${code.slice(retired.from, retired.to)}” isn’t available in ${surface.label}. ${retired.newForm}` });
      continue;
    }
    const suggestion = nearestName(name, [...known, ...declared]);
    diagnostics.push(suggested({
      from,
      to,
      severity: 'error',
      message: suggestion
        ? `“${name}” isn’t available in ${surface.label}. Did you mean “${suggestion}”?`
        : `“${name}” isn’t available in ${surface.label}.`,
    }, suggestion));
  } while (cursor.next());

  // Code with no return can still set a stat through self or the map, pin a placeholder, or switch a trait.
  // Code that does none of these changes nothing. A missing return on code the parser couldn't finish reading
  // is a guess about half-typed code.
  if (surface.missingReturn && !sawReturn && !sawStatWrite && !sawPlaceholderWrite && !sawTraitWrite && !sawSyntaxError) {
    diagnostics.push({
      from: 0,
      to: Math.min(code.length, code.indexOf('\n') === -1 ? code.length : code.indexOf('\n')),
      severity: 'warning',
      message: surface.missingReturn,
    });
  }

  // One complaint per span: nested error nodes report the same spot more than once.
  const seen = new Set<string>();
  return diagnostics
    .filter((diagnostic) => {
      const key = `${diagnostic.from}:${diagnostic.to}:${diagnostic.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((diagnostic) => (diagnostic.fixes ? { ...diagnostic, fixes: diagnostic.fixes.map((fix) => keyFix(fix, code, tree)) } : diagnostic))
    .sort((a, b) => a.from - b.from);
}

/** `codeDiagnostics` against the stat-code surface. */
export const statCodeDiagnostics = (code: string, options: AnalysisOptions = {}) =>
  codeDiagnostics(code, { ...options, surface: STAT_CODE_SURFACE });
