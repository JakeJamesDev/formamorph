/**
 * How code names a placeholder: the path the editor shows, as a member chain.
 *
 * The `placeholders` map is a tree. Its top level keys each of the world's own rows by name, last authored
 * winning a shared one. Each entity or dictionary that owns placeholders has an owner node, which its entry
 * carries as its `placeholders`. An entry or an owner node exposes its children as members, as deep as the
 * ownership tree goes, so `entities.Molly.placeholders.Hair.Shade` reads what the editor calls
 * `Molly › Hair › Shade`.
 *
 * One resolver, because four surfaces read the same grammar: the sandbox builds the map from it, the
 * editor's completions and checks walk it, and the Test Bench reports what a write missed by it. A second
 * spelling anywhere would let an author complete one path and run another.
 */
import type { Placeholder } from '@/types';
import type { PlaceholderOwnerRef, PlaceholderOwners } from './placeholderHomes';
import { PLACEHOLDER_PATH_SEPARATOR } from './placeholders';
import { holderOf } from './placeholderTree';
import { statCodeName } from './statCodeNames';

/**
 * The members every entry of the map carries. A child named like one of them loses to the member, so the
 * member is what the path reaches and the child is unreachable under its holder.
 */
export const PLACEHOLDER_ENTRY_MEMBERS: readonly string[] = ['id', 'name', 'value', 'values', 'text', 'roll', 'pin', 'unpin'];

const MEMBERS: ReadonlySet<string> = new Set(PLACEHOLDER_ENTRY_MEMBERS);

/** Whether a name is one of an entry's own members, and so loses to it as a child name. */
export const isPlaceholderEntryMember = (name: string): boolean => MEMBERS.has(name);

/** One node of the map: a placeholder entry, an owner node, or a holder that is both. */
export interface PlaceholderPathNode {
  /** The key this node takes in its parent, and at the top level. */
  name: string;
  /** The placeholder the node reads, or null on an owner node. */
  placeholder: Placeholder | null;
  /** The entity or dictionary this node stands for, on an owner node only. */
  owner?: PlaceholderOwnerRef;
  /** Every segment from the map root to this node: owner, then the holder chain, then its own name. */
  path: readonly string[];
  /** The kind of owner whose entry the path starts at; absent for the world's own rows. */
  ownedBy?: PlaceholderOwnerRef['kind'];
  /** The placeholders this node owns, in authored order. */
  children: readonly PlaceholderPathNode[];
}

/** What a map is built from: the world's placeholders, and who owns each scoped one. */
export interface PlaceholderPathSource {
  list: readonly Placeholder[];
  /** Absent, nothing is scoped and the map has no owner nodes. */
  owners?: PlaceholderOwners;
}

/** One claim on a top-level key, in authored order. The last claim on a key is the one that reads. */
export interface PlaceholderKeyClaim {
  key: string;
  node: PlaceholderPathNode;
}

/** The whole map: its top-level keys and every claim that was made on one. */
export interface PlaceholderPathMap {
  /** One node per top-level key: the world's own rows. */
  top: readonly PlaceholderPathNode[];
  /** Each top-level key and the node that reads. */
  keys: ReadonlyMap<string, PlaceholderPathNode>;
  /** Every claim, so a duplicate name can be counted. */
  claims: readonly PlaceholderKeyClaim[];
  /** Each owner's node by owner id. */
  owners: ReadonlyMap<string, PlaceholderPathNode>;
}

/** A node while it is being built, before its children are in place. */
type MutableNode = PlaceholderPathNode & { children: PlaceholderPathNode[] };

const EMPTY_MAP: PlaceholderPathMap = { top: [], keys: new Map(), claims: [], owners: new Map() };

const cache = new WeakMap<readonly Placeholder[], { owners: PlaceholderOwners | undefined; map: PlaceholderPathMap }>();

/**
 * The map `placeholders` is, for one world. The same list and owner map answer with the same object, so the
 * editor can build it on every keystroke.
 */
export function placeholderPathMap(source: PlaceholderPathSource): PlaceholderPathMap {
  if (!source.list.length) return EMPTY_MAP;
  const hit = cache.get(source.list);
  if (hit && hit.owners === source.owners) return hit.map;
  const map = buildMap(source);
  cache.set(source.list, { owners: source.owners, map });
  return map;
}

