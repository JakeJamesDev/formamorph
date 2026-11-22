/**
 * The Opening names a script spells: a string literal compared with `opening.name`, and which owner the code
 * says that Opening belongs to. The rename planner and code analysis both read code through it.
 *
 * Only the plain forms count: `==`, `===`, `!=` or `!==` against a literal on either side, and a `case` of a
 * `switch (opening.name)`. A name held in a variable, or one an escape hides, is no key.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode } from '@lezer/common';
import type { Opening, Placeholder } from '@/types';
import { memberRenameKey, stringText, type CodeRenameKey } from './codeRenameChains';
import { statCodeName } from './statCodeNames';

/** What the code says about whose Opening a comparison means. */
export type OwnerGuard =
  | { kind: 'none' }
  /** The world's own Openings: `!opening.owner` or `opening.owner === null`. */
  | { kind: 'world' }
  /** `opening.owner.name === "<name>"`. */
  | { kind: 'owner'; name: string }
  /** The code tests `opening.owner` in a way the editor cannot read to an owner. */
  | { kind: 'unknown' };

/** One name literal compared with `opening.name`. */
export interface OpeningNameReference {
  /** The literal, as a key a rename rewrites. */
  key: CodeRenameKey;
  guard: OwnerGuard;
}

const EQUALITY = ['==', '===', '!=', '!=='];
const OWNER_EQUALITY = ['==', '==='];

const textOf = (node: SyntaxNode, code: string) => code.slice(node.from, node.to);

/** Whether `node` reads `opening.<member>`, through a dot, `?.` or a plain string key. */
function isOpeningMember(node: SyntaxNode | null, code: string, member: string): boolean {
  const object = node?.name === 'MemberExpression' ? node.firstChild : null;
  if (!node || object?.name !== 'VariableName' || textOf(object, code) !== 'opening') return false;
  return memberRenameKey(node, object, code)?.name === member;
}

/** Whether `node` reads `opening.owner.name`. */
function isOwnerName(node: SyntaxNode | null, code: string): boolean {
  const object = node?.name === 'MemberExpression' ? node.firstChild : null;
  return !!node && !!object && isOpeningMember(object, code, 'owner') && memberRenameKey(node, object, code)?.name === 'name';
}

/** The conjuncts of an `&&` chain, parentheses peeled; anything else is one conjunct. */
function conjuncts(node: SyntaxNode, code: string): SyntaxNode[] {
  if (node.name === 'ParenthesizedExpression') {
    const inner = node.firstChild?.nextSibling;
    return inner ? conjuncts(inner, code) : [];
  }
  const op = node.name === 'BinaryExpression' ? node.firstChild?.nextSibling : null;
  if (node.name === 'BinaryExpression' && op && textOf(op, code) === '&&' && node.firstChild && node.lastChild) {
    return [...conjuncts(node.firstChild, code), ...conjuncts(node.lastChild, code)];
  }
  return [node];
}

