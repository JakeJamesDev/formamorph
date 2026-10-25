/**
 * What a name in sandboxed code is, read from the syntax tree. Completion and hover cards read the same
 * walk, so they never disagree about what code reaches.
 */

import type { SyntaxNode, Tree } from '@lezer/common';
import { surfaceHasGlobal, type CodeSurface } from '@/lib/codeSurface';
import { locationMoveKey } from '@/lib/codeRenameChains';
import { isPlaceholderEntryMember } from '@/lib/statCodePaths';
import { DELTA_MEMBERS } from '@/lib/statCodeSurface';
import { findSlotRanges } from '@/lib/statCodeTemplates';
import { declarations, declaredNames, memberKey, parseCode, type EntryRef } from '@/lib/codeTreeNames';

export { declarations, declaredNames, memberKey, parseCode, type EntryRef };

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
  | { is: 'locationMap' }
  | { is: 'locationEntry'; key: string }
  | { is: 'clock'; path: 'clock' | 'clock.previous' }
  /** An array whose element shape is known. `path` is its exact dotted path where it has one, like `memories`. */
  | { is: 'array'; of: ArrayElement; path: string | null }
  /** One element of such an array. */
  | { is: 'element'; of: ArrayElement }
  /** An exact path the surface lists members for, like `Math` or `scene.location`. */
  | { is: 'listed'; path: string };

/** The element shapes an array can hold: a `memories` entry, an entity entry as `present` holds, or an exit. */
export type ArrayElement = 'memory' | 'entity' | 'exit';

export type CodeStatValue = Extract<CodeValue, { is: 'stat' }>;
type ArrayValue = Extract<CodeValue, { is: 'array' }>;

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
  /** A `locations` key, or the place a `location.move("<name>")` call names. */
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

/** The methods that hand back one element of an array. `filter` hands back another array. */
const PICK_ONE = new Set(['find', 'findLast', 'at', 'pop', 'shift']);

/** The methods that hand back an array of the same elements. */
const SAME_ARRAY = new Set(['filter', 'slice', 'reverse', 'sort', 'splice', 'toReversed', 'toSorted', 'toSpliced']);

/** A location's `present`, the entity entries standing there. */
const present = (path: string | null): CodeValue => ({ is: 'array', of: 'entity', path });

/** A location's list under `key`: `present` or `exits`, at `path` when it has one. */
const locationList = (key: string, path: string | null): CodeValue | null =>
  key === 'present' ? present(path) : key === 'exits' ? { is: 'array', of: 'exit', path } : null;

/** The methods whose callback takes an element as its first parameter. */
const ELEMENT_CALLBACK = new Set([
  'every', 'filter', 'find', 'findIndex', 'findLast', 'findLastIndex', 'flatMap', 'forEach', 'map', 'some', 'sort', 'toSorted',
]);

/** The method a call calls on an object, with that object, or null for any other call. */
function methodCall(call: SyntaxNode, code: string): { object: SyntaxNode; method: string } | null {
  const callee = call.firstChild;
  const property = callee?.name === 'MemberExpression' ? callee.getChild('PropertyName') : null;
  const object = callee?.firstChild;
  return property && object ? { object, method: code.slice(property.from, property.to) } : null;
}

