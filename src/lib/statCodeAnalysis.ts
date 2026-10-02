/**
 * Reading sandboxed code without running it: what a caret can be completed with, and what looks wrong.
 *
 * Both halves are plain functions over a code string — the editor's autocomplete source and linter are
 * thin adapters over these, so the behavior is testable without an editor mounted. What the code can
 * reach comes from the surface it is read against; nothing here widens what QuickJS exposes.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode, Tree } from '@lezer/common';
import type { PlaceholderOwners } from '@/lib/placeholderHomes';
import { placeholderKindNoun } from '@/lib/placeholders';
import { hasEntityKey } from '@/lib/statCodeNames';
import { findSlotRanges, parseTemplateSlots } from '@/lib/statCodeTemplates';
import type { Placeholder } from '@/types';
import {
  nearestName, surfaceHasGlobal, surfaceKnownNames, type CodeSurface, type SurfaceEntry,
} from '@/lib/codeSurface';
import {
  CLOCK_MEMBERS, CLOCK_PREVIOUS_FIELDS, DELTA_FIELDS, DELTA_MEMBERS, PREVIOUS_FIELDS, SELF_WRITABLE_FIELDS, STAT_CODE_SURFACE, STAT_FIELDS,
  DICTIONARY_FIELDS, ENTITY_FIELDS, PERSONA_FIELDS, TRAIT_ENTRY_FIELDS, TRAIT_WRITABLE_FIELD, placeholderEntryFields,
} from '@/lib/statCodeSurface';
import {
  isPlaceholderEntryMember, placeholderKeyWinner, placeholderPathLabel, placeholderPathMap,
  walkPlaceholderPath, type PlaceholderPathMap, type PlaceholderPathNode,
} from '@/lib/statCodePaths';

export type DiagnosticSeverity = 'error' | 'warning';

export interface CodeDiagnostic {
  from: number;
  to: number;
  severity: DiagnosticSeverity;
  message: string;
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
  /** Every dictionary in authored order. Absent, dictionary names are neither offered nor checked. */
  dictionaries?: readonly CodeOwnerName[];
}

/** One trait as a template slot lists it, placed in its holder's tree. */
export interface CodeTraitPlace {
  id: string;
  name: string;
  /** Group names under their code names, outermost first. Empty at the top level. */
  path: readonly string[];
  /** Its place in its holder's Traits tab. Absent ⇒ list order. */
  tabPosition?: number;
}

/** One entity as the editor reads it: its code name and the code names of its trait set, owned or linked. */
export interface CodeEntityNames extends CodeOwnerName {
  traits: readonly CodeTraitPlace[];
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
  /** The world's stat names, in authored order. Absent, stat names are neither offered nor checked. */
  statNames?: readonly string[];
  /** The name of the stat the code belongs to, so a write through `stats` to that name counts as its own. */
  selfName?: string;
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
    stats: has('stats'), self: has('self'), placeholders: has('placeholders'), traits: has('traits'), persona: has('persona'),
    entities: has('entities'), dictionaries: has('dictionaries'),
  };
}

type StatRules = ReturnType<typeof statRulesOf>;

const parse = (code: string): Tree => javascriptLanguage.parser.parse(code);

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

/**
 * Every name the author declared anywhere in the code. Whole-document rather than block-scoped on
 * purpose: the only consumer that could be stricter is the unknown-identifier check, and a false "this
 * doesn't exist" on an advisory squiggle costs more than a missed one.
 */
function declaredNames(code: string, tree: Tree = parse(code)): Set<string> {
  const names = new Set<string>();
  const cursor = tree.cursor();
  do {
    if (cursor.type.name === 'VariableDefinition') {
      names.add(code.slice(cursor.from, cursor.to));
    } else if (cursor.type.name === 'PatternProperty') {
      // `const {min, max} = stat` binds the property names themselves unless renamed.
      const child = cursor.node.firstChild;
      if (child) names.add(code.slice(child.from, child.to));
    }
  } while (cursor.next());
  return names;
}

/** Identifiers holding something that came out of `stats` or `self` — the objects whose fields we can name
 *  — each mapped to the text of the declaration that bound it. */
function statLikeNames(code: string, tree: Tree): Map<string, string> {
  const names = new Map<string, string>();
  const cursor = tree.cursor();
  do {
    if (cursor.type.name === 'VariableDeclaration' || cursor.type.name === 'ArrowFunction') {
      const text = code.slice(cursor.from, cursor.to);
      if (!/\b(stats|self)\b/.test(text)) continue;
      const inner = cursor.node.cursor();
      do {
        if (inner.type.name === 'VariableDefinition') names.set(code.slice(inner.from, inner.to), text);
      } while (inner.next() && inner.from < cursor.to);
    }
  } while (cursor.next());
  return names;
}