/** What one conjunct says about the owner, or null where it does not touch `opening.owner`. */
function ownerClaim(node: SyntaxNode, code: string): OwnerGuard | null {
  // A cheap text test first: only a conjunct that reads `opening.owner` can be a guard.
  if (!/\bopening\s*\??\.\s*owner\b|\bopening\s*\?*\.?\s*\[\s*['"]owner['"]\s*\]/.test(textOf(node, code))) return null;
  if (node.name === 'UnaryExpression' && node.firstChild && textOf(node.firstChild, code) === '!' && isOpeningMember(node.lastChild, code, 'owner')) {
    return { kind: 'world' };
  }
  const left = node.name === 'BinaryExpression' ? node.firstChild : null;
  const op = left?.nextSibling;
  const right = node.name === 'BinaryExpression' ? node.lastChild : null;
  if (!left || !op || !right || op.name !== 'CompareOp' || !OWNER_EQUALITY.includes(textOf(op, code))) return { kind: 'unknown' };
  for (const [side, other] of [[left, right], [right, left]] as const) {
    if (isOpeningMember(side, code, 'owner') && textOf(other, code) === 'null') return { kind: 'world' };
    const literal = isOwnerName(side, code) && other.name === 'String' ? stringText(other, code) : null;
    if (literal) return { kind: 'owner', name: literal.name };
  }
  return { kind: 'unknown' };
}

/** The guard the code puts on the comparison `at`: its own `&&` chain and the test of each `if` or `?:` it sits in. */
function guardOf(at: SyntaxNode, code: string): OwnerGuard {
  const tests: SyntaxNode[] = [];
  let child: SyntaxNode = at;
  for (let parent = at.parent; parent; child = parent, parent = parent.parent) {
    const op = parent.name === 'BinaryExpression' ? parent.firstChild?.nextSibling : null;
    if (op && textOf(op, code) === '&&') tests.push(parent);
    if (parent.name === 'IfStatement' && child.prevSibling?.name === 'ParenthesizedExpression') {
      const test = child.prevSibling;
      if (test) tests.push(test);
    }
    if (parent.name === 'ConditionalExpression' && child.prevSibling && textOf(child.prevSibling, code) === '?' && parent.firstChild) {
      tests.push(parent.firstChild);
    }
  }
  const claims = tests.flatMap((test) => conjuncts(test, code)).flatMap((node) => {
    const claim = ownerClaim(node, code);
    return claim ? [claim] : [];
  });
  return claims.find((claim) => claim.kind === 'owner') ?? claims.find((claim) => claim.kind === 'world')
    ?? claims.find((claim) => claim.kind === 'unknown') ?? { kind: 'none' };
}

/** The comparison a literal is one side of, when the other side is `opening.name`. */
function comparisonOf(literal: SyntaxNode, code: string): SyntaxNode | null {
  const parent = literal.parent;
  if (parent?.name === 'CaseLabel') {
    const statement = parent.parent?.parent;
    const subject = statement?.name === 'SwitchStatement' ? statement.getChild('ParenthesizedExpression')?.firstChild?.nextSibling : null;
    return statement && isOpeningMember(subject ?? null, code, 'name') ? statement : null;
  }
  if (parent?.name !== 'BinaryExpression') return null;
  const op = parent.firstChild?.nextSibling;
  if (!op || op.name !== 'CompareOp' || !EQUALITY.includes(textOf(op, code))) return null;
  const other = parent.firstChild?.from === literal.from ? parent.lastChild : parent.firstChild;
  return isOpeningMember(other, code, 'name') ? parent : null;
}

/** Every literal `code` compares with `opening.name`, in source order, each with the owner the code ties it to.
 *  Where the author declares an `opening` of their own none of its members is the sandbox's. */
export function openingNameReferences(code: string): OpeningNameReference[] {
  if (!code || !code.includes('opening')) return [];
  const found: OpeningNameReference[] = [];
  const cursor = javascriptLanguage.parser.parse(code).cursor();
  do {
    if (cursor.type.name === 'VariableDefinition' && textOf(cursor.node, code) === 'opening') return [];
    if (cursor.type.name !== 'String') continue;
    const comparison = comparisonOf(cursor.node, code);
    const text = comparison && stringText(cursor.node, code);
    if (!comparison || !text) continue;
    found.push({
      key: { name: text.name, keyFrom: cursor.from, keyTo: cursor.to, quote: text.quote, optional: false, objectTo: cursor.from, memberTo: cursor.to },
      guard: guardOf(comparison, code),
    });
  } while (cursor.next());
  return found;
}

/** Who owns the Opening a name field edits. */
export type OpeningOwnerRef = { kind: 'world' } | { kind: 'entity'; id: string } | { kind: 'location'; id: string };

/** Everyone who can own an Opening, as a rename reads them. */
export interface OpeningOwners {
  worldOpenings?: readonly Opening[];
  entities: readonly { id: string; name: string; openings?: readonly Opening[] }[];
  locations: readonly { id: string; name: string; openings?: readonly Opening[] }[];
}

/** The names the world's Openings carry, every owner and every Self row included. */
export const openingNamesOf = ({ worldOpenings, entities, locations }: OpeningOwners): string[] =>
  [worldOpenings, ...entities.map((e) => e.openings), ...locations.map((l) => l.openings)]
    .flatMap((openings) => openings ?? [])
    .flatMap((opening) => (opening.name?.trim() ? [opening.name.trim()] : []));

/** What an Opening rename of `from` owes other owners' code, or null where `owner` is not in the world. */
export function openingRenameScope(
  world: OpeningOwners, owner: OpeningOwnerRef, from: string, placeholders: readonly Placeholder[],
): { ownerNames: readonly string[] | null; shared: boolean } | null {
  const holds = (openings: readonly Opening[] | undefined) => (openings ?? []).some((opening) => opening.name?.trim() === from.trim());
  const entity = owner.kind === 'entity' ? world.entities.find((e) => e.id === owner.id) : undefined;
  const location = owner.kind === 'location' ? world.locations.find((l) => l.id === owner.id) : undefined;
  if (owner.kind === 'entity' ? !entity : owner.kind === 'location' && !location) return null;
  const named = entity ?? location;
  return {
    ownerNames: named ? [...new Set([named.name, statCodeName(named.name, placeholders)])] : null,
    shared: (owner.kind !== 'world' && holds(world.worldOpenings))
      || world.entities.some((e) => !(owner.kind === 'entity' && e.id === owner.id) && holds(e.openings))
      || world.locations.some((l) => !(owner.kind === 'location' && l.id === owner.id) && holds(l.openings)),
  };
}
