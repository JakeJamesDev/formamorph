import type { CodePins, Dictionary, Entity, Placeholder, PlaceholderRolls } from '@/types';
import type { PlaceholderOwnerRef, PlaceholderOwners } from './placeholderHomes';
import { libraryPlaceholderSet } from './libraryPlaceholders';
import {
  drawablePlaceholderValues, placeholderKindNoun, readPlaceholders, weightedPick,
  type PlaceholderPick, type PlaceholderReading,
} from './placeholders';
import { placeholderPathMap, type PlaceholderPathNode } from './statCodePaths';
import type { SandboxDictionary, SandboxPlaceholder, SandboxPlaceholderNode } from './statCodeExecutor';
import type { CodeOwnerName } from './statCodeAnalysis';
import { statCodeName } from './statCodeNames';

/** The placeholders one stat-code run reads, and what they resolve under. */
export interface StatCodePlaceholderSet {
  placeholders: readonly Placeholder[];
  /** The entity or dictionary each scoped placeholder belongs to, so its entry carries an owner node. Absent,
   *  every placeholder reads as the world's own. Every play and editor site passes it. */
  owners?: PlaceholderOwners;
  /** Every dictionary, in authored order. Each is a `dictionaries` entry, its placeholders its owner node. */
  dictionaries?: readonly CodeOwnerName[];
  /** Ids of the authored books in play: the ones left on at Enter World. Absent, every authored book is in play,
   *  as in the editor run and the Test Bench, which have no Enter World. */
  inPlayDictionaryIds?: ReadonlySet<string>;
  /** The library books picked at Enter World. The run joins their pools and lists them after `dictionaries`. */
  libraryDictionaries?: readonly Dictionary[];
  /** The playthrough's rolls. Read, never written. */
  rolls: PlaceholderRolls;
  /** Placeholder id → the text every pin in force holds it to. */
  pins?: Readonly<Record<string, string>>;
  /** The Code Pins as stored, so an Object pinned to a list reads that list back rather than its join.
   *  A Code Pin outranks every authored source, so an id in here is the pin in force. */
  codePins?: CodePins;
  /** Chooser for `roll()` and for any placeholder with no roll yet. Defaults to the weighted draw. */
  pick?: PlaceholderPick;
}

/**
 * What an Object reads as: the list in force. The pinned list where code pinned one, else the one text a
 * pin of any other kind holds it to, else its drawable values. The unpinned list drops a value that
 * resolves to nothing, exactly as the prompt's join does, so the `", "` join of this list is the text.
 *
 * A code pin reads back as it was stored, so a value carrying a comma survives the round trip. Code writes
 * plain text, so the join of those items is the pin the collection laid, and `text` is that pin resolved.
 */
function objectValue(ph: Placeholder, reading: PlaceholderReading, set: StatCodePlaceholderSet): string[] {
  const pinned = set.codePins?.[ph.id];
  if (Array.isArray(pinned)) return [...pinned];
  if (set.pins?.[ph.id] != null) return [reading.value];
  const drawable = new Set(drawablePlaceholderValues(ph).map((v) => v.id));
  return (ph.values ?? [])
    .map((v, index) => (drawable.has(v.id) ? reading.values[index] : ''))
    .filter((text) => text !== '');
}

/** `set` with the library's pools joined as the session's Placeholder Set joins them, the books after the
 *  world's. */
export function withLibraryPlaceholders(set: StatCodePlaceholderSet, entities: readonly Entity[]): StatCodePlaceholderSet {
  const books = set.libraryDictionaries ?? [];
  const joined = libraryPlaceholderSet([...set.placeholders], [...entities, ...books]);
  if (joined.length === set.placeholders.length && !books.length) return set;
  const added = joined.slice(set.placeholders.length);
  // The first owner of an id wins it, as the first copy wins the set.
  const ownerOf = new Map<string, PlaceholderOwnerRef>();
  const own = (kind: PlaceholderOwnerRef['kind'], { id, name, placeholders }: Entity | Dictionary) => {
    for (const p of placeholders ?? []) if (!ownerOf.has(p.id)) ownerOf.set(p.id, { kind, id, name });
  };
  for (const e of entities) own('entity', e);
  for (const b of books) own('dictionary', b);
  return {
    ...set,
    placeholders: joined,
    owners: new Map([
      ...set.owners ?? [], ...added.flatMap((p) => { const ref = ownerOf.get(p.id); return ref ? [[p.id, ref] as const] : []; }),
    ]),
    dictionaries: [...set.dictionaries ?? [], ...books.map(({ id, name }) => ({ id, name }))],
  };
}

