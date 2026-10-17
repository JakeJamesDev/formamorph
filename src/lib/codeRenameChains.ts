/**
 * The member chains stat code hangs off a sandbox global, read from the code's syntax tree with each key's
 * place in the text. The rename planner and the route resolver both read code through it.
 *
 * Only the exact map-lookup forms count: a dot or a plain string key. A key an escape hides, or one only a
 * run could compute, ends the chain.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode } from '@lezer/common';

/** Every global a chain can hang off. */
export type ChainRoot = 'stats' | 'placeholders' | 'traits' | 'owner' | 'entities' | 'persona' | 'dictionaries';

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
