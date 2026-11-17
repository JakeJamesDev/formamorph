/**
 * The member chains stat code hangs off a sandbox global, read from the code's syntax tree with each key's
 * place in the text. The rename planner and the route resolver both read code through it.
 *
 * Only the exact map-lookup forms count: a dot or a plain string key. A key an escape hides, or one only a
 * run could compute, ends the chain.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode } from '@lezer/common';
import { MEDIA_MEMBER_KIND } from './mediaOverrides';

/** Every global a chain can hang off. */
export type ChainRoot = 'stats' | 'placeholders' | 'traits' | 'owner' | 'entities' | 'persona' | 'dictionaries' | 'options';

/** One key of a member chain hanging off a map, and what it takes to rewrite that key alone. */
export interface CodeRenameKey {
  /** The name the key reads as. */
  name: string;
  /** The key's own text: the property name, or the string literal with its quotes. */
  keyFrom: number;
  keyTo: number;
  /** The quote the author used, or null for the dot form. */
  quote: string | null;
  /** Whether this step is reached through `?.`, which a rebuilt bracket form has to keep. */
  optional: boolean;
  /** Where the object this key hangs off ends: the map's own name for the first key, the chain so far
   *  after. What a bracket form replaces from. */
  objectTo: number;
  /** Where the member expression this key closes ends. */
  memberTo: number;
}

/** The key of one member step, or null where only a run could name it. */
export function memberRenameKey(member: SyntaxNode, object: SyntaxNode, code: string): CodeRenameKey | null {
  const optional = code.slice(object.to, member.to).trimStart().startsWith('?.');
  const span = { optional, objectTo: object.to, memberTo: member.to };
  const property = member.getChild('PropertyName');
  if (property) {
    const name = code.slice(property.from, property.to);
    return { name, keyFrom: property.from, keyTo: property.to, quote: null, ...span };
  }
  const literal = member.getChild('String');
  const text = literal && stringText(literal, code);
  return literal && text ? { name: text.name, keyFrom: literal.from, keyTo: literal.to, quote: text.quote, ...span } : null;
}

/** A plain string literal's name and quote, or null for one an escape hides: only a run could evaluate that, so the
 *  step cannot be proven to be this one. */
function stringText(literal: SyntaxNode, code: string): { name: string; quote: string } | null {
  if (literal.to - literal.from < 2) return null;
  const quote = code[literal.from];
  if (code[literal.to - 1] !== quote || (quote !== '"' && quote !== "'")) return null;
  const name = code.slice(literal.from + 1, literal.to - 1);
  return name.includes('\\') ? null : { name, quote };
}

/** Whether this member expression is the object of another, and so already covered by that longer chain. */
function isInnerMember(node: SyntaxNode): boolean {
  const object = node.parent?.name === 'MemberExpression' ? node.parent.firstChild : null;
  return !!object && object.from === node.from && object.to === node.to;
}

/** The keys of one chain off `root`, outermost first, cut short at the first key a run would name. */
function chainAt(node: SyntaxNode, code: string, root: ChainRoot): CodeRenameKey[] | null {
  const members: SyntaxNode[] = [];
  let at: SyntaxNode | null = node;
  while (at?.name === 'MemberExpression') {
    members.unshift(at);
    at = at.firstChild;
  }
  if (at?.name !== 'VariableName' || code.slice(at.from, at.to) !== root) return null;
  const keys: CodeRenameKey[] = [];
  for (const member of members) {
    const object = member.firstChild;
    const key = object && memberRenameKey(member, object, code);
    // Nothing below an unreadable key can be resolved either, so the chain ends here.
    if (!key) break;
    keys.push(key);
  }
  return keys;
}

/**
 * Every member chain off `root` in `code`, in source order.
 *
 * One parse per root. Where the author declares a name of their own over the global, none of its members is
 * the sandbox's, so the code yields no chains.
 */
export function codeRenameChains(code: string, root: ChainRoot): CodeRenameKey[][] {
  if (!code || !code.includes(root)) return [];
  const found: CodeRenameKey[][] = [];
  const cursor = javascriptLanguage.parser.parse(code).cursor();
  do {
    if (cursor.type.name === 'VariableDefinition' && code.slice(cursor.from, cursor.to) === root) return [];
    if (cursor.type.name !== 'MemberExpression' || isInnerMember(cursor.node)) continue;
    const chain = chainAt(cursor.node, code, root);
    if (chain?.length) found.push(chain);
  } while (cursor.next());
  return found;
}

/** The globals a media member hangs off. A local variable's `image` is nothing the sandbox owns. */
const MEDIA_ROOTS: ReadonlySet<string> = new Set(['entities', 'persona', 'owner', 'locations', 'location', 'world', 'items']);

