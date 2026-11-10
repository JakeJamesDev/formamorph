// The World Editor Openings tab's owner list: This World, then the locations and entities that hold openings
// in their own nesting, with dim context rows for the parents in between.

import { locationRows } from './locationTree';
import { ownerChoices } from './ownerChoices';
import { canOwnSelfOpenings, type EditorOpeningGroup, type EditorOpeningRow, type OpeningsEditorView } from './openings';
import type { Entity, EntityGroup, GameLocation } from '@/types';

export const WORLD_OWNER_KEY = 'world';
export const locationOwnerKey = (id: string): string => `location:${id}`;
export const entityOwnerKey = (id: string): string => `entity:${id}`;

export type OwnerKind = 'world' | 'location' | 'entity';

/** The owner a selection key names, as the world holds it now. */
export type ResolvedOwner =
  | { kind: 'world' }
  | { kind: 'location'; location: GameLocation }
  | { kind: 'entity'; entity: Entity };

/** The owner `key` names; null for a key no owner answers to, a deleted one included. */
export function resolveOwnerKey(
  key: string, locations: readonly GameLocation[], entities: readonly Entity[],
): ResolvedOwner | null {
  if (key === WORLD_OWNER_KEY) return { kind: 'world' };
  const at = key.indexOf(':');
  const kind = key.slice(0, at);
  const id = key.slice(at + 1);
  if (kind === 'location') {
    const location = locations.find((l) => l.id === id);
    return location ? { kind, location } : null;
  }
  if (kind === 'entity') {
    const entity = entities.find((e) => e.id === id);
    return entity ? { kind, entity } : null;
  }
  return null;
}

/** One listed owner, with the group its pane draws. */
export interface OpeningsTabOwner {
  key: string;
  kind: OwnerKind;
  name: string;
  group: EditorOpeningGroup;
}

/** What a row that can hold others carries: whether rows nest under it, and whether they are folded away. */
interface Foldable {
  parent: boolean;
  collapsed: boolean;
}

export type OpeningsTabRow =
  | ({ kind: 'owner'; owner: OpeningsTabOwner; depth: number } & Foldable)
  /** A parent location or entity folder that holds no listed owner but contains one. */
  | ({ kind: 'context'; key: string; context: 'location' | 'group'; name: string; depth: number } & Foldable)
  | { kind: 'rule'; key: string };

type TreeRow = Exclude<OpeningsTabRow, { kind: 'rule' }>;

/** The key a row folds under: an owner's selection key, or the context row's own. */
export const foldKey = (row: TreeRow): string => (row.kind === 'owner' ? row.owner.key : row.key);

/** Marks each row that has rows nested under it, and drops the rows under a collapsed one. */
function foldTree(rows: TreeRow[], collapsed: ReadonlySet<string>): TreeRow[] {
  const out: TreeRow[] = [];
  let hiddenUnder: number | null = null;
  rows.forEach((row, i) => {
    if (hiddenUnder !== null) {
      if (row.depth > hiddenUnder) return;
      hiddenUnder = null;
    }
    const parent = (rows[i + 1]?.depth ?? 0) > row.depth;
    const folded = parent && collapsed.has(foldKey(row));
    if (folded) hiddenUnder = row.depth;
    out.push({ ...row, parent, collapsed: folded });
  });
  return out;
}

/** A location or entity owner with none of its rows shown: a fresh owner. `atNoStart` comes from the view. */
export function rowlessOwner(key: string, owner: Exclude<ResolvedOwner, { kind: 'world' }>): OpeningsTabOwner {
  const location = owner.kind === 'location' ? owner.location : undefined;
  const entity = owner.kind === 'entity' ? owner.entity : undefined;
  const name = (location ?? entity)?.name ?? '';
  return {
    key, kind: owner.kind, name,
    group: { entity: entity ?? null, location, name, rows: [], showSelf: !!entity && canOwnSelfOpenings(entity), atNoStart: false },
  };
}

/** Every owner the tab lists, by key: the view's groups plus a selected owner that has no openings (Q12). */
export function openingsTabOwners(
  view: OpeningsEditorView, selected: { key: string; owner: ResolvedOwner } | null,
): Map<string, OpeningsTabOwner> {
  const out = new Map<string, OpeningsTabOwner>();
  for (const group of view.groups) {
    const key = group.location ? locationOwnerKey(group.location.id) : group.entity ? entityOwnerKey(group.entity.id) : WORLD_OWNER_KEY;
    const kind: OwnerKind = group.location ? 'location' : group.entity ? 'entity' : 'world';
    out.set(key, { key, kind, name: group.name, group });
  }
  if (selected && selected.owner.kind !== 'world' && !out.has(selected.key)) {
    const held = selected.owner.kind === 'location' ? selected.owner.location : selected.owner.entity;
    if (!held.openings?.length) out.set(selected.key, rowlessOwner(selected.key, selected.owner));
  }
  return out;
}

