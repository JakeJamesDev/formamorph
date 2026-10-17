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

import type { Entity, Placeholder, Script, Stat, StatGroup, Tool, TraitGroup } from '@/types';
import { canBePlayer } from './owners';
import { codeRenameChains, locationMoveKeys, type ChainRoot, type CodeRenameKey } from './codeRenameChains';
import type { PlaceholderOwnerRef, PlaceholderOwners } from './placeholderHomes';
import {
  placeholderPathMap, walkPlaceholderPath,
  type PlaceholderPathMap, type PlaceholderPathNode, type PlaceholderPathSource,
} from './statCodePaths';
import { statCodeName } from './statCodeNames';
import type { TraitOwnerMaps } from './statCodeTraits';
import { filledScripts } from './scripts';
import { WORLD_SCRIPT_OWNER } from './codeUses';
import {
  boxReferences, nameHomeOf, statCodeBoxes, statCodeOwners, traitCodeBoxes, worldScriptBoxes, worldToolBoxes, type CodeHome, type CodeOwners, type StatNameHome,
  type TraitCodeHome, type WorldScriptHome, type WorldToolHome,
} from './statCodeTargets';

/** The name-keyed maps a rename can reach. */
export type RenameRoot = 'stats' | 'placeholders' | 'traits' | 'locations';

/** The roots that are maps code looks a name up in; a location is named by `location.move`'s argument instead. */
type MapRoot = Exclude<RenameRoot, 'locations'>;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The key names of each chain off `root` in any of the stat's scripts. */
export const statCodeChains = (stat: Stat, root: ChainRoot): string[][] =>
  filledScripts(stat).flatMap((script) => codeRenameChains(script.code, root)).map((chain) => chain.map((key) => key.name));

/** Every exact map-lookup of `name` under `root`: the first key of each chain that reads as it. */
export const codeRenameReferences = (code: string, root: MapRoot, name: string): CodeRenameKey[] =>
  codeRenameChains(code, root).map((chain) => chain[0]).filter((key) => key.name === name);

/** `name` inside `quote`, with that quote and any backslash escaped. */
const quoted = (name: string, quote: string) =>
  `${quote}${name.replace(/\\/g, '\\\\').replace(new RegExp(quote, 'g'), `\\${quote}`)}${quote}`;

/** One stretch of code and what replaces it. */
export interface CodeSplice {
  from: number;
  to: number;
  insert: string;
}

/** `code` with every splice applied. Back to front, so an earlier splice keeps a later one's offsets. */
export const spliced = (code: string, edits: readonly CodeSplice[]): string =>
  [...edits]
    .sort((a, b) => b.from - a.from)
    .reduce((out, edit) => out.slice(0, edit.from) + edit.insert + out.slice(edit.to), code);

/** What one key becomes: the key alone where the author's form survives, the whole member expression where
 *  a dot form has to become a bracket to hold a name no identifier can spell. */
export function rewrittenKey(key: CodeRenameKey, newName: string): CodeSplice {
  if (key.quote) return { from: key.keyFrom, to: key.keyTo, insert: quoted(newName, key.quote) };
  if (IDENTIFIER.test(newName)) return { from: key.keyFrom, to: key.keyTo, insert: newName };
  return { from: key.objectTo, to: key.memberTo, insert: `${key.optional ? '?.' : ''}[${quoted(newName, "'")}]` };
}

/** `code` with every exact map-lookup of `oldName` under `root` renamed to `newName`. Everything else stays
 *  byte for byte, so a second run changes nothing. */
export const renameCodeReferences = (code: string, root: MapRoot, oldName: string, newName: string): string =>
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
 * `placeholders.Hair`. More than one key can move at once: an owner named through a chip is renamed by the
 * same edit that renames the placeholder behind the chip. Each prefix goes through the one walk, so a key that lost to a
 * member of its parent is left alone here exactly as it is everywhere else.
 */