/** Each dictionary under its code name: chips read as code reads them. */
export const codeDictionaries = (
  dictionaries: readonly CodeOwnerName[] | undefined, list: readonly Placeholder[],
): CodeOwnerName[] => (dictionaries ?? []).map(({ id, name }) => ({ id, name: statCodeName(name, list) }));

/** Each dictionary as a `dictionaries` entry, its owner node its `placeholders`. */
export const sandboxDictionaries = (
  books: readonly CodeOwnerName[], owners: ReadonlyMap<string, SandboxPlaceholderNode> | undefined,
): SandboxDictionary[] => books.map((book) => ({ ...book, placeholders: owners?.get(book.id) }));

/** One run's placeholder nodes: the top-level keys of `placeholders`, and each owner's node by owner id. */
export interface SandboxPlaceholderMap {
  top: SandboxPlaceholderNode[];
  owners: ReadonlyMap<string, SandboxPlaceholderNode>;
}

/**
 * The `placeholders` map one run reads: its top-level keys, in authored order, each a node of the path tree.
 * `roll()` draws with the author's weights and hands back the drawn value's resolved text; nothing it draws
 * is kept.
 *
 * The structure comes from the one path resolver, so the map code walks is the one the editor completes and
 * checks. A placeholder two entries reach, as `persona` and its `entities` entry do, is one node, and so holds
 * one pin state.
 */
export function sandboxPlaceholders(set: StatCodePlaceholderSet): SandboxPlaceholderMap {
  const pick = set.pick ?? weightedPick;
  const resolveOpts = {
    placeholders: [...set.placeholders], rolls: set.rolls, pins: set.pins && { ...set.pins }, pick,
  };
  const readings = readPlaceholders(resolveOpts);
  const entryById = new Map<string, SandboxPlaceholder>();
  readings.forEach((reading, index) => {
    const ph = set.placeholders[index];
    const values = ph.values ?? [];
    const weights = ph.weights;
    entryById.set(ph.id, {
      id: ph.id,
      value: placeholderKindNoun(ph) === 'Object' ? objectValue(ph, reading, set) : reading.value,
      values: reading.values,
      text: reading.value,
      roll: () => {
        if (!values.length) return '';
        const drawn = pick(values, weights);
        const at = values.findIndex((v) => v.text === drawn);
        return at >= 0 ? reading.values[at] : drawn;
      },
    });
  });

  const built = new Map<PlaceholderPathNode, SandboxPlaceholderNode>();
  const nodeOf = (node: PlaceholderPathNode): SandboxPlaceholderNode => {
    const hit = built.get(node);
    if (hit) return hit;
    const entry = node.placeholder ? entryById.get(node.placeholder.id) : undefined;
    const children: SandboxPlaceholderNode[] = [];
    // Registered before its children are walked, so one node is built per path node whether two keys reach
    // it or a hand-edited world has two placeholders holding each other.
    const made: SandboxPlaceholderNode = {
      name: node.name, path: node.path, ...(node.ownedBy ? { ownedBy: node.ownedBy } : {}), ...(entry ? { entry } : {}), children,
    };
    built.set(node, made);
    for (const child of node.children) children.push(nodeOf(child));
    return made;
  };
  const map = placeholderPathMap({ list: set.placeholders, owners: set.owners });
  return { top: map.top.map(nodeOf), owners: new Map([...map.owners].map(([id, node]) => [id, nodeOf(node)])) };
}
