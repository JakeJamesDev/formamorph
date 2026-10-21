/**
 * What a name in sandboxed code is, read from the syntax tree. Completion and hover cards read the same
 * walk, so they never disagree about what code reaches.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode, Tree } from '@lezer/common';
import { surfaceHasGlobal, type CodeSurface } from '@/lib/codeSurface';
import { locationMoveKey } from '@/lib/codeRenameChains';
import { isPlaceholderEntryMember } from '@/lib/statCodePaths';
import { DELTA_MEMBERS } from '@/lib/statCodeSurface';
import { findSlotRanges } from '@/lib/statCodeTemplates';

/** Whose code a stat box holds: an entity's own stat, or a Blueprint stat. */
export type CodeOwnerKind = 'entity' | 'blueprint';

/** Whose map an entry sits in. `owner` is the box's owner: the entity, or each owner in a Blueprint box. */
export type CodeMapOwner =
  | { route: 'world' }
  | { route: 'owner' }
  | { route: 'persona' }
  | { route: 'entity'; entity: string }
  | { route: 'dictionary'; dictionary: string };

export type StatOwner = Exclude<CodeMapOwner, { route: 'dictionary' }>;
export type TraitOwner = StatOwner;
export type PlaceholderOwner = CodeMapOwner;

/** What an expression is, as far as the tree shows it. */
export type CodeValue =
  | { is: 'statMap'; owner: StatOwner }
  /** A stat entry. `owner` and `key` are null where only a run could name them. */
  | { is: 'stat'; owner: StatOwner | null; key: string | null }
  | { is: 'statPrevious'; stat: CodeStatValue }
  | { is: 'statDelta'; stat: CodeStatValue }
  | { is: 'deltaSource'; stat: CodeStatValue; source: string }
  | { is: 'traitMap'; owner: TraitOwner }
  | { is: 'trait'; owner: TraitOwner; key: string }
  /** A trait script's own trait, read-only. `key` is its code name where the editor knows it. */
  | { is: 'selfTrait'; key: string | null }
  /** The trait a When a Trait Switches script fires on, read-only. */
  | { is: 'switchedTrait' }
  /** A `placeholders` map or a node below it. `path` holds every key after the map, members included. */
  | { is: 'placeholders'; owner: PlaceholderOwner; path: readonly string[] }
  | { is: 'entityMap' }
  | { is: 'entity'; key: string }
  | { is: 'persona' }
  | { is: 'owner' }
  | { is: 'dictionaryMap' }
  | { is: 'dictionary'; key: string }
  /** A book's `entries`, `dictionary` its code name. */
  | { is: 'dictionaryEntryMap'; dictionary: string }
  | { is: 'dictionaryEntry'; dictionary: string; key: string }
  | { is: 'clock'; path: 'clock' | 'clock.previous' }
  /** An exact path the surface lists members for, like `Math` or `scene.location`. */
  | { is: 'listed'; path: string };

export type CodeStatValue = Extract<CodeValue, { is: 'stat' }>;

/** The name at a position, by kind, with its key and span. A bracket key's span holds its quotes. */
export type ResolvedCodeName = { key: string; from: number; to: number } & (
  | { kind: 'global' }
  | { kind: 'member'; of: CodeValue }
  | { kind: 'stat'; owner: StatOwner }
  | { kind: 'trait'; owner: TraitOwner }
  | { kind: 'placeholder'; owner: PlaceholderOwner; path: readonly string[] }
  | { kind: 'entity' }
  | { kind: 'dictionary' }
  | { kind: 'dictionaryEntry'; dictionary: string }
  /** The place a `location.move("<name>")` call names. */
  | { kind: 'location' }
  | { kind: 'declared'; at: number }
  | { kind: 'slot' }
);

export interface ResolverOptions {
  /** What the code can reach. */
  surface: CodeSurface;
  /** Whose code this is. Absent in a global stat's box. */
  owner?: CodeOwnerKind;
  /** The name of the stat the code belongs to: the key `self` reads. */
  selfName?: string;
  /** Treat `{{name:type=default}}` spans as slots. */
  slots?: boolean;
}

export const parseCode = (code: string): Tree => javascriptLanguage.parser.parse(code);