function pathSplices(
  map: PlaceholderPathMap, chain: readonly CodeRenameKey[], renames: PathRenames, start: PlaceholderPathNode | null = null,
): CodeSplice[] {
  const edits: CodeSplice[] = [];
  const segments = chain.map((key) => key.name);
  for (let at = 0; at < chain.length; at += 1) {
    const { node, rest } = walkPlaceholderPath(map, segments.slice(0, at + 1), start);
    if (rest.length || !node) break;
    const moved = renames.get(nodeKey(node));
    if (moved !== undefined) edits.push(rewrittenKey(chain[at], moved));
  }
  return edits;
}

/** Each owner entry's node as code reaches it before a rename: by code name, and the persona's candidates. */
interface OwnedStarts {
  entities: ReadonlyMap<string, PlaceholderPathNode>;
  dictionaries: ReadonlyMap<string, PlaceholderPathNode>;
  /** Every playable entity's node, since the editor can't know which one plays. */
  persona: readonly PlaceholderPathNode[];
}

/** Every rewrite one rename asks of a stat's code, as the splices each root contributes. */
interface CodeRewrite {
  /** The map a rename walks as a tree, the nodes it moves there, and where each owner entry's walk starts.
   *  Absent where nothing moves. */
  paths?: { map: PlaceholderPathMap; renames: PathRenames; owned: OwnedStarts };
  /** The bare-name lookups that move, per root. */
  names: ReadonlyMap<ChainRoot, NameRenames>;
  /** The trait names that move inside entity trait maps, and whose maps they move in. Absent where none do. */
  entityTraits?: { moved: NameRenames; owners: TraitOwnerMaps };
}

/** The splices for one entity trait map's key: `traits` at `at`, the trait name after it. */
function entityTraitSplice(chain: readonly CodeRenameKey[], at: number, moved: NameRenames): CodeSplice | null {
  const key = chain[at + 1];
  const to = key && chain[at].name === 'traits' ? moved.get(key.name) : undefined;
  return to === undefined ? null : rewrittenKey(key, to);
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
    const { map, renames, owned } = rewrite.paths;
    for (const chain of codeRenameChains(code, 'placeholders')) edits.push(...pathSplices(map, chain, renames));
    for (const [root, starts] of [['entities', owned.entities], ['dictionaries', owned.dictionaries]] as const) {
      for (const chain of codeRenameChains(code, root)) {
        const start = chain[1]?.name === 'placeholders' ? starts.get(chain[0].name) : undefined;
        if (start) edits.push(...pathSplices(map, chain.slice(2), renames, start));
      }
    }
    for (const chain of codeRenameChains(code, 'persona')) {
      if (chain[0].name !== 'placeholders') continue;
      const path = chain.slice(1).map((key) => key.name);
      // How many steps of the path a start's own tree answers; a trailing member such as `.value` is not one.
      const reach = (start: PlaceholderPathNode) => path.length - walkPlaceholderPath(map, path, start).rest.length;
      const movers = owned.persona.map((start) => ({ start, found: pathSplices(map, chain.slice(1), renames, start) }));
      const mover = movers.find(({ found }) => found.length);
      if (!mover) continue;
      // Another playable entity answering as deep may be the one played, so the path stays.
      const depth = reach(mover.start);
      if (owned.persona.filter((start) => reach(start) >= depth).length > 1) continue;
      edits.push(...mover.found);
    }
  }
  for (const [root, moved] of rewrite.names) {
    for (const chain of codeRenameChains(code, root)) {
      const to = moved.get(chain[0].name);
      if (to !== undefined) edits.push(rewrittenKey(chain[0], to));
    }
  }
  if (rewrite.entityTraits) {
    const { moved, owners } = rewrite.entityTraits;
    const splices = [
      ...(owners.persona ? codeRenameChains(code, 'persona').map((chain) => entityTraitSplice(chain, 0, moved)) : []),
      ...codeRenameChains(code, 'entities')
        .filter((chain) => owners.entities.includes(chain[0].name))
        .map((chain) => entityTraitSplice(chain, 1, moved)),
    ];
    edits.push(...splices.filter((splice): splice is CodeSplice => splice !== null));
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
  location: { root: 'locations' },
  entity: { root: 'placeholders', kind: 'entity' },
  // `book` is what a search target calls a dictionary; `dictionary` is what the editor's tab calls it, and
  // so what the offer says. The two spellings meet here.
  book: { root: 'placeholders', kind: 'dictionary' },
};

