/**
 * What a rename owes the stat code that already names the thing.
 *
 * The maps the sandbox injects are keyed by name, so a stat, placeholder, or trait that gets a new name
 * leaves every `stats.Health`, `placeholders['Mood']`, or `traits.Brave` in the world pointing at nothing.
 * These functions find those references and rewrite them. They are pure over the code text, so the editor's
 * offer, its tests, and anything later that wants the same rewrite all read one implementation.
 *
 * Only the exact map-lookup forms are touched: a dot or a plain string key hanging off the map's own name.
 * A comparison against the name, a key an escape hides, and a key only a run could compute are all left
 * alone, because rewriting them would need judgment the Test Bench is the net for.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode } from '@lezer/common';
import type { Stat } from '@/types';

/** The name-keyed maps a rename can reach. */
export type RenameRoot = 'stats' | 'placeholders' | 'traits';

/** One `root.Name` or `root["Name"]` reference, and what it takes to rewrite it. */
export interface CodeRenameReference {
  /** The whole member expression, `stats.Health` included. */
  from: number;
  to: number;
  /** The key alone: the property name, or the string literal with its quotes. */
  keyFrom: number;
  keyTo: number;
  /** The quote the author used, or null for the dot form. */
  quote: string | null;
  /** Whether the map is reached through `?.`, which a rebuilt bracket form has to keep. */
  optional: boolean;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The key of a `root.Name` or `root["Name"]` member, or null for any other member and for a key only a run
 *  could name. */
function referenceAt(node: SyntaxNode, code: string, root: RenameRoot, name: string): CodeRenameReference | null {
  const object = node.firstChild;
  if (object?.name !== 'VariableName' || code.slice(object.from, object.to) !== root) return null;
  const optional = code.slice(object.to, node.to).trimStart().startsWith('?.');
  const property = node.getChild('PropertyName');
  if (property) {
    if (code.slice(property.from, property.to) !== name) return null;
    return { from: node.from, to: node.to, keyFrom: property.from, keyTo: property.to, quote: null, optional };
  }
  const literal = node.getChild('String');
  if (!literal || literal.to - literal.from < 2) return null;
  const quote = code[literal.from];
  if (code[literal.to - 1] !== quote || (quote !== '"' && quote !== "'")) return null;
  const key = code.slice(literal.from + 1, literal.to - 1);
  // An escape has to be evaluated to name the key, so the reference cannot be proven to be this one.
  if (key.includes('\\') || key !== name) return null;
  return { from: node.from, to: node.to, keyFrom: literal.from, keyTo: literal.to, quote, optional };
}

/**
 * Every exact map-lookup of `name` under `root`, in source order.
 *
 * One parse answers both questions the walk asks: whether the author declared a name of their own over the
 * map — in which case none of these members is the sandbox's map and the whole code is left alone — and
 * where each reference sits.
 */
export function codeRenameReferences(code: string, root: RenameRoot, name: string): CodeRenameReference[] {
  if (!code || !name || !code.includes(root)) return [];
  const found: CodeRenameReference[] = [];
  const cursor = javascriptLanguage.parser.parse(code).cursor();
  do {
    if (cursor.type.name === 'VariableDefinition' && code.slice(cursor.from, cursor.to) === root) return [];
    if (cursor.type.name !== 'MemberExpression') continue;
    const reference = referenceAt(cursor.node, code, root, name);
    if (reference) found.push(reference);
  } while (cursor.next());
  return found;
}

/** `name` inside `quote`, with that quote and any backslash escaped. */
const quoted = (name: string, quote: string) =>
  `${quote}${name.replace(/\\/g, '\\\\').replace(new RegExp(quote, 'g'), `\\${quote}`)}${quote}`;

/** The text that replaces one reference: the key alone where the form survives, the whole member expression
 *  where a dot form has to become a bracket to hold a name no identifier can spell. */
function rewritten(reference: CodeRenameReference, code: string, root: RenameRoot, newName: string) {
  if (reference.quote) {
    return { from: reference.keyFrom, to: reference.keyTo, insert: quoted(newName, reference.quote) };
  }
  if (IDENTIFIER.test(newName)) return { from: reference.keyFrom, to: reference.keyTo, insert: newName };
  const bracket = `${reference.optional ? '?.' : ''}[${quoted(newName, "'")}]`;
  return { from: reference.from + root.length, to: reference.to, insert: bracket };
}

/** `code` with `found` — its own references, already scanned — renamed to `newName`. */
function applyRename(code: string, root: RenameRoot, found: readonly CodeRenameReference[], newName: string): string {
  return found
    .map((reference) => rewritten(reference, code, root, newName))
    .sort((a, b) => b.from - a.from)
    .reduce((out, splice) => out.slice(0, splice.from) + splice.insert + out.slice(splice.to), code);
}

/** `code` with every exact map-lookup of `oldName` under `root` renamed to `newName`. Everything else stays
 *  byte for byte, so a second run changes nothing. */
export function renameCodeReferences(code: string, root: RenameRoot, oldName: string, newName: string): string {
  return applyRename(code, root, codeRenameReferences(code, root, oldName), newName);
}

/** The item kinds a find-and-replace can rename, keyed by the prefix their search targets carry. Groups are
 *  absent on purpose: a trait group and a placeholder folder are not entries of any map code reads. */
const TARGET_ROOTS: Record<string, RenameRoot> = { stat: 'stats', trait: 'traits', placeholder: 'placeholders' };

/** The map a replaced search target belongs to, or null where the replace is not a rename. */
export function renameRootForTarget(itemKey: string, fieldKey: string): RenameRoot | null {
  if (fieldKey !== 'name') return null;
  return TARGET_ROOTS[itemKey.slice(0, itemKey.indexOf(':'))] ?? null;
}

/** One stat's code, rewritten. */
export interface CodeRenameEdit {
  id: string;
  /** The stat's own name, so the offer can say whose code it is about. */
  name: string;
  code: string;
}

/** What a rename would do to the world's stat code. */
export interface CodeRenamePlan {
  root: RenameRoot;
  oldName: string;
  newName: string;
  /** The stats whose code changes, in authored order. */
  edits: CodeRenameEdit[];
  /** How many references the rewrite covers. */
  references: number;
}

export interface CodeRenameInput {
  root: RenameRoot;
  /** The name as code read it before the edit. For a stat this is its code name. */
  oldName: string;
  newName: string;
  /** Every stat in the world, for the code they hold. */
  stats: readonly Stat[];
  /** The names the other entries of this kind carry. A rename onto one of them is a duplicate, which the
   *  duplicate-name warning already covers, so it gets no offer. */
  otherNames: readonly string[];
}

/**
 * The rewrite a committed rename should offer, or null where there is nothing to offer: an unchanged or
 * blank name, a name another entry of the same kind already carries, or a name no stat's code references.
 */
export function planCodeRename({ root, oldName, newName, stats, otherNames }: CodeRenameInput): CodeRenamePlan | null {
  const from = oldName.trim();
  const to = newName.trim();
  // Trimmed on both sides of the comparison: the field's text is what an author typed, and a name that
  // differs from another only by its spaces is the duplicate the warning already covers.
  if (!from || !to || from === to || otherNames.some((name) => name.trim() === to)) return null;
  const edits: CodeRenameEdit[] = [];
  let references = 0;
  for (const stat of stats) {
    const code = stat.code ?? '';
    // Scanned once and reused for both the count and the rewrite: this runs over every stat's code on each
    // render the offer is open, and each scan is a full parse.
    const found = codeRenameReferences(code, root, from);
    if (!found.length) continue;
    references += found.length;
    edits.push({ id: stat.id, name: stat.name, code: applyRename(code, root, found, to) });
  }
  return references ? { root, oldName: from, newName: to, edits, references } : null;
}