/** Every name the code declares, at its first declaration. Whole-document rather than block-scoped. */
export function declarations(code: string, tree: Tree = parseCode(code)): Map<string, number> {
  const names = new Map<string, number>();
  const add = (from: number, to: number) => { if (!names.has(code.slice(from, to))) names.set(code.slice(from, to), from); };
  const cursor = tree.cursor();
  do {
    if (cursor.type.name === 'VariableDefinition') {
      add(cursor.from, cursor.to);
    } else if (cursor.type.name === 'PatternProperty') {
      // `const {min, max} = stat` binds the property names themselves unless renamed.
      const child = cursor.node.firstChild;
      if (child) add(child.from, child.to);
    }
  } while (cursor.next());
  return names;
}

/** Every name the author declared anywhere in the code. */
export const declaredNames = (code: string, tree: Tree = parseCode(code)): Set<string> =>
  new Set(declarations(code, tree).keys());

/** Identifiers holding something that came out of `stats` or `self` — the objects whose fields we can name
 *  — each mapped to the text of the declaration that bound it. */
export function statLikeNames(code: string, tree: Tree): Map<string, string> {
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

/** A map entry's name as the code spells it, and where. */
export interface EntryRef {
  name: string;
  from: number;
  to: number;
}

/** The key one member names, or null for a key only a run could know. */
export function memberKey(node: SyntaxNode, code: string): EntryRef | null {
  const property = node.getChild('PropertyName');
  if (property) return { name: code.slice(property.from, property.to), from: property.from, to: property.to };
  const literal = node.getChild('String');
  if (!literal || literal.to - literal.from < 2 || code[literal.to - 1] !== code[literal.from]) return null;
  const name = code.slice(literal.from + 1, literal.to - 1);
  // An escape has to be evaluated to name the key.
  return name.includes('\\') ? null : { name, from: literal.from, to: literal.to };
}

/** The methods that hand back one element of an array. `filter` hands back another array. */
const PICK_ONE = new Set(['find', 'at', 'pop', 'shift']);

const DELTA_SOURCES = new Set(DELTA_MEMBERS.map((member) => member.name));

/** The dotted path of a chain of plain names, like `scene.location`, or null for anything else. */
function dottedPath(node: SyntaxNode, code: string): string | null {
  if (node.name === 'VariableName') return code.slice(node.from, node.to);
  if (node.name !== 'MemberExpression') return null;
  const object = node.firstChild;
  const property = node.getChild('PropertyName');
  const head = object && property ? dottedPath(object, code) : null;
  return head === null || !property ? null : `${head}.${code.slice(property.from, property.to)}`;
}

/** The nodes that can name something. */
const NAME_NODES = new Set(['VariableName', 'VariableDefinition', 'PropertyName', 'String']);

/** The member expression `node` sits in directly, as its key or as its object. */
export function keyOwner(node: SyntaxNode): SyntaxNode | null {
  const parent = node.parent;
  return parent?.name === 'MemberExpression' ? parent : null;
}

/** One reading of `code`. `ownNames` reads a global the code declares as the author's own, as a card does. */
export function codeResolver(
  code: string, options: ResolverOptions, { ownNames = false, tree = parseCode(code) }: { ownNames?: boolean; tree?: Tree } = {},
) {
  const { surface } = options;
  const has = (name: string) => surface.statMaps && surfaceHasGlobal(surface, name);
  let declared: Map<string, number> | undefined;
  const declaredAt = () => (declared ??= declarations(code, tree));
  let statLike: Map<string, string> | undefined;
  const isStatLike = (name: string) => (statLike ??= statLikeNames(code, tree)).has(name);
  const selfOwner: StatOwner = options.owner ? { route: 'owner' } : { route: 'world' };

  /** What a bare name is: one of the sandbox's maps, a listed built-in, or a stat bound by the code. */
  function rootValue(name: string): CodeValue | null {
    // A global the code declares is the author's own, and so is everything below it.
    if (has(name) && ownNames && declaredAt().has(name)) return null;
    if (has(name)) {
      switch (name) {
        case 'stats': return { is: 'statMap', owner: { route: 'world' } };
        // A world script's `self` is an empty object, so it has no fields to name.
        case 'self':
          if (surface.selfIs === 'empty') return null;
          return surface.selfIs === 'trait'
            ? { is: 'selfTrait', key: options.selfName ?? null }
            : { is: 'stat', owner: selfOwner, key: options.selfName ?? null };
        case 'placeholders': return { is: 'placeholders', owner: { route: 'world' }, path: [] };
        case 'traits': return { is: 'traitMap', owner: { route: 'world' } };
        case 'entities': return { is: 'entityMap' };
        case 'persona': return { is: 'persona' };
        case 'owner': return { is: 'owner' };
        case 'dictionaries': return { is: 'dictionaryMap' };
        case 'clock': return { is: 'clock', path: 'clock' };
        case 'trait': return { is: 'switchedTrait' };
      }
    }
    if (surface.members.has(name)) return { is: 'listed', path: name };
    if ((has('stats') || has('self')) && isStatLike(name)) return { is: 'stat', owner: null, key: null };
    return null;
  }

  /** What `base` holds under `key`. A null key is one only a run could name; only a stat map resolves it. */
  function stepValue(base: CodeValue, key: string | null): CodeValue | null {
    if (base.is === 'statMap') return { is: 'stat', owner: base.owner, key };
    if (key === null) return null;
    switch (base.is) {
      case 'stat':
        return key === 'previous' ? { is: 'statPrevious', stat: base } : key === 'delta' ? { is: 'statDelta', stat: base } : null;
      case 'statDelta': return DELTA_SOURCES.has(key) ? { is: 'deltaSource', stat: base.stat, source: key } : null;
      case 'traitMap': return { is: 'trait', owner: base.owner, key };
      case 'placeholders': return { ...base, path: [...base.path, key] };
      case 'entityMap': return { is: 'entity', key };
      case 'dictionaryMap': return { is: 'dictionary', key };
      case 'entity': return ownerMap({ route: 'entity', entity: base.key }, key);
      case 'persona': return ownerMap({ route: 'persona' }, key);
      case 'owner': return ownerMap({ route: 'owner' }, key);
      case 'dictionary':
        if (key === 'entries') return { is: 'dictionaryEntryMap', dictionary: base.key };
        return key === 'placeholders' ? { is: 'placeholders', owner: { route: 'dictionary', dictionary: base.key }, path: [] } : null;
      case 'dictionaryEntryMap': return { is: 'dictionaryEntry', dictionary: base.dictionary, key };
      case 'clock': return base.path === 'clock' && key === 'previous' ? { is: 'clock', path: 'clock.previous' } : null;
      default: return null;
    }
  }

  /** An owner entry's own `stats`, `traits` or `placeholders`. */
  function ownerMap(owner: StatOwner, key: string): CodeValue | null {
    if (key === 'stats') return { is: 'statMap', owner };
    if (key === 'traits') return { is: 'traitMap', owner };
    if (key === 'placeholders') return { is: 'placeholders', owner, path: [] };
    return null;
  }

  /** `Object.values(<stat map>)`'s map, or null for any other call. */
  function valuesOfStatMap(call: SyntaxNode): Extract<CodeValue, { is: 'statMap' }> | null {
    const callee = call.firstChild;
    if (call.name !== 'CallExpression' || callee?.name !== 'MemberExpression' || dottedPath(callee, code) !== 'Object.values') return null;
    const args = call.getChild('ArgList');
    const inner = args ? collectArgs(args) : [];
    if (inner.length !== 1) return null;
    const map = valueOf(inner[0]);
    return map?.is === 'statMap' ? map : null;
  }

  /** What an expression is, or null where the tree can't show it. */
  function valueOf(node: SyntaxNode): CodeValue | null {
    if (node.name === 'VariableName') return rootValue(code.slice(node.from, node.to));
    if (node.name === 'CallExpression') {
      // `Object.values(stats).find(…)` picks one stat.
      const callee = node.firstChild;
      const method = callee?.name === 'MemberExpression' ? callee.getChild('PropertyName') : null;
      const map = method && PICK_ONE.has(code.slice(method.from, method.to)) && callee?.firstChild ? valuesOfStatMap(callee.firstChild) : null;
      return map ? { is: 'stat', owner: map.owner, key: null } : null;
    }
    if (node.name !== 'MemberExpression') return null;
    const object = node.firstChild;
    const key = memberKey(node, code);
    const bracket = !node.getChild('PropertyName');
    const iterated = bracket && object ? valuesOfStatMap(object) : null;
    if (iterated) return { is: 'stat', owner: iterated.owner, key: null };
    const base = object ? valueOf(object) : null;
    const stepped = base && stepValue(base, key?.name ?? null);
    if (stepped) return stepped;
    const path = dottedPath(node, code);
    return path !== null && surface.members.has(path) ? { is: 'listed', path } : null;
  }

  /** What the object before the member access's `.`, `?.` or `[` at `at` is. */
  function valueBefore(at: number): CodeValue | null {
    const token = tree.resolveInner(at, 1);
    if (!['.', '?.', '['].includes(token.name) || token.parent?.name !== 'MemberExpression') return null;
    const object = token.parent.firstChild;
    return object && object.from < token.from ? valueOf(object) : null;
  }

  /** What one member step names, from what its object is. */
  function stepName(member: SyntaxNode, ref: EntryRef): ResolvedCodeName | null {
    const object = member.firstChild;
    const base = object ? valueOf(object) : null;
    const span = { key: ref.name, from: ref.from, to: ref.to };
    if (!base) {
      const path = object ? dottedPath(object, code) : null;
      return path !== null && surface.members.has(path) ? { ...span, kind: 'member', of: { is: 'listed', path } } : null;
    }
    switch (base.is) {
      case 'statMap': return { ...span, kind: 'stat', owner: base.owner };
      case 'traitMap': return { ...span, kind: 'trait', owner: base.owner };
      case 'entityMap': return { ...span, kind: 'entity' };
      case 'dictionaryMap': return { ...span, kind: 'dictionary' };
      case 'dictionaryEntryMap': return { ...span, kind: 'dictionaryEntry', dictionary: base.dictionary };
      case 'placeholders':
        // Below the first key a member wins over a child of the same name, and nothing hangs off a member.
        if (base.path.slice(1).some(isPlaceholderEntryMember)) return null;
        if (base.path.length > 0 && isPlaceholderEntryMember(ref.name)) return { ...span, kind: 'member', of: base };
        return { ...span, kind: 'placeholder', owner: base.owner, path: [...base.path, ref.name] };
      default: return { ...span, kind: 'member', of: base };
    }
  }

  /** The name at `pos`, or null where nothing the code reaches is named there. */
  function nameAt(pos: number): ResolvedCodeName | null {
    if (options.slots) {
      const slot = findSlotRanges(code).find((range) => pos >= range.from && pos <= range.to);
      if (slot) return { kind: 'slot', key: slot.name, from: slot.from, to: slot.to };
    }
    const after = tree.resolveInner(pos, 1);
    const node = NAME_NODES.has(after.name) ? after : tree.resolveInner(pos, -1);
    if (!NAME_NODES.has(node.name)) return null;
    const text = code.slice(node.from, node.to);
    switch (node.name) {
      case 'VariableDefinition': {
        const at = declaredAt().get(text);
        return at === undefined ? null : { kind: 'declared', key: text, from: node.from, to: node.to, at };
      }
      case 'VariableName': {
        const at = declaredAt().get(text);
        if (at !== undefined) return { kind: 'declared', key: text, from: node.from, to: node.to, at };
        const known = surface.globals.some((entry) => entry.name === text) || surface.builtins.some((entry) => entry.name === text);
        return known ? { kind: 'global', key: text, from: node.from, to: node.to } : null;
      }
      case 'PropertyName': {
        // `const {min} = self` declares `min` by its property name.
        const at = node.parent?.name === 'PatternProperty' ? declaredAt().get(text) : undefined;
        if (at !== undefined) return { kind: 'declared', key: text, from: node.from, to: node.to, at };
        const member = node.parent;
        const ref = member?.name === 'MemberExpression' ? memberKey(member, code) : null;
        return member && ref ? stepName(member, ref) : null;
      }
      default: {
        // The one string that names something outside a bracket key is the place `location.move` takes.
        const move = declaredAt().has('location') ? null : locationMoveKey(node, code);
        if (move) return { kind: 'location', key: move.name, from: node.from, to: node.to };
        // A string names something otherwise only as a bracket key; `x === "Health"` names nothing.
        const member = keyOwner(node);
        const ref = member ? memberKey(member, code) : null;
        return member && ref ? stepName(member, ref) : null;
      }
    }
  }

  return { tree, valueOf, valueBefore, nameAt };
}

/** The arguments of a call's list, parse errors included, so a half-typed list never reads as one argument. */
function collectArgs(args: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let child = args.firstChild; child; child = child.nextSibling) {
    if (!['(', ')', ','].includes(child.name) && !child.type.isSkipped) out.push(child);
  }
  return out;
}

/** The name at `pos` in `code`, or null where nothing the code reaches is named there. */
export const resolveCodeName = (code: string, pos: number, options: ResolverOptions): ResolvedCodeName | null =>
  codeResolver(code, options, { ownNames: true }).nameAt(pos);
