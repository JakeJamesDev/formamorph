/**
 * What a rename owes the stat code that already names the thing.
 *
 * The maps the sandbox injects are keyed by name, so a stat, placeholder, or trait that gets a new name
 * leaves every `stats.Health`, `placeholders['Mood']`, or `traits.Brave` in the world pointing at nothing.
 * A placeholder reaches further still: it names the code name of every stat and trait whose own name
 * carries it as a chip, and it is a step of every `placeholders` path that passes through it. These
 * functions find all of that and rewrite it, pure over the code text, so the editor's offer, its tests, and
 * anything later that wants the same rewrite all read one implementation.
 *
 * Only the exact map-lookup forms are touched: a dot or a plain string key hanging off the map's own name.
 * A comparison against the name, a key an escape hides, and a key only a run could compute are all left
 * alone, because rewriting them would need judgment the Test Bench is the net for.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode } from '@lezer/common';
import type { Placeholder, Stat } from '@/types';
import type { PlaceholderOwners } from './placeholderHomes';
import {
  placeholderPathMap, walkPlaceholderPath,
  type PlaceholderPathMap, type PlaceholderPathNode, type PlaceholderPathSource,
} from './statCodePaths';
import { statCodeName } from './statCodeNames';

/** The name-keyed maps a rename can reach. */
export type RenameRoot = 'stats' | 'placeholders' | 'traits';

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

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The key of one member step, or null where only a run could name it. */
function keyOf(member: SyntaxNode, object: SyntaxNode, code: string): CodeRenameKey | null {
  const optional = code.slice(object.to, member.to).trimStart().startsWith('?.');
  const span = { optional, objectTo: object.to, memberTo: member.to };
  const property = member.getChild('PropertyName');
  if (property) {
    const name = code.slice(property.from, property.to);
    return { name, keyFrom: property.from, keyTo: property.to, quote: null, ...span };
  }
  const literal = member.getChild('String');
  if (!literal || literal.to - literal.from < 2) return null;
  const quote = code[literal.from];
  if (code[literal.to - 1] !== quote || (quote !== '"' && quote !== "'")) return null;
  const name = code.slice(literal.from + 1, literal.to - 1);
  // An escape has to be evaluated to name the key, so the step cannot be proven to be this one.
  if (name.includes('\\')) return null;
  return { name, keyFrom: literal.from, keyTo: literal.to, quote, ...span };
}

/** Whether this member expression is the object of another, and so already covered by that longer chain. */
function isInnerMember(node: SyntaxNode): boolean {
  const object = node.parent?.name === 'MemberExpression' ? node.parent.firstChild : null;
  return !!object && object.from === node.from && object.to === node.to;
}

/** The keys of one chain off `root`, outermost first, cut short at the first key a run would name. */
function chainAt(node: SyntaxNode, code: string, root: RenameRoot): CodeRenameKey[] | null {
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
    const key = object && keyOf(member, object, code);
    // Nothing below an unreadable key can be resolved either, so the chain ends here.
    if (!key) break;
    keys.push(key);
  }
  return keys;
}

/**
 * Every member chain off `root` in `code`, in source order.
 *
 * The one scanner, and one parse per root however many names a rename moves. It answers both questions the
 * walk asks: whether the author declared a name of their own over the map — in which case none of these
 * members is the sandbox's map and the whole code is left alone — and where each key of each chain sits.
 */