/** Entry members whose own entries are no media owner, so a `sound` or `image` key under one is no media member. */
const NOT_MEDIA_PATHS: ReadonlySet<string> = new Set(['stats', 'traits', 'placeholders', 'memories', 'dictionaries']);

/** The global a media member's chain starts at, or null where `node` is no media member of one. */
function mediaMemberRoot(node: SyntaxNode | null, code: string): string | null {
  if (node?.name !== 'MemberExpression') return null;
  const object = node.firstChild;
  const key = object && memberRenameKey(node, object, code);
  if (!key || !Object.hasOwn(MEDIA_MEMBER_KIND, key.name)) return null;
  let at: SyntaxNode | null = object;
  while (at?.name === 'MemberExpression') {
    const step = at.firstChild && memberRenameKey(at, at.firstChild, code);
    if (step && NOT_MEDIA_PATHS.has(step.name)) return null;
    at = at.firstChild;
  }
  return at?.name === 'VariableName' ? code.slice(at.from, at.to) : null;
}

/** The media member a plain string literal is assigned to or compared with, as the root it hangs off. */
function mediaLiteralRoot(literal: SyntaxNode, code: string): string | null {
  const parent = literal.parent;
  const before = literal.prevSibling;
  const after = literal.nextSibling;
  if (parent?.name === 'AssignmentExpression') {
    const op = before && code.slice(before.from, before.to);
    return op === '=' || op === '??=' ? mediaMemberRoot(parent.firstChild, code) : null;
  }
  if (parent?.name !== 'BinaryExpression') return null;
  const isEquality = (op: SyntaxNode | null) => !!op && op.name === 'CompareOp' && ['==', '===', '!=', '!=='].includes(code.slice(op.from, op.to));
  if (isEquality(after)) return mediaMemberRoot(after?.nextSibling ?? null, code);
  return isEquality(before) ? mediaMemberRoot(before?.prevSibling ?? null, code) : null;
}

/**
 * Every Media Entry name a script spells as a literal: assigned to a media member (`entities.X.image = "Name"`)
 * or compared with one on either side of `==`, `===`, `!=` or `!==`. A computed name, a template string, and a
 * literal beside a member of the author's own variable are no key.
 */
export function mediaNameKeys(code: string): CodeRenameKey[] {
  if (!code) return [];
  const found: { root: string; key: CodeRenameKey }[] = [];
  const shadowed = new Set<string>();
  const cursor = javascriptLanguage.parser.parse(code).cursor();
  do {
    if (cursor.type.name === 'VariableDefinition') shadowed.add(code.slice(cursor.from, cursor.to));
    if (cursor.type.name !== 'String') continue;
    const root = mediaLiteralRoot(cursor.node, code);
    const text = root && stringText(cursor.node, code);
    if (root && text) {
      found.push({
        root, key: { name: text.name, keyFrom: cursor.from, keyTo: cursor.to, quote: text.quote, optional: false, objectTo: cursor.from, memberTo: cursor.to },
      });
    }
  } while (cursor.next());
  return found.filter(({ root }) => MEDIA_ROOTS.has(root) && !shadowed.has(root)).map(({ key }) => key);
}

/** The place `location.move("<name>")` names when `literal` is its first argument, as a key to rewrite. */
export function locationMoveKey(literal: SyntaxNode, code: string): CodeRenameKey | null {
  const args = literal.parent;
  const call = args?.name === 'ArgList' ? args.parent : null;
  const callee = call?.name === 'CallExpression' ? call.firstChild : null;
  const object = callee?.name === 'MemberExpression' ? callee.firstChild : null;
  const method = callee?.getChild('PropertyName');
  if (!args || object?.name !== 'VariableName' || code.slice(object.from, object.to) !== 'location') return null;
  // The first argument follows the `(`. Nodes are made per read, so the match is by place.
  if (!method || code.slice(method.from, method.to) !== 'move' || args.firstChild?.nextSibling?.from !== literal.from) return null;
  const text = stringText(literal, code);
  return text && { name: text.name, keyFrom: literal.from, keyTo: literal.to, quote: text.quote, optional: false, objectTo: literal.from, memberTo: literal.to };
}

/** Every place named by a `location.move("<name>")` call in `code`, in source order. A computed name is no key, and
 *  where the author declares a `location` of their own none of its calls is the sandbox's. */
export function locationMoveKeys(code: string): CodeRenameKey[] {
  if (!code.includes('location')) return [];
  const found: CodeRenameKey[] = [];
  const cursor = javascriptLanguage.parser.parse(code).cursor();
  do {
    if (cursor.type.name === 'VariableDefinition' && code.slice(cursor.from, cursor.to) === 'location') return [];
    if (cursor.type.name !== 'String') continue;
    const key = locationMoveKey(cursor.node, code);
    if (key) found.push(key);
  } while (cursor.next());
  return found;
}