/** One row of a location picker level: a pick, or a level to open when a location below it is pickable. */
export interface LocationPickRow {
  location: GameLocation;
  drills: boolean;
}

/** The + menu's location drill-in. */
export interface LocationPicker {
  /** Whether any location can be picked. */
  any: boolean;
  pickable: (id: string) => boolean;
  /** The rows under `parentId`, null for the top: only those with a pick at or below them. */
  level: (parentId: string | null) => LocationPickRow[];
}

/** The location drill-in over `locations`. `listed` says whether a location is on the tab with no search and no
 *  filter; every other location is pickable. */
export function locationPicker(locations: readonly GameLocation[], listed: (id: string) => boolean): LocationPicker {
  const flat = locationRows([...locations]);
  // A location with a pickable location below it.
  const drills = new Set<string>();
  // Reverse depth-first order reaches every child before its parent.
  for (const node of [...flat].reverse()) {
    if (node.parentId && (drills.has(node.id) || !listed(node.id))) drills.add(node.parentId);
  }
  const offers = (id: string) => drills.has(id) || !listed(id);
  return {
    any: flat.some((n) => !listed(n.id)),
    pickable: (id: string) => !listed(id),
    level: (parentId: string | null): LocationPickRow[] => flat
      .filter((n) => n.parentId === parentId && offers(n.id))
      .map((n) => ({ location: n.location, drills: drills.has(n.id) })),
  };
}

/** The + menu's entity drill-in: every entity not on the tab with no search and no filter, in its folders. */
export const entityPickChoices = (entityGroups: readonly EntityGroup[], entities: readonly Entity[], listed: (id: string) => boolean) =>
  ownerChoices([...entityGroups], entities.filter((e) => !listed(e.id)));

/** The tab's list rows, top to bottom. `matches` says whether an owner row stays under the search; This World
 *  always does. Rows under a key in `collapsed` are left out; pass an empty set to get every row. */
export function openingsTabRows({ owners, locations, entities, entityGroups, matches, collapsed }: {
  owners: Map<string, OpeningsTabOwner>;
  locations: readonly GameLocation[];
  entities: readonly Entity[];
  entityGroups: readonly EntityGroup[];
  matches: (name: string, rows: EditorOpeningRow[]) => boolean;
  collapsed: ReadonlySet<string>;
}): OpeningsTabRow[] {
  const leaf = { parent: false, collapsed: false } as const;
  const shown = (owner: OpeningsTabOwner | undefined): owner is OpeningsTabOwner =>
    !!owner && matches(owner.name, owner.group.rows);

  const world = owners.get(WORLD_OWNER_KEY);
  const rows: OpeningsTabRow[] = world ? [{ kind: 'owner', owner: world, depth: 0, ...leaf }] : [];

  const flat = locationRows([...locations]);
  const parentOf = new Map(flat.map((n) => [n.id, n.parentId]));
  const listedLocations = flat.map((n) => owners.get(locationOwnerKey(n.id))).filter(shown);
  const keep = new Set<string>();
  for (const owner of listedLocations) {
    for (let at: string | null | undefined = owner.group.location?.id; at && !keep.has(at); at = parentOf.get(at)) keep.add(at);
  }
  const locationTree = foldTree(flat.filter((n) => keep.has(n.id)).map((n): TreeRow => {
    const owner = owners.get(locationOwnerKey(n.id));
    return shown(owner)
      ? { kind: 'owner', owner, depth: n.depth, ...leaf }
      : { kind: 'context', key: `context:location:${n.id}`, context: 'location', name: n.location.name, depth: n.depth, ...leaf };
  }), collapsed);

  const listedEntities = entities.filter((e) => shown(owners.get(entityOwnerKey(e.id))));
  const depthOf = new Map<string, number>();
  const entityTree = foldTree(ownerChoices([...entityGroups], listedEntities).map((choice): TreeRow => {
    const depth = choice.parentId ? (depthOf.get(choice.parentId) ?? 0) + 1 : 0;
    depthOf.set(choice.id, depth);
    const owner = owners.get(entityOwnerKey(choice.id));
    return choice.kind === 'owner' && owner
      ? { kind: 'owner', owner, depth, ...leaf }
      : { kind: 'context', key: `context:group:${choice.id}`, context: 'group', name: choice.name, depth, ...leaf };
  }), collapsed);

  rows.push(...locationTree);
  if (locationTree.length && entityTree.length) rows.push({ kind: 'rule', key: 'rule' });
  rows.push(...entityTree);
  return rows;
}