export function codeRenameChains(code: string, root: RenameRoot): CodeRenameKey[][] {
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

/** Every exact map-lookup of `name` under `root`: the first key of each chain that reads as it. */
export const codeRenameReferences = (code: string, root: RenameRoot, name: string): CodeRenameKey[] =>
  codeRenameChains(code, root).map((chain) => chain[0]).filter((key) => key.name === name);

/** `name` inside `quote`, with that quote and any backslash escaped. */
const quoted = (name: string, quote: string) =>
  `${quote}${name.replace(/\\/g, '\\\\').replace(new RegExp(quote, 'g'), `\\${quote}`)}${quote}`;

/** One stretch of code and what replaces it. */
interface CodeSplice {
  from: number;
  to: number;
  insert: string;
}

/** `code` with every splice applied. Back to front, so an earlier splice keeps a later one's offsets. */
const spliced = (code: string, edits: readonly CodeSplice[]): string =>
  [...edits]
    .sort((a, b) => b.from - a.from)
    .reduce((out, edit) => out.slice(0, edit.from) + edit.insert + out.slice(edit.to), code);

/** What one key becomes: the key alone where the author's form survives, the whole member expression where
 *  a dot form has to become a bracket to hold a name no identifier can spell. */
function rewrittenKey(key: CodeRenameKey, newName: string): CodeSplice {
  if (key.quote) return { from: key.keyFrom, to: key.keyTo, insert: quoted(newName, key.quote) };
  if (IDENTIFIER.test(newName)) return { from: key.keyFrom, to: key.keyTo, insert: newName };
  return { from: key.objectTo, to: key.memberTo, insert: `${key.optional ? '?.' : ''}[${quoted(newName, "'")}]` };
}

/** `code` with every exact map-lookup of `oldName` under `root` renamed to `newName`. Everything else stays
 *  byte for byte, so a second run changes nothing. */
export const renameCodeReferences = (code: string, root: RenameRoot, oldName: string, newName: string): string =>
  spliced(code, codeRenameReferences(code, root, oldName).map((key) => rewrittenKey(key, newName)));

/** What identifies one node of the map across two readings of the tree. */
const nodeKey = (node: PlaceholderPathNode) => (node.placeholder ? `p:${node.placeholder.id}` : `o:${node.owner?.id}`);

/** The new key each node takes, by `nodeKey`, for the nodes a rename moves. */
type PathRenames = ReadonlyMap<string, string>;

/** The new name each old one takes under one root, for the code names a rename moves. */
type NameRenames = ReadonlyMap<string, string>;

/**
 * The keys of one chain that a rename moves, resolved against the map as it read before the edit.
 *
 * Resolution rather than name matching is what keeps a rename of Molly's `Hair` off a world-level
 * `placeholders.Hair`, and what carries it onto the bare-name fallback where the world has no `Hair` of its
 * own. More than one key can move at once: an owner named through a chip is renamed by the same edit that
 * renames the placeholder behind the chip. Each prefix goes through the one walk, so a key that lost to a
 * member of its holder is left alone here exactly as it is everywhere else.
 */
function pathSplices(map: PlaceholderPathMap, chain: readonly CodeRenameKey[], renames: PathRenames): CodeSplice[] {
  const edits: CodeSplice[] = [];
  const segments = chain.map((key) => key.name);
  for (let at = 0; at < chain.length; at += 1) {
    const { node, rest } = walkPlaceholderPath(map, segments.slice(0, at + 1));
    if (rest.length || !node) break;
    const moved = renames.get(nodeKey(node));
    if (moved !== undefined) edits.push(rewrittenKey(chain[at], moved));
  }
  return edits;
}

/** Every rewrite one rename asks of a stat's code, as the splices each root contributes. */
interface CodeRewrite {
  /** The map a rename walks as a tree, and the nodes it moves there. Absent where nothing moves. */
  paths?: { map: PlaceholderPathMap; renames: PathRenames };
  /** The bare-name lookups that move, per root. */
  names: ReadonlyMap<RenameRoot, NameRenames>;
}

/**
 * `code` rewritten, and how many keys that took.
 *
 * Every splice is measured against `code` as it stands and applied in one pass, so a rename whose new name
 * is another's old name cannot rewrite its own output — `stats.Beast` becoming `stats.BeastLord` beside a
 * separate `BeastLord` that is itself moving.
 */
function rewriteCode(code: string, rewrite: CodeRewrite): { code: string; references: number } {
  const edits: CodeSplice[] = [];
  if (rewrite.paths) {
    const { map, renames } = rewrite.paths;
    for (const chain of codeRenameChains(code, 'placeholders')) edits.push(...pathSplices(map, chain, renames));
  }
  for (const [root, moved] of rewrite.names) {
    for (const chain of codeRenameChains(code, root)) {
      const to = moved.get(chain[0].name);
      if (to !== undefined) edits.push(rewrittenKey(chain[0], to));
    }
  }
  return { code: edits.length ? spliced(code, edits) : code, references: edits.length };
}

/**
 * The item kinds a find-and-replace can rename, keyed by the prefix their search targets carry.
 *
 * An entity and a book are here because each owns placeholders, and so opens a path. Groups are absent on
 * purpose: a trait group and a placeholder folder are not entries of any map code reads.
 */
const TARGET_ROOTS: Record<string, { root: RenameRoot; kind?: CodeRenameSubject['kind'] }> = {
  stat: { root: 'stats' },
  trait: { root: 'traits' },
  placeholder: { root: 'placeholders', kind: 'placeholder' },
  entity: { root: 'placeholders', kind: 'entity' },
  // `book` is what a search target calls a dictionary; `dictionary` is what the editor's tab calls it, and
  // so what the offer says. The two spellings meet here.
  book: { root: 'placeholders', kind: 'dictionary' },
};

/** What a replaced search target renames: its map, and the tree node it moves. Null where the replace is
 *  not a rename. */
export function codeRenameTarget(
  itemKey: string, fieldKey: string,
): { root: RenameRoot; subject?: CodeRenameSubject } | null {
  if (fieldKey !== 'name') return null;
  const at = itemKey.indexOf(':');
  const target = TARGET_ROOTS[itemKey.slice(0, at)];
  if (!target) return null;
  return target.kind
    ? { root: target.root, subject: { kind: target.kind, id: itemKey.slice(at + 1) } }
    : { root: target.root };
}

/** Whether a subject is the entity or book that owns placeholders, rather than an entry of its own. */
export const isOwnerSubject = (subject?: CodeRenameSubject): boolean =>
  subject?.kind === 'entity' || subject?.kind === 'dictionary';

/**
 * How code reads the name a rename moved, so the rename is compared the way a lookup is.
 *
 * A stat, a trait, and the entity or book that owns placeholders can all carry chips in their names, and
 * code reaches each by the code name those derive. A placeholder's own name never carries a chip, so it
 * alone reads as written. One producer, because a kind left out of the branch drops the offer silently
 * rather than failing.
 */
export const codeNameReader = (
  target: { root: RenameRoot; subject?: CodeRenameSubject },
  placeholders: readonly Placeholder[],
): ((name: string) => string) =>
  (target.root === 'placeholders' && !isOwnerSubject(target.subject)
    ? (name) => name
    : (name) => statCodeName(name, placeholders));

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
  /** What was renamed, where the rename moved a node of the placeholder tree. The offer names it. */
  subject?: CodeRenameSubject;
  oldName: string;
  newName: string;
  /** The stats whose code changes, in authored order. */
  edits: CodeRenameEdit[];
  /** How many keys the rewrite covers. */
  references: number;
}

