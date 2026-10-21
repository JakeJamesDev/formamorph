/** Names read straight off a script's syntax tree, apart from the resolver so a reader of them loads no surface. */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode, Tree } from '@lezer/common';

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