/** What a replaced search target renames: its map, and the tree node it moves. Null where the replace is
 *  not a rename. */
export function codeRenameTarget(
  itemKey: string, fieldKey: string,
): { root: RenameRoot; subject?: CodeRenameSubject; traitId?: string; stat?: RenamedStat } | null {
  if (fieldKey !== 'name') return null;
  const at = itemKey.indexOf(':');
  const target = TARGET_ROOTS[itemKey.slice(0, at)];
  if (!target) return null;
  const id = itemKey.slice(at + 1);
  if (target.kind) return { root: target.root, subject: { kind: target.kind, id } };
  if (target.root === 'traits') return { root: target.root, traitId: id };
  return target.root === 'stats' ? { root: target.root, stat: { id } } : { root: target.root };
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

/** One stat's or trait's code, rewritten. A script the rename does not touch is absent rather than rewritten to itself. */
export interface CodeRenameEdit {
  /** Where the code is authored: the world's own scripts, a World Tool, a stat or a trait, an entity's own, or a link's override. */
  home: WorldScriptHome | WorldToolHome | CodeHome | TraitCodeHome;
  /** The stat's or trait's own name, so the offer can say whose code it is about. */
  name: string;
  /** The new code of each script the rename moved something in, by script id. */
  scripts: Record<string, string>;
}

/** What a rename would do to the world's stat code. */
export interface CodeRenamePlan {
  root: RenameRoot;
  /** What was renamed, where the rename moved a node of the placeholder tree. The offer names it. */
  subject?: CodeRenameSubject;
  oldName: string;
  newName: string;
  /** The stats whose code changes: the world's in authored order, then each entity's. */
  edits: CodeRenameEdit[];
  /** How many keys the rewrite covers. */
  references: number;
}

/** Which node of the placeholder tree a rename moved: an entry, or the entity or book that owns entries. */
export interface CodeRenameSubject {
  kind: 'placeholder' | 'entity' | 'dictionary';
  id: string;
}

/** The stat a stat rename moved: a world or Blueprint stat, or one of an entity's own. */
export interface RenamedStat {
  id: string;
  /** The entity that owns the stat. Absent for a global stat. */
  entityId?: string;
}

export interface CodeRenameInput {
  root: RenameRoot;
  /** The name as code read it before the edit. For a stat this is its code name. */
  oldName: string;
  newName: string;
  /** Every stat in the world, for the code they hold. */
  stats: readonly Stat[];
  /** The world's own scripts. */
  worldScripts?: readonly Script[];
  /** The world's Tools; a Script Tool's code is renamed with the rest. */
  worldTools?: readonly Tool[];
  /** Every trait in the world, for the scripts they hold. A placeholder rename moves the code name of a trait
   *  whose name carries it. */
  traits?: readonly { id?: string; name: string; groupId?: string | null; scripts?: Script[] }[];
  /** The world's trait groups, for the Blueprint traits a stat rename follows. */
  traitGroups?: readonly TraitGroup[];
  /** Every entity in the world. A placeholder rename moves the code name of an entity whose name carries it,
   *  and follows a playable one's own placeholders into `persona`. */
  entities?: readonly Entity[];
  /** The world's stat groups, for the Blueprints a stat rename follows. */
  statGroups?: readonly StatGroup[];
  /** Every dictionary in the world. A rename moves the code name of a book whose name carries it. */
  dictionaries?: readonly { name: string }[];
  /** Whose trait maps hold a renamed trait. Absent, only `traits` follows the rename. */
  traitOwnerMaps?: TraitOwnerMaps;
  /** The names the other entries of this kind carry. A rename onto one of them is a duplicate, which the
   *  duplicate-name warning already covers, so it gets no offer. */
  otherNames: readonly string[];
  /** The world's placeholder tree. With `subject`, the rename follows paths rather than bare names. */
  placeholders?: PlaceholderPathSource;
  subject?: CodeRenameSubject;
  /** The renamed stat. With it, a stat rename follows every route to that stat, in every box. */
  stat?: RenamedStat;
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
  entities: NonNullable<CodeRenameInput['entities']>,
  dictionaries: readonly { name: string }[],
): CodeRewrite {
  const before = sourceNaming(source, subject, oldName);
  const after = sourceNaming(source, subject, newName);
  const renames = movedNodes(before, after, subject, newName);
  const names = new Map<ChainRoot, NameRenames>();
  for (const [root, entries] of [['stats', stats], ['traits', traits], ['entities', entities], ['dictionaries', dictionaries]] as const) {
    const moved = movedNames(entries, before, after);
    if (moved.size) names.set(root, moved);
  }
  // An entity or a book is keyed by its code name, which is what the rename carries.
  if (subject.kind === 'entity' || subject.kind === 'dictionary') {
    const root = subject.kind === 'entity' ? 'entities' : 'dictionaries';
    names.set(root, new Map([...names.get(root) ?? [], [oldName, newName]]));
  }
  if (!renames.size) return { names };
  const map = placeholderPathMap(before);
  // Later wins a shared code name, as the sandbox keys it.
  const startsOf = (kind: PlaceholderOwnerRef['kind']) =>
    new Map([...map.owners.values()].filter((node) => node.owner?.kind === kind).map((node) => [node.name, node]));
  const persona = entities.flatMap((entity) => {
    const node = entity.id !== undefined && canBePlayer(entity) ? map.owners.get(entity.id) : undefined;
    return node ? [node] : [];
  });
  return { paths: { map, renames, owned: { entities: startsOf('entity'), dictionaries: startsOf('dictionary'), persona } }, names };
}

/**
 * Every key that reaches the renamed stat and no other, rewritten, one edit per place the code is authored.
 *
 * Routes resolve against the world as it read before the edit, with the renamed stat under its old name. A
 * key that also reaches another stat of that name, such as `persona.stats.X` where two entities that can be
 * played both hold an X, is left alone.
 */
function statRenameEdits(
  input: CodeRenameInput, renamed: RenamedStat, from: string, to: string,
): { edits: CodeRenameEdit[]; references: number } {
  const named = (stat: Stat) => (stat.id === renamed.id ? { ...stat, name: from } : stat);
  const owners = statCodeOwners({
    stats: renamed.entityId === undefined ? input.stats.map(named) : input.stats,
    statGroups: input.statGroups,
    entities: (input.entities ?? []).map((entity) =>
      (entity.id === renamed.entityId && entity.stats ? { ...entity, stats: entity.stats.map(named) } : entity)),
    placeholders: input.placeholders?.list ?? [],
  });
  const ownerId = renamed.entityId ?? null;
  const isRenamed = (home: StatNameHome) => home.statId === renamed.id && home.entityId === ownerId;
  return boxEdits(renameBoxes(input, owners), (box) => boxReferences(owners, box)
    .filter(({ targets }) => targets.every((target) => isRenamed(nameHomeOf(target))))
    .map(({ key }) => rewrittenKey(key, to)));
}

/** Every box of code in the world once, each with the owner name the offer calls it by. */
function renameBoxes(input: CodeRenameInput, owners: CodeOwners) {
  // Only traits with ids hold scripts a home can name.
  const traits = (input.traits ?? []).flatMap((trait) => (trait.id === undefined ? [] : [{ statChanges: [], ...trait, id: trait.id }]));
  return [
    ...worldScriptBoxes(input).map((box) => ({ box, name: WORLD_SCRIPT_OWNER })),
    ...worldToolBoxes(input).map((box) => ({ box, name: box.tool.name })),
    ...statCodeBoxes(owners).map((box) => ({ box, name: box.stat.name })),
    ...traitCodeBoxes(owners, { traits, traitGroups: input.traitGroups ?? [] }).map((box) => ({ box, name: box.trait.name })),
  ];
}

/** The edits `splicesOf` asks of each box, one per place the code is authored, and how many keys they cover. */
function boxEdits(
  boxes: ReturnType<typeof renameBoxes>, splicesOf: (box: ReturnType<typeof renameBoxes>[number]['box']) => CodeSplice[],
): { edits: CodeRenameEdit[]; references: number } {
  const edits = new Map<string, CodeRenameEdit>();
  let references = 0;
  for (const { box, name } of boxes) {
    const splices = splicesOf(box);
    if (!splices.length) continue;
    references += splices.length;
    const at = JSON.stringify(box.home);
    const edit = edits.get(at) ?? { home: box.home, name, scripts: {} };
    edit.scripts[box.id] = spliced(box.code, splices);
    edits.set(at, edit);
  }
  return { edits: [...edits.values()], references };
}

/** Every `location.move("<from>")` in every box, rewritten to `to`. Only a literal can be proven to name the place. */
function locationRenameEdits(input: CodeRenameInput, from: string, to: string): { edits: CodeRenameEdit[]; references: number } {
  const owners = statCodeOwners({
    stats: input.stats, statGroups: input.statGroups, entities: input.entities ?? [], placeholders: input.placeholders?.list ?? [],
  });
  return boxEdits(renameBoxes(input, owners), (box) => locationMoveKeys(box.code)
    .filter((key) => key.name === from)
    .map((key) => rewrittenKey(key, to)));
}

/**
 * The rewrite a committed rename should offer, or null where there is nothing to offer: an unchanged or
 * blank name, a name another entry of the same kind already carries, or a name no stat's code references.
 */
export function planCodeRename(input: CodeRenameInput): CodeRenamePlan | null {
  const { root, stats, traits = [], entities = [], dictionaries = [], otherNames, placeholders, subject, traitOwnerMaps } = input;
  const from = input.oldName.trim();
  const to = input.newName.trim();
  // Trimmed on both sides of the comparison: the field's text is what an author typed, and a name that
  // differs from another only by its spaces is the duplicate the warning already covers.
  if (!from || !to || from === to || otherNames.some((name) => name.trim() === to)) return null;
  if (root === 'stats' && input.stat) {
    const found = statRenameEdits(input, input.stat, from, to);
    return found.references ? { root, oldName: from, newName: to, ...found } : null;
  }
  if (root === 'locations') {
    // A name two locations share reaches the first, so which calls the rename moved can't be told.
    if (otherNames.some((name) => name.trim() === from)) return null;
    const found = locationRenameEdits(input, from, to);
    return found.references ? { root, oldName: from, newName: to, ...found } : null;
  }
  // A rename that names its node follows the tree. Without one — a caller that knows only the name — the
  // bare-name form is all that can be proven, which is what every root but `placeholders` has anyway.
  const moved: NameRenames = new Map([[from, to]]);
  const rewrite: CodeRewrite = placeholders && subject
    ? treeRewrite(placeholders, subject, from, to, stats, traits, entities, dictionaries)
    : {
      names: new Map(root === 'traits' && traitOwnerMaps?.world === false ? [] : [[root, moved]]),
      ...(root === 'traits' && traitOwnerMaps ? { entityTraits: { moved, owners: traitOwnerMaps } } : {}),
    };
  const edits: CodeRenameEdit[] = [];
  let references = 0;
  const homes: { home: CodeRenameEdit['home']; name: string; scripts: readonly Script[] }[] = [
    { home: { kind: 'world' }, name: WORLD_SCRIPT_OWNER, scripts: filledScripts({ scripts: input.worldScripts }) },
    ...worldToolBoxes(input).map(({ home, tool, id, timing, code }) => ({ home, name: tool.name, scripts: [{ id, timing, code }] })),
    ...stats.map((stat) => ({ home: { kind: 'stat' as const, statId: stat.id }, name: stat.name, scripts: filledScripts(stat) })),
    ...traits.flatMap((trait) => (trait.id === undefined ? []
      : [{ home: { kind: 'trait' as const, traitId: trait.id }, name: trait.name, scripts: filledScripts(trait) }])),
  ];
  // Every script, because a rename that moved one and left another would strand the lookups it skipped.
  for (const { home, name, scripts: held } of homes) {
    const scripts: Record<string, string> = {};
    let moved = 0;
    for (const script of held) {
      const rewritten = rewriteCode(script.code, rewrite);
      if (!rewritten.references) continue;
      moved += rewritten.references;
      scripts[script.id] = rewritten.code;
    }
    if (!moved) continue;
    references += moved;
    edits.push({ home, name, scripts });
  }
  return references ? { root, subject, oldName: from, newName: to, edits, references } : null;
}