/** Which node of the placeholder tree a rename moved: an entry, or the entity or book that owns entries. */
export interface CodeRenameSubject {
  kind: 'placeholder' | 'entity' | 'dictionary';
  id: string;
}

export interface CodeRenameInput {
  root: RenameRoot;
  /** The name as code read it before the edit. For a stat this is its code name. */
  oldName: string;
  newName: string;
  /** Every stat in the world, for the code they hold. */
  stats: readonly Stat[];
  /** Every trait in the world. A placeholder rename moves the code name of a trait whose name carries it. */
  traits?: readonly { name: string }[];
  /** The names the other entries of this kind carry. A rename onto one of them is a duplicate, which the
   *  duplicate-name warning already covers, so it gets no offer. */
  otherNames: readonly string[];
  /** The world's placeholder tree. With `subject`, the rename follows paths rather than bare names. */
  placeholders?: PlaceholderPathSource;
  subject?: CodeRenameSubject;
}

/** `owners` with every reference to one owner renamed. */
const ownersRenaming = (owners: PlaceholderOwners | undefined, id: string, name: string) =>
  (owners && new Map([...owners].map(([key, ref]) => [key, ref.id === id ? { ...ref, name } : ref])));

/**
 * The tree as it reads with the subject carrying one name.
 *
 * The list is always a fresh array, even where nothing about it changes. `placeholderPathMap` caches on the
 * list's identity, so handing it the world's own array under fabricated owners would evict the map every
 * other surface in the editor is reading.
 */