/** The name a callback binds as its first parameter, or null for a pattern or no parameter. */
function firstParam(callback: SyntaxNode | undefined): SyntaxNode | null {
  if (callback?.name !== 'ArrowFunction' && callback?.name !== 'FunctionExpression') return null;
  const first = callback.getChild('ParamList')?.firstChild;
  const param = first?.name === '(' ? first.nextSibling : first;
  return param?.name === 'VariableDefinition' ? param : null;
}

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
        case 'locations': return { is: 'locationMap' };
        case 'clock': return { is: 'clock', path: 'clock' };
        case 'trait': return { is: 'switchedTrait' };
        case 'memories': return { is: 'array', of: 'memory', path: 'memories' };
      }
    }
    if (surface.members.has(name)) return { is: 'listed', path: name };
    if ((has('stats') || has('self')) && isStatLike(name)) return { is: 'stat', owner: null, key: null };
    const element = elementBindings()?.get(name);
    return element ? { is: 'element', of: element } : null;
  }

  // Null during the scan, so the scan never reads its own bindings.
  let bindings: Map<string, ArrayElement | null> | null | undefined;
  /** The names the code binds to one element of a known array: a callback's first parameter, or a for-of binding.
   *  A name bound to two element shapes, or declared anywhere else, binds neither. */
  function elementBindings(): Map<string, ArrayElement | null> | null {
    if (bindings !== undefined) return bindings;
    bindings = null;
    const found = new Map<string, ArrayElement | null>();
    const bound = new Set<number>();
    const bind = (binding: SyntaxNode | null | undefined, array: CodeValue | null) => {
      if (!binding || array?.is !== 'array') return;
      const name = code.slice(binding.from, binding.to);
      found.set(name, found.has(name) && found.get(name) !== array.of ? null : array.of);
      bound.add(binding.from);
    };
    const cursor = tree.cursor();
    do {
      if (cursor.type.name === 'CallExpression') {
        const call = methodCall(cursor.node, code);
        if (call && ELEMENT_CALLBACK.has(call.method)) {
          const args = cursor.node.getChild('ArgList');
          bind(firstParam(args ? collectArgs(args)[0] : undefined), valueOf(call.object));
        }
      } else if (cursor.type.name === 'ForOfSpec') {
        const of = cursor.node.getChild('of');
        const iterated = of?.nextSibling;
        if (iterated && iterated.name !== ')') bind(cursor.node.getChild('VariableDefinition'), valueOf(iterated));
      }
    } while (cursor.next());
    // The walk is whole-document, so a name the code also declares elsewhere is the author's own.
    const names = tree.cursor();
    do {
      const definition = names.type.name === 'VariableDefinition' ? names.node
        : names.type.name === 'PatternProperty' ? names.node.firstChild : null;
      if (definition && !bound.has(definition.from) && found.has(code.slice(definition.from, definition.to))) {
        found.set(code.slice(definition.from, definition.to), null);
      }
    } while (names.next());
    bindings = found;
    return bindings;
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
      case 'locationMap': return { is: 'locationEntry', key };
      case 'locationEntry': return locationList(key, null);
      case 'listed': return base.path === 'location' ? locationList(key, `location.${key}`) : null;
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
      const call = methodCall(node, code);
      if (!call) return null;
      if (SAME_ARRAY.has(call.method)) {
        const array = arrayOf(call.object);
        return array && { ...array, path: null };
      }
      if (!PICK_ONE.has(call.method)) return null;
      // `Object.values(stats).find(…)` picks one stat.
      const map = valuesOfStatMap(call.object);
      if (map) return { is: 'stat', owner: map.owner, key: null };
      const array = arrayOf(call.object);
      return array && { is: 'element', of: array.of };
    }
    if (node.name !== 'MemberExpression') return null;
    const object = node.firstChild;
    const key = memberKey(node, code);
    const bracket = !node.getChild('PropertyName');
    const iterated = bracket && object ? valuesOfStatMap(object) : null;
    if (iterated) return { is: 'stat', owner: iterated.owner, key: null };
    // An index picks one element: `memories[0]`, `memories[i]`.
    const array = node.getChild('[') && object ? arrayOf(object) : null;
    if (array && (key === null || /^\d+$/.test(key.name))) return { is: 'element', of: array.of };
    const base = object ? valueOf(object) : null;
    const stepped = base && stepValue(base, key?.name ?? null);
    if (stepped) return stepped;
    const path = dottedPath(node, code);
    return path !== null && surface.members.has(path) ? { is: 'listed', path } : null;
  }

  /** The array an expression is, or null where it is no array of known elements. */
  function arrayOf(node: SyntaxNode): ArrayValue | null {
    const value = valueOf(node);
    return value?.is === 'array' ? value : null;
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
      case 'locationMap': return { ...span, kind: 'location' };
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