function buildMap({ list, owners }: PlaceholderPathSource): PlaceholderPathMap {
  const byId = new Map(list.map((p) => [p.id, p]));
  const heldBy = new Map(list.map((p) => [p.id, holderOf(list, p)]));
  const childrenOf = new Map<string, Placeholder[]>();
  for (const p of list) {
    const holder = heldBy.get(p.id);
    if (!holder) continue;
    const held = childrenOf.get(holder);
    if (held) held.push(p);
    else childrenOf.set(holder, [p]);
  }

  /** The name an entity or a dictionary takes as a key: its own name, chips read as code reads them. */
  const ownerKey = (name: string) => statCodeName(name, list);

  /** The canonical segments that reach `p`: its owner, every holder above it, then its own name. */
  const pathOf = (p: Placeholder): { path: string[]; owner?: PlaceholderOwnerRef } => {
    const chain: string[] = [];
    const seen = new Set<string>();
    let at: Placeholder | undefined = p;
    while (at && !seen.has(at.id)) {
      seen.add(at.id);
      chain.unshift(at.name);
      const holder = heldBy.get(at.id);
      at = holder ? byId.get(holder) : undefined;
    }
    // The owner of the outermost holder is the one that opens the path: the owner node holds that row, and
    // everything below it is reached through that row rather than through the owner again.
    const root = [...seen].pop();
    const owner = root === undefined ? undefined : owners?.get(root);
    return owner ? { path: [ownerKey(owner.name), ...chain], owner } : { path: chain };
  };

  const nodeById = new Map<string, MutableNode>();
  const nodeOf = (p: Placeholder): MutableNode => {
    const hit = nodeById.get(p.id);
    if (hit) return hit;
    // Registered before its children are walked, so a hand-edited world where two placeholders hold each
    // other builds one node apiece rather than recursing forever.
    const { path, owner } = pathOf(p);
    const node: MutableNode = { name: p.name, placeholder: p, path, ...(owner ? { ownedBy: owner.kind } : {}), children: [] };
    nodeById.set(p.id, node);
    for (const child of childrenOf.get(p.id) ?? []) node.children.push(nodeOf(child));
    return node;
  };

  const claims: PlaceholderKeyClaim[] = [];
  // A later claim wins, the duplicate rule of every name-keyed map in the sandbox; `Map.set` keeps the key's position.
  const keys = new Map<string, PlaceholderPathNode>();
  const ownerNodes = new Map<string, MutableNode>();
  for (const p of list) {
    if (heldBy.get(p.id)) continue;
    const owner = owners?.get(p.id);
    if (!owner) {
      const node = nodeOf(p);
      claims.push({ key: p.name, node });
      keys.set(p.name, node);
      continue;
    }
    // An owner node carries the rows that owner holds directly.
    let node = ownerNodes.get(owner.id);
    if (!node) {
      const name = ownerKey(owner.name);
      node = { name, placeholder: null, owner, path: [name], ownedBy: owner.kind, children: [] };
      ownerNodes.set(owner.id, node);
    }
    node.children.push(nodeOf(p));
  }
  return { top: [...keys.values()], keys, claims, owners: ownerNodes };
}

/** How far a path walks into the map, and what it had left over: a member read, or a name nothing answers. */
export interface PlaceholderWalk {
  node: PlaceholderPathNode | null;
  rest: readonly string[];
  /** True where the walk stopped because a child's name lost to a member of its holder. */
  shadowed?: boolean;
}

/**
 * Walk `segments` into the map from `from`, or from the top, stopping at the first one no node answers. On an
 * entry, a member of its own wins the name over a child that shares it, so the walk stops there too.
 *
 * The one walk over the map. The sandbox reads a path by building the map's objects, and every other surface
 * reads one by coming through here, so what the editor offers and checks cannot disagree with what runs.
 */
export function walkPlaceholderPath(
  map: PlaceholderPathMap, segments: readonly string[], from: PlaceholderPathNode | null = null,
): PlaceholderWalk {
  let node: PlaceholderPathNode | null = from;
  for (let at = 0; at < segments.length; at += 1) {
    const next: PlaceholderPathNode | undefined = node
      ? node.children.find((child) => child.name === segments[at])
      : map.keys.get(segments[at]);
    if (node?.placeholder && isPlaceholderEntryMember(segments[at])) {
      return { node, rest: segments.slice(at), shadowed: !!next };
    }
    if (!next) return { node, rest: segments.slice(at) };
    node = next;
  }
  return { node, rest: [] };
}

/** The node a whole path of segments reaches, or null where any segment goes unanswered. */
export function placeholderPathAt(map: PlaceholderPathMap, segments: readonly string[]): PlaceholderPathNode | null {
  const { node, rest } = walkPlaceholderPath(map, segments);
  return rest.length === 0 ? node : null;
}

/** How many things claim a top-level key, and the node that reads where more than one does. */
export function placeholderKeyWinner(
  map: PlaceholderPathMap, key: string,
): { count: number; node: PlaceholderPathNode | null } {
  return {
    count: map.claims.reduce((total, entry) => total + (entry.key === key ? 1 : 0), 0),
    node: map.keys.get(key) ?? null,
  };
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** One member step: `.Name` for an identifier, `["Name"]` for anything else. */
export const memberStep = (name: string): string => (IDENTIFIER.test(name) ? `.${name}` : `[${JSON.stringify(name)}]`);

/** Where a path starts: the world's `placeholders`, an owner entry's, or the persona's. */
export type PlaceholderPathRoot = PlaceholderOwnerRef['kind'] | 'persona';

/** The global each kind of owner's entry hangs off. */
export const OWNER_GLOBAL: Record<PlaceholderOwnerRef['kind'], string> = { entity: 'entities', dictionary: 'dictionaries' };

/** A path as the whole expression: `placeholders.Hair`, `entities["Old Molly"].placeholders["Eye Color"]`.
 *  Under an owner, the first segment is the owner's name, or `persona`. */
export const placeholderPathExpression = (segments: readonly string[], root?: PlaceholderPathRoot): string => {
  const steps = (list: readonly string[]) => list.map(memberStep).join('');
  if (!root) return `placeholders${steps(segments)}`;
  const [owner, ...rest] = segments;
  const head = root === 'persona' ? 'persona' : `${OWNER_GLOBAL[root]}${memberStep(owner)}`;
  return `${head}.placeholders${steps(rest)}`;
};

/** A path as every other surface in the editor names it: `Molly › Hair`. What a message about one reads. */
export const placeholderPathLabel = (segments: readonly string[]): string =>
  segments.join(PLACEHOLDER_PATH_SEPARATOR);