const sourceNaming = (source: PlaceholderPathSource, subject: CodeRenameSubject, name: string): PlaceholderPathSource =>
  (isOwnerSubject(subject)
    ? { list: [...source.list], owners: ownersRenaming(source.owners, subject.id, name) }
    : { list: source.list.map((entry) => (entry.id === subject.id ? { ...entry, name } : entry)), owners: source.owners });

/**
 * The nodes whose key a rename moves, by `nodeKey`.
 *
 * A placeholder's node takes its authored name, so only the subject's own moves. An owner node takes its
 * owner's code name, which the same edit can move twice over: once where the owner is the subject, and once
 * where the owner's name carries the renamed placeholder as a chip.
 */
function movedNodes(
  before: PlaceholderPathSource, after: PlaceholderPathSource, subject: CodeRenameSubject, newName: string,
): PathRenames {
  const moved = new Map<string, string>();
  if (!isOwnerSubject(subject)) moved.set(`p:${subject.id}`, newName);
  const seen = new Set<string>();
  for (const [held, was] of before.owners ?? []) {
    const now = after.owners?.get(held);
    if (!now || seen.has(was.id)) continue;
    seen.add(was.id);
    const to = statCodeName(now.name, after.list);
    if (statCodeName(was.name, before.list) !== to) moved.set(`o:${was.id}`, to);
  }
  return moved;
}

/** The code names one list of entries takes before and after, for the names that move. */
function movedNames(
  entries: readonly { name: string }[], before: PlaceholderPathSource, after: PlaceholderPathSource,
): NameRenames {
  const moved = new Map<string, string>();
  for (const entry of entries) {
    const from = statCodeName(entry.name, before.list);
    const to = statCodeName(entry.name, after.list);
    // A name already claimed keeps its first answer: two entries whose chipped names read alike are one key.
    if (from && to && from !== to && !moved.has(from)) moved.set(from, to);
  }
  return moved;
}

/**
 * Every rewrite a rename of one tree node asks for.
 *
 * The tree is read twice, once with the subject's old name and once with its new one. A node whose key
 * differs between the two readings is one every path through it has to follow. The same two readings answer
 * the derived code names: a stat or a trait named through the renamed chip is keyed by a name that moves
 * with it.
 */
function treeRewrite(
  source: PlaceholderPathSource,
  subject: CodeRenameSubject,
  oldName: string,
  newName: string,
  stats: readonly { name: string }[],
  traits: readonly { name: string }[],
): CodeRewrite {
  const before = sourceNaming(source, subject, oldName);
  const after = sourceNaming(source, subject, newName);
  const renames = movedNodes(before, after, subject, newName);
  const names = new Map<RenameRoot, NameRenames>();
  for (const [root, entries] of [['stats', stats], ['traits', traits]] as const) {
    const moved = movedNames(entries, before, after);
    if (moved.size) names.set(root, moved);
  }
  return { paths: renames.size ? { map: placeholderPathMap(before), renames } : undefined, names };
}

/**
 * The rewrite a committed rename should offer, or null where there is nothing to offer: an unchanged or
 * blank name, a name another entry of the same kind already carries, or a name no stat's code references.
 */
export function planCodeRename(input: CodeRenameInput): CodeRenamePlan | null {
  const { root, stats, traits = [], otherNames, placeholders, subject } = input;
  const from = input.oldName.trim();
  const to = input.newName.trim();
  // Trimmed on both sides of the comparison: the field's text is what an author typed, and a name that
  // differs from another only by its spaces is the duplicate the warning already covers.
  if (!from || !to || from === to || otherNames.some((name) => name.trim() === to)) return null;
  // A rename that names its node follows the tree. Without one — a caller that knows only the name — the
  // bare-name form is all that can be proven, which is what every root but `placeholders` has anyway.
  const rewrite: CodeRewrite = placeholders && subject
    ? treeRewrite(placeholders, subject, from, to, stats, traits)
    : { names: new Map([[root, new Map([[from, to]])]]) };
  const edits: CodeRenameEdit[] = [];
  let references = 0;
  for (const stat of stats) {
    const rewritten = rewriteCode(stat.code ?? '', rewrite);
    if (!rewritten.references) continue;
    references += rewritten.references;
    edits.push({ id: stat.id, name: stat.name, code: rewritten.code });
  }
  return references ? { root, subject, oldName: from, newName: to, edits, references } : null;
}