/** Whether stat-like source reaches the current stat's own entry: `self`, or `stats` indexed by its own name.
 *  A `!==` against `self.id` finds some other stat, so it doesn't count. */
const reachesOwnStat = (text: string, selfName?: string) =>
  /\bself\b/.test(text.replace(/!==?\s*self\.id\b|\bself\.id\s*!==?/g, ''))
  || (selfName !== undefined && indexesStat(text, selfName));

/**
 * The source of the expression a `.` hangs off, scanned backwards over the member chain. Read from the
 * text rather than the tree because the tree can't shape the case that matters most: half-typed code like
 * `Object.values(stats).find(s => …).` parses as an unclosed argument list, whose "object" is the open paren.
 */
function expressionBeforeDot(code: string, dotPos: number): string | null {
  let end = dotPos;
  while (end > 0 && /\s/.test(code[end - 1])) end -= 1;
  let start = end;
  while (start > 0) {
    const char = code[start - 1];
    if (char === ')' || char === ']') {
      const open = char === ')' ? '(' : '[';
      let depth = 0;
      let index = start - 1;
      for (; index >= 0; index -= 1) {
        if (code[index] === char) depth += 1;
        else if (code[index] === open && (depth -= 1) === 0) break;
      }
      // Nothing opened it, so the caret is somewhere the chain can't be read.
      if (index < 0) return null;
      start = index;
      // `?` rides along for optional chaining; anything else in front of a name — `!`, `(`, an operator —
      // ends the chain, so `if (!me.` still names `me`.
    } else if (isWordChar(char) || char === '.' || char === '?') {
      start -= 1;
    } else break;
  }
  // A trailing `?` belongs to the optional-chaining dot, not to the expression being named.
  const text = code.slice(start, end).trim().replace(/\?+$/, '');
  return text.length > 0 ? text : null;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** What one entry of a name-keyed sandbox map is called in a message. */
type EntryNoun = 'placeholder' | 'trait' | 'stat' | 'entity' | 'dictionary';

const PLURAL: Record<EntryNoun, string> = {
  placeholder: 'placeholders', trait: 'traits', stat: 'stats', entity: 'entities', dictionary: 'dictionaries',
};

/** One entry per distinct name of a `kind` of map entry. `dotted` keeps only the names a `.` can reach; the
 *  rest need bracket syntax. */
function mapNameEntries(names: readonly string[], kind: EntryNoun, dotted: boolean): SurfaceEntry[] {
  return [...new Set(names)]
    .filter((name) => !dotted || IDENTIFIER.test(name))
    .map((name) => ({ name, detail: kind, info: `The “${name}” ${kind} in this world.` }));
}

/** `root.Name` or `root["Name"]`: an expression that is one entry of the map `root`. */
const entryExpression = (root: string) => new RegExp(`^${root}(\\??\\.[A-Za-z_$][\\w$]*|\\??\\.?\\[\\s*(["'])[^"'\\\\]*\\2\\s*\\])$`);
const TRAIT_ENTRY_EXPRESSION = entryExpression('traits');
const PERSONA_TRAITS_EXPRESSION = /^persona\??\.traits$/;
const PERSONA_TRAIT_ENTRY_EXPRESSION = entryExpression('persona\\??\\.traits');
const ENTITY_ENTRY_EXPRESSION = entryExpression('entities');
const DICTIONARY_ENTRY_EXPRESSION = entryExpression('dictionaries');
/** One key of a member chain, by dot or by quoted bracket; the name is in group 1 or group 2. No
 *  backreference, so the pattern can repeat in one expression. */
const KEY_STEP = String.raw`(?:\??\.([A-Za-z_$][\w$]*)|\??\.?\[\s*["']([^"'\\]*)["']\s*\])`;
const ENTITY_TRAITS_EXPRESSION = new RegExp(`^entities${KEY_STEP}\\??\\.traits$`);
const ENTITY_TRAIT_ENTRY_EXPRESSION = new RegExp(`^entities${KEY_STEP}\\??\\.traits${KEY_STEP}$`);
/** Text that ends in `entities[`. */
const ENTITIES_BRACKET = /\bentities\s*(\?\.)?\[\s*$/;
/** Text that ends in `dictionaries[`. */
const DICTIONARIES_BRACKET = /\bdictionaries\s*(\?\.)?\[\s*$/;
/** Text that ends in `entities.Name.traits[`, its entity name captured. */
const ENTITY_TRAITS_BRACKET = new RegExp(`\\bentities\\s*${KEY_STEP}\\s*\\??\\.\\s*traits\\s*(\\?\\.)?\\[\\s*$`);

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

/** The trait names a persona in the world can hold, or null when no entities are given. */
export const personaTraitsOf = (entities: readonly CodeEntityNames[] | undefined): readonly string[] | null =>
  (entities ? entities.filter((entity) => entity.persona).flatMap((entity) => entity.traits.map((trait) => trait.name)) : null);

/** One entry per distinct persona trait name. `dotted` keeps only the names a `.` can reach. */
const personaTraitEntries = (names: readonly string[], dotted: boolean): SurfaceEntry[] =>
  [...new Set(names)]
    .filter((name) => !dotted || IDENTIFIER.test(name))
    .map((name) => ({ name, detail: 'trait', info: `The “${name}” trait a persona in this world holds.` }));

/** One member step of a path: `.Name`, `?.Name`, `["Name"]`, `?.["Name"]`. */
const PATH_STEP = /^\s*(?:\?\.)?(?:\.?\[\s*(["'])([^"'\\]*)\1\s*\]|\.([A-Za-z_$][\w$]*))/;

/**
 * The segments a `placeholders` member chain names, or null for anything that is not one. A step whose key
 * only a run could know — a variable, an expression, an escape — ends the chain, so `placeholders[pick]`
 * reads as no path at all rather than as a wrong one.
 *
 * Read from the text, as `expressionBeforeDot` is, because a completion runs on half-typed code the grammar
 * cannot parse. `placeholderChainRoute` reads the same grammar off the tree, where a check needs each segment's
 * own span to underline; neither can do the other's job, and a test holds the two to the same answers.
 */
function placeholderPathSegments(expression: string): string[] | null {
  if (!/^placeholders(?![\w$])/.test(expression)) return null;
  return pathSteps(expression.slice('placeholders'.length));
}

/** The keys of a member chain's text, or null where a step is not a plain key. */
function pathSteps(text: string): string[] | null {
  let rest = text;
  const segments: string[] = [];
  while (rest.trim().length > 0) {
    const step = PATH_STEP.exec(rest);
    if (!step) return null;
    segments.push(step[3] ?? step[2]);
    rest = rest.slice(step[0].length);
  }
  return segments;
}

/** Which tree a placeholder chain walks: the world's `placeholders`, or one owner entry's `placeholders`. */
type PlaceholderRouteKind = 'world' | 'entity' | 'persona' | 'dictionary';

/** One placeholder chain: where it starts, the owner's name where an entry names one, and its keys. */
interface PlaceholderRoute {
  kind: PlaceholderRouteKind;
  owner?: string;
  segments: string[];
}

/** The global each route hangs off. */
const ROUTE_GLOBAL: Record<PlaceholderRouteKind, keyof StatRules> = {
  world: 'placeholders', entity: 'entities', persona: 'persona', dictionary: 'dictionaries',
};

/** `persona.placeholders`, or `entities.Name.placeholders` and `dictionaries.Name.placeholders`. */
const OWNER_ROUTE = new RegExp(`^(?:(persona)|(entities|dictionaries)${KEY_STEP})\\??\\.placeholders(?![\\w$])`);

/** The route a chain's text names, or null for anything that is not a placeholder chain. */
function placeholderRouteOf(expression: string): PlaceholderRoute | null {
  const world = placeholderPathSegments(expression);
  if (world) return { kind: 'world', segments: world };
  const match = OWNER_ROUTE.exec(expression);
  const segments = match && pathSteps(expression.slice(match[0].length));
  if (!match || !segments) return null;
  if (match[1]) return { kind: 'persona', segments };
  return { kind: match[2] === 'entities' ? 'entity' : 'dictionary', owner: match[3] ?? match[4], segments };
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
    return { name: node.name, detail: noun, info: `The “${node.name}” ${noun}, and the placeholders it owns.` };
  }
  const held = node.children.length ? ' It holds placeholders of its own.' : '';
  return { name: node.name, detail: 'placeholder', info: `The “${node.name}” placeholder in this world.${held}` };
}

/** One entry of `stats`, the key literal or computed: every key reads a stat, if only a blank one. */
const STAT_ENTRY_EXPRESSION = /^stats(\??\.[A-Za-z_$][\w$]*|\??\.?\[[^[\]]*\])$/;
/** One stat picked out of `Object.values(stats)`, the call's arguments captured. `filter` hands back another
 *  array, so it stays quiet. */
const ITERATED_STAT_EXPRESSION = /^Object\.values\(\s*stats\s*\)(?:\.(?:find|at|pop|shift)(\(.*\))|\[[^[\]]*\])$/;

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
  if (iterated) return iterated[1] === undefined || closesAtEnd(iterated[1]);
  return statLikeNames(code, tree).has(expression);
}

/** Whether `text` indexes `stats` by the literal `name`, by dot or by bracket. */
function indexesStat(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\bstats\\s*(?:\\?\\.)?\\[\\s*(["'\`])${escaped}\\1\\s*\\]`).test(text)) return true;
  return IDENTIFIER.test(name) && new RegExp(`\\bstats\\s*\\??\\.\\s*${escaped}(?![\\w$])`).test(text);
}

/**
 * The keys the bracket that opens just before `stringFrom` can reach, or null when it is not a
 * `placeholders` bracket. At the top level that is every key the map has; after a node, the placeholders it
 * owns — each as a name, since the bracket is where a name no dot can reach is written.
 */
function placeholderKeysInBrackets(
  code: string, stringFrom: number, placeholders: CodePlaceholders, options: AnalysisOptions, rules: StatRules,
): SurfaceEntry[] | null {
  const open = code.lastIndexOf('[', stringFrom);
  if (open === -1) return null;
  const route = placeholderRouteOf(expressionBeforeDot(code, open) ?? '');
  const start = route && routeStart(route, placeholders, options, rules);
  if (!route || start === undefined) return null;
  const map = pathMapOf(placeholders);
  // Keys only, never paths: one bracket holds one key, so a path has to be written bracket by bracket.
  if (!start && route.segments.length === 0) return map.top.map(nodeEntry);
  const { node, rest } = walkPlaceholderPath(map, route.segments, start);
  return rest.length === 0 && node ? node.children.map(nodeEntry) : [];
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
  if (!start && segments.length === 0) return map.top.filter((node) => IDENTIFIER.test(node.name)).map(nodeEntry);
  const { node, rest } = walkPlaceholderPath(map, segments, start);
  if (rest.length === 0 && node) {
    const children = node.children.filter((child) => IDENTIFIER.test(child.name)).map(nodeEntry);
    if (!node.placeholder) return children;
    // A child named like a member lost to it, so the member is what the list offers for that name.
    const fields = placeholderEntryFields(placeholderKindNoun(node.placeholder));
    return [...fields, ...children.filter((child) => !isPlaceholderEntryMember(child.name))];
  }
  // Past one unknown segment nothing is known; a member read off an entry carries no sandbox members at all.
  if (rest.length === 1 && !isPlaceholderEntryMember(rest[0])) return placeholderEntryFields('Wildcard');
  return null;
}

/**
 * What the expression before a dot can be shown to carry, or null where nothing can be. The order is the
 * order of certainty: a named built-in, then the one array the sandbox injects, then a stat's turn input,
 * then anything that reads as a stat — and silence for everything else, because a wrong list reads as the
 * editor asserting the sandbox holds something it never has.
 */
function membersAfterDot(
  code: string, tree: Tree, dotPos: number, options: SurfaceAnalysisOptions,
): readonly SurfaceEntry[] | null {
  const expression = expressionBeforeDot(code, dotPos);
  if (expression === null) return null;
  const rules = statRulesOf(options.surface);
  if (rules.stats && expression === 'stats') {
    return options.statNames ? mapNameEntries(options.statNames, 'stat', true) : null;
  }
  const route = placeholderRouteOf(expression);
  if (route && rules[ROUTE_GLOBAL[route.kind]]) {
    const start = options.placeholders && routeStart(route, options.placeholders, options, rules);
    return options.placeholders && start !== undefined ? placeholderMembersAt(options.placeholders, route.segments, start) : null;
  }
  if (rules.dictionaries && expression === 'dictionaries') {
    return options.placeholders?.dictionaries ? mapNameEntries(options.placeholders.dictionaries.map((book) => book.name), 'dictionary', true) : null;
  }
  if (rules.dictionaries && DICTIONARY_ENTRY_EXPRESSION.test(expression)) return DICTIONARY_FIELDS;
  if (rules.stats && expression === 'clock') return CLOCK_MEMBERS;
  if (rules.stats && expression === 'clock.previous') return CLOCK_PREVIOUS_FIELDS;
  if (rules.traits && expression === 'traits') return options.traits ? mapNameEntries(options.traits, 'trait', true) : null;
  if (rules.traits && TRAIT_ENTRY_EXPRESSION.test(expression)) return TRAIT_ENTRY_FIELDS;
  if (rules.persona && expression === 'persona') return PERSONA_FIELDS;
  if (rules.persona && PERSONA_TRAITS_EXPRESSION.test(expression)) {
    const names = personaTraitsOf(options.entities);
    return names ? personaTraitEntries(names, true) : null;
  }
  if (rules.persona && PERSONA_TRAIT_ENTRY_EXPRESSION.test(expression)) return TRAIT_ENTRY_FIELDS;
  if (rules.entities && expression === 'entities') {
    return options.entities ? entityNameEntries(options.entities, true) : null;
  }
  if (rules.entities && ENTITY_ENTRY_EXPRESSION.test(expression)) return ENTITY_FIELDS;
  const entityTraits = rules.entities ? ENTITY_TRAITS_EXPRESSION.exec(expression) : null;
  if (entityTraits) {
    const names = options.entities && traitsOfEntity(options.entities, entityNamed(entityTraits));
    return names ? mapNameEntries(names, 'trait', true) : null;
  }
  if (rules.entities && ENTITY_TRAIT_ENTRY_EXPRESSION.test(expression)) return TRAIT_ENTRY_FIELDS;
  const listed = options.surface.members.get(expression);
  if (listed) return listed;
  if (!rules.stats && !rules.self) return null;
  const turnInput = /^(.+)\.(previous|delta)$/.exec(expression);
  if (turnInput) {
    if (!looksLikeStat(code, tree, turnInput[1])) return null;
    return turnInput[2] === 'previous' ? PREVIOUS_FIELDS : DELTA_MEMBERS;
  }
  const deltaMember = /^(.+)\.delta\.([A-Za-z_$][\w$]*)$/.exec(expression);
  if (deltaMember && DELTA_MEMBERS.some((member) => member.name === deltaMember[2])) {
    return looksLikeStat(code, tree, deltaMember[1]) ? DELTA_FIELDS : null;
  }
  return looksLikeStat(code, tree, expression) ? STAT_FIELDS : null;
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

const WRITABLE_LIST = SELF_WRITABLE_FIELDS.map((field) => `self.${field}`).join(', ');

/** One write to a member: whether it is aimed at the stat's own entry, and what is wrong with it. */
interface WriteCheck {
  own: boolean;
  problem: CodeDiagnostic | null;
}

/** A write to `field` on the stat's own entry, reached as `path`: fine for a writable field, an error otherwise. */
function checkOwnField(field: SyntaxNode | null, path: string, code: string): WriteCheck {
  // A bracketed field can't be named without running the code.
  if (!field) return { own: true, problem: null };
  const name = code.slice(field.from, field.to);
  const known = STAT_FIELDS.some((entry) => entry.name === name);
  if (known && SELF_WRITABLE_FIELDS.includes(name)) return { own: true, problem: null };
  const suggestion = known ? null : nearestName(name, STAT_FIELDS.map((entry) => entry.name));
  const message = known ? `${path}.${name} can’t be written. Only ${WRITABLE_LIST} can.`
    : suggestion ? `${path} has no field “${name}”. Did you mean “${suggestion}”?` : `${path} has no field “${name}”.`;
  return { own: true, problem: { from: field.from, to: field.to, severity: 'error', message } };
}

const OTHER_STAT_WRITE = 'This writes to another stat, and stat code can only change its own. Write to self instead.';

function checkWrite(target: SyntaxNode, code: string, tree: Tree, declared: Set<string>, selfName?: string): WriteCheck {
  const warn = (message: string): WriteCheck => ({ own: false, problem: { from: target.from, to: target.to, severity: 'warning', message } });
  const reachesOwn = (text: string) => reachesOwnStat(statLikeNames(code, tree).get(text) ?? text, selfName);
  // `stats.Name = …` replaces the whole entry, which the host never reads back, even for the stat's own name.
  const targetText = code.slice(target.from, target.to);
  if (STAT_ENTRY_EXPRESSION.test(targetText)) return warn(reachesOwn(targetText) ? 'Write to self.value instead.' : OTHER_STAT_WRITE);
  // Walk in to the stat the chain starts from, so a write nested in `previous` or `delta` is caught too.
  for (let member: SyntaxNode | null = target; member?.name === 'MemberExpression'; member = member.firstChild) {
    const entry = member.firstChild;
    if (!entry) break;
    const text = code.slice(entry.from, entry.to);
    if (text === 'self' && declared.has('self')) return { own: true, problem: null };
    if (!looksLikeStat(code, tree, text)) continue;
    return reachesOwn(text) ? checkOwnField(member.getChild('PropertyName'), text, code) : warn(OTHER_STAT_WRITE);
  }
  return { own: false, problem: null };
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

/** A map entry's name as the code spells it, and where. */
interface EntryRef {
  name: string;
  from: number;
  to: number;
}

/** The key one member names, or null for a key only a run could know. */
function memberKey(node: SyntaxNode, code: string): EntryRef | null {
  const property = node.getChild('PropertyName');
  if (property) return { name: code.slice(property.from, property.to), from: property.from, to: property.to };
  const literal = node.getChild('String');
  if (!literal || literal.to - literal.from < 2 || code[literal.to - 1] !== code[literal.from]) return null;
  const name = code.slice(literal.from + 1, literal.to - 1);
  // An escape has to be evaluated to name the key.
  return name.includes('\\') ? null : { name, from: literal.from, to: literal.to };
}

/** The name a `root.Name` or `root["Name"]` member names, or null for any other member and for a key only a
 *  run could know. */
function entryRef(
  node: SyntaxNode, code: string, root: 'placeholders' | 'traits' | 'stats' | 'persona' | 'entities' | 'dictionaries',
): EntryRef | null {
  const object = node.firstChild;
  if (object?.name !== 'VariableName' || code.slice(object.from, object.to) !== root) return null;
  return memberKey(node, code);
}

/** Whether `node` is `persona.traits`, the persona's trait map. */
function isPersonaTraits(node: SyntaxNode | null, code: string): boolean {
  if (node?.name !== 'MemberExpression') return false;
  const property = node.getChild('PropertyName');
  return !!property && code.slice(property.from, property.to) === 'traits' && !!entryRef(node, code, 'persona');
}

/** The name a `persona.traits.Name` or `persona.traits["Name"]` member names, as `entryRef` reads `traits`. */
const personaTraitRef = (node: SyntaxNode, code: string): EntryRef | null =>
  (isPersonaTraits(node.firstChild, code) ? memberKey(node, code) : null);

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
 *  is how the last-authored one displays, where that differs from the name as written. */
function checkEntryName(
  { name, from, to }: EntryRef,
  names: readonly string[],
  noun: EntryNoun,
  winner: (last: number) => string = () => name,
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
  return { from, to, severity: 'error', message };
}

const checkTraitName = (ref: EntryRef, names: readonly string[]) => checkEntryName(ref, names, 'trait');

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
  out.push({
    from: ref.from, to: ref.to, severity: 'error',
    message: suggestion ? `${lead}. Did you mean “${suggestion}”?` : `${lead}.`,
  });
  return out;
}

/** The warning for a child whose name loses to a member every placeholder entry has. */
const shadowedChild = (ref: EntryRef, holder: PlaceholderPathNode): CodeDiagnostic => ({
  from: ref.from, to: ref.to, severity: 'warning',
  message: `Every placeholder has a ${ref.name} member, so this reads the member. `
    + `The placeholder named “${ref.name}” under “${placeholderPathLabel(holder.path)}” is not reachable from code.`,
});

/** What is wrong with a path through an owner's `placeholders`: a key no placeholder answers, or a child that
 *  loses to a member. A warning, since a library owner can carry it. */
function checkOwnedPlaceholderPath(
  chain: PlaceholderChain, placeholders: CodePlaceholders, options: AnalysisOptions, rules: StatRules,
): CodeDiagnostic | null {
  const route = routeOfChain(chain);
  const start = routeStart(route, placeholders, options, rules);
  if (!start || !chain.refs.length) return null;
  const { node, rest, shadowed } = walkPlaceholderPath(pathMapOf(placeholders), route.segments, start);
  if (rest.length === 0 || !node) return null;
  const ref = chain.refs[chain.refs.length - rest.length];
  if (shadowed) return shadowedChild(ref, node);
  if (node.placeholder && isPlaceholderEntryMember(ref.name)) return null;
  const lead = node !== start ? `Unknown placeholder name “${ref.name}” under “${placeholderPathLabel(node.path)}”.`
    : chain.kind === 'persona' ? `Unknown persona placeholder name “${ref.name}”. A library persona can have it.`
      : `“${route.owner}” has no placeholder named “${ref.name}”.`;
  const suggestion = nearestName(ref.name, node.children.map((child) => child.name));
  return {
    from: ref.from, to: ref.to, severity: 'warning',
    message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead,
  };
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
  return { from: field.from, to: field.to, severity: 'error', message };
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

/** What is wrong with an entity or dictionary name: several share it, or nothing authored has it. A library
 *  item can still have it, so the miss is only a warning. */
function checkOwnerName(ref: EntryRef, names: readonly string[], noun: 'entity' | 'dictionary'): CodeDiagnostic | null {
  if (names.includes(ref.name)) return checkEntryName(ref, names, noun);
  const lead = `Unknown ${noun} name “${ref.name}”. A library ${noun} can have it.`;
  const suggestion = nearestName(ref.name, [...new Set(names)]);
  return { from: ref.from, to: ref.to, severity: 'warning', message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead };
}

const checkEntityName = (ref: EntryRef, entities: readonly CodeEntityNames[]) =>
  checkOwnerName(ref, keyedEntityNames(entities), 'entity');

/** What is wrong with a trait name on a known entity: its set has no trait called that. A later library
 *  entity can take the name with another set, so this is only a warning. */
function checkEntityTraitName(
  { entity, trait }: { entity: EntryRef; trait: EntryRef }, entities: readonly CodeEntityNames[],
): CodeDiagnostic | null {
  const names = traitsOfEntity(entities, entity.name);
  if (!names || names.includes(trait.name)) return null;
  const suggestion = nearestName(trait.name, [...new Set(names)]);
  const lead = `“${entity.name}” has no trait named “${trait.name}”.`;
  return { from: trait.from, to: trait.to, severity: 'warning', message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead };
}

/** What is wrong with a persona trait name: no persona in the world holds it. A library persona may still
 *  hold it, so this is only a warning. */
function checkPersonaTraitName({ name, from, to }: EntryRef, names: readonly string[]): CodeDiagnostic | null {
  if (names.includes(name)) return null;
  const lead = `Unknown persona trait name “${name}”. A library persona can have it.`;
  const suggestion = nearestName(name, [...new Set(names)]);
  return { from, to, severity: 'warning', message: suggestion ? `${lead} Did you mean “${suggestion}”?` : lead };
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
  const tree = parse(code);
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
    // Inside `placeholders[…]` or an owner's `placeholders[…]` at any depth: the keys that bracket can reach,
    // quoted names included.
    const bracket = options.placeholders && /\[\s*$/.test(code.slice(0, node.from))
      ? placeholderKeysInBrackets(code, node.from, options.placeholders, options, rules) : null;
    if (bracket) {
      return { from: innerFrom, to: innerTo, options: bracket.map((entry) => asCompletion(entry, 'text')) };
    }
    // Before `traits[`, whose pattern every entity's map also matches.
    const entityBracket = rules.entities ? ENTITY_TRAITS_BRACKET.exec(code.slice(0, node.from)) : null;
    if (entityBracket) {
      const names = traitsOfEntity(options.entities ?? [], entityNamed(entityBracket)) ?? [];
      return { from: innerFrom, to: innerTo, options: mapNameEntries(names, 'trait', false).map((entry) => asCompletion(entry, 'text')) };
    }
    if (rules.entities && ENTITIES_BRACKET.test(code.slice(0, node.from))) {
      const names = entityNameEntries(options.entities ?? [], false);
      return { from: innerFrom, to: innerTo, options: names.map((entry) => asCompletion(entry, 'text')) };
    }
    if (rules.dictionaries && DICTIONARIES_BRACKET.test(code.slice(0, node.from))) {
      const names = mapNameEntries((options.placeholders?.dictionaries ?? []).map((book) => book.name), 'dictionary', false);
      return { from: innerFrom, to: innerTo, options: names.map((entry) => asCompletion(entry, 'text')) };
    }
    if (rules.persona && /\bpersona\s*\??\.\s*traits\s*(\?\.)?\[\s*$/.test(code.slice(0, node.from))) {
      const names = personaTraitEntries(personaTraitsOf(options.entities) ?? [], false);
      return { from: innerFrom, to: innerTo, options: names.map((entry) => asCompletion(entry, 'text')) };
    }
    if (rules.traits && /\btraits\s*(\?\.)?\[\s*$/.test(code.slice(0, node.from))) {
      const names = mapNameEntries(options.traits ?? [], 'trait', false);
      return { from: innerFrom, to: innerTo, options: names.map((entry) => asCompletion(entry, 'text')) };
    }
    // Inside `stats["…"]` and any other string alike. The whole literal is replaced, not the part before
    // the caret — a name half-typed in the middle of an old one would otherwise leave its tail behind.
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
        label: name, type: 'variable', detail: 'slot', info: `The “${name}” slot declared in this template.`,
      })),
    };
  }

  // A completion inside a slot would be filling in template syntax with sandbox names.
  if (overlapsAny(from, pos, ranges)) return null;

  // After a dot the list is only ever as good as what the expression can be shown to be. A wrong guess
  // here is worse than silence: it reads as the editor asserting the sandbox has something it doesn't.
  if (/\.\s*$/.test(beforeWord)) {
    const members = membersAfterDot(code, tree, beforeWord.replace(/\s+$/, '').length - 1, options);
    if (!members) return null;
    return { from, to: pos, options: members.map((member) => asCompletion(member, 'property')) };
  }

  const declared = declaredNames(code, tree);
  // The word being typed is itself a definition while it's being typed; offering it back is noise.
  const typed = code.slice(from, pos);
  // Right after `stats[` a quoted name leads the list; `self.name` or a variable of the author's can go there too.
  const quotedStats = rules.stats && /\bstats\s*(\?\.)?\[\s*$/.test(beforeWord)
    ? mapNameEntries(options.statNames ?? [], 'stat', false).map((entry) => ({ ...asCompletion(entry, 'text', 2), label: JSON.stringify(entry.name) }))
    : [];
  return {
    from,
    to: pos,
    options: [
      ...quotedStats,
      ...surface.globals.map((entry) => asCompletion(entry, 'variable', 1)),
      ...[...declared]
        .filter((name) => name !== typed && !known.has(name))
        .map((name) => ({ label: name, type: 'variable' as const, detail: 'yours', info: 'Declared in this code.' })),
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
  const tree = parse(code);
  const ranges = slotRanges(code, options);
  const diagnostics: CodeDiagnostic[] = [];
  const declared = declaredNames(code, tree);
  let sawReturn = false;
  let sawSyntaxError = false;
  let sawOwnWrite = false;
  let sawPlaceholderWrite = false;
  let sawTraitWrite = false;
  const placeholdersInScope = rules.placeholders && !declared.has('placeholders');
  const traitsInScope = rules.traits && !declared.has('traits');
  const personaInScope = rules.persona && !declared.has('persona');
  const personaTraits = personaTraitsOf(options.entities);
  const entitiesInScope = rules.entities && !declared.has('entities');
  const dictionariesInScope = rules.dictionaries && !declared.has('dictionaries');
  const statsInScope = rules.stats && !declared.has('stats');
  /** Whether a chain's root is an owner global the code has not shadowed. */
  const ownerRootInScope = (root: string | null) =>
    (root === 'entities' && entitiesInScope) || (root === 'persona' && personaInScope) || (root === 'dictionaries' && dictionariesInScope);
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
      if (statWrites) {
        const { own, problem } = checkWrite(target, code, tree, declared, options.selfName);
        if (own) sawOwnWrite = true;
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
      const problem = ref && !overlapsAny(ref.from, ref.to, ranges) ? checkTraitName(ref, options.traits) : null;
      if (problem) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression' && personaTraits && personaInScope) {
      const ref = personaTraitRef(cursor.node, code);
      const problem = ref && !overlapsAny(ref.from, ref.to, ranges) ? checkPersonaTraitName(ref, personaTraits) : null;
      if (problem) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression' && options.entities && entitiesInScope) {
      const entity = entryRef(cursor.node, code, 'entities');
      const parts = entityTraitParts(cursor.node, code);
      const problem = entity && !overlapsAny(entity.from, entity.to, ranges) ? checkEntityName(entity, options.entities)
        : parts && !overlapsAny(parts.trait.from, parts.trait.to, ranges) ? checkEntityTraitName(parts, options.entities) : null;
      if (problem) diagnostics.push(problem);
    }
    if (cursor.type.name === 'MemberExpression' && options.statNames && statsInScope) {
      const ref = entryRef(cursor.node, code, 'stats');
      // The empty key reaches an unnamed stat, which no name list carries.
      const problem = ref?.name && !overlapsAny(ref.from, ref.to, ranges) ? checkEntryName(ref, options.statNames, 'stat') : null;
      if (problem) diagnostics.push(problem);
    }
    if (cursor.type.name !== 'VariableName') continue;

    const name = code.slice(from, to);
    if (declared.has(name) || known.has(name)) continue;
    if (overlapsAny(from, to, ranges)) continue;
    const suggestion = nearestName(name, [...known, ...declared]);
    diagnostics.push({
      from,
      to,
      severity: 'error',
      message: suggestion
        ? `“${name}” isn’t available in ${surface.label}. Did you mean “${suggestion}”?`
        : `“${name}” isn’t available in ${surface.label}.`,
    });
  } while (cursor.next());

  // Code with no return can still set the value through self, pin a placeholder, or switch a trait. Code that
  // does none of these changes nothing. A missing return on code the parser couldn't finish reading is a
  // guess about half-typed code.
  if (surface.missingReturn && !sawReturn && !sawOwnWrite && !sawPlaceholderWrite && !sawTraitWrite && !sawSyntaxError) {
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
    .sort((a, b) => a.from - b.from);
}

/** `codeDiagnostics` against the stat-code surface. */
export const statCodeDiagnostics = (code: string, options: AnalysisOptions = {}) =>
  codeDiagnostics(code, { ...options, surface: STAT_CODE_SURFACE });
