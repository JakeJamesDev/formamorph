import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode } from '@lezer/common';

interface Edit {
  from: number;
  to: number;
  insert: string;
}

/** A lookup the rewrite recognizes: by name against a string literal, or by id against `currentStatId`. */
type Lookup = { by: 'name'; literal: string } | { by: 'id' };

/** Statement lists a deleted declaration can leave without breaking the syntax around it. */
const STATEMENT_LISTS = new Set(['Script', 'Block', 'SwitchBody']);

function children(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) out.push(child);
  return out;
}

const shape = (nodes: readonly SyntaxNode[]) => nodes.map((node) => node.name).join(' ');

/**
 * The lookup a call spells, when it is exactly `stats.find(p => p.name === '…')` or
 * `stats.find(p => p.id === currentStatId)` with any whitespace, parameter name, or `==`. Exact child
 * shapes at every level, so a comment, an error node, or any extra term leaves the call alone.
 */
function matchLookup(call: SyntaxNode, code: string): Lookup | null {
  const text = (node: SyntaxNode) => code.slice(node.from, node.to);
  const parts = children(call);
  if (shape(parts) !== 'MemberExpression ArgList') return null;
  const [callee, args] = parts;
  const member = children(callee);
  if (shape(member) !== 'VariableName . PropertyName' || text(member[0]) !== 'stats' || text(member[2]) !== 'find') {
    return null;
  }
  const argList = children(args);
  if (shape(argList) !== '( ArrowFunction )') return null;
  const arrow = children(argList[1]);
  if (shape(arrow) !== 'ParamList Arrow BinaryExpression') return null;
  const params = children(arrow[0]);
  const param = params.find((node) => node.name === 'VariableDefinition');
  if (!param || !['VariableDefinition', '( VariableDefinition )'].includes(shape(params))) return null;
  const compare = children(arrow[2]);
  if (!/^MemberExpression CompareOp (String|VariableName)$/.test(shape(compare))) return null;
  const [left, op, right] = compare;
  if (text(op) !== '===' && text(op) !== '==') return null;
  const field = children(left);
  if (shape(field) !== 'VariableName . PropertyName' || text(field[0]) !== text(param)) return null;
  if (text(field[2]) === 'name' && right.name === 'String') return { by: 'name', literal: text(right) };
  if (text(field[2]) === 'id' && text(right) === 'currentStatId') return { by: 'id' };
  return null;
}

/** Delete a statement, taking its line with it when nothing else shares the line. */
function deleteStatement(from: number, to: number, code: string): Edit {
  const isBlank = (ch: string | undefined) => ch === ' ' || ch === '\t';
  let start = from;
  while (isBlank(code[start - 1])) start -= 1;
  let end = to;
  while (isBlank(code[end])) end += 1;
  const lineBreak = code.startsWith('\r\n', end) ? 2 : code[end] === '\n' ? 1 : 0;
  const endsLine = lineBreak > 0 || end === code.length;
  if (!endsLine) return { from, to: end, insert: '' };
  if (start > 0 && code[start - 1] !== '\n') return { from: start, to, insert: '' };
  if (lineBreak > 0) return { from: start, to: end + lineBreak, insert: '' };
  // The last line: the break before it goes instead, so no blank line trails the code.
  const before = code.startsWith('\r\n', start - 2) ? 2 : start > 0 ? 1 : 0;
  return { from: start - before, to: end, insert: '' };
}

/**
 * The edit that removes `self = <lookup>` from its declaration, since the sandbox already declares `self`
 * and the rewritten `const self = self;` would read `self` before its own initialization. Null when the
 * declarator is not named `self` or the declaration cannot go without breaking the code around it.
 */
function dropSelfDeclarator(call: SyntaxNode, code: string): Edit | null {
  const declaration = call.parent;
  const equals = call.prevSibling;
  const name = equals?.prevSibling;
  if (declaration?.name !== 'VariableDeclaration' || equals?.name !== 'Equals' || name?.name !== 'VariableDefinition') {
    return null;
  }
  if (code.slice(name.from, name.to) !== 'self' || !STATEMENT_LISTS.has(declaration.parent?.name ?? '')) return null;
  const after = call.nextSibling;
  if (after?.name === ',' && after.nextSibling) return { from: name.from, to: after.nextSibling.from, insert: '' };
  const comma = name.prevSibling;
  if (comma?.name === ',' && comma.prevSibling) return { from: comma.prevSibling.to, to: call.to, insert: '' };
  return deleteStatement(declaration.from, declaration.to, code);
}

/**
 * Rewrite the two `stats` lookups the templates and the guide once taught to the map form:
 * `stats.find(s => s.name === 'X')` becomes `stats['X']` with the author's quotes, and
 * `stats.find(s => s.id === currentStatId)` becomes `self`. A declaration of `self` from the second is
 * dropped whole; any other name keeps the alias. Everything else is left byte for byte, so a second run
 * changes nothing.
 */
export function migrateStatLookups(code: string): string {
  if (!code.includes('find')) return code;
  const edits: Edit[] = [];
  javascriptLanguage.parser.parse(code).iterate({
    enter: (ref) => {
      if (ref.name !== 'CallExpression') return true;
      const lookup = matchLookup(ref.node, code);
      if (!lookup) return true;
      edits.push(lookup.by === 'name'
        ? { from: ref.from, to: ref.to, insert: `stats[${lookup.literal}]` }
        : dropSelfDeclarator(ref.node, code) ?? { from: ref.from, to: ref.to, insert: 'self' });
      return false;
    },
  });
  return edits
    .sort((a, b) => b.from - a.from)
    .reduce((out, edit) => out.slice(0, edit.from) + edit.insert + out.slice(edit.to), code);
}
