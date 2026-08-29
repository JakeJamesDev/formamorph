import type { MainMenuCardTab } from '@/views/mainMenuTabs';
import {
  emptyTabOrganization,
  type LibraryGroup,
  type LibraryGroupSettings,
  type LibraryTabOrganization,
  type LibraryTileSize,
} from './types';

/** Where each tab's tile arrangement lives, one key per tab so the grids can never bleed into each other. */
export const TILE_STORAGE_KEYS: Record<MainMenuCardTab, string> = {
  worlds: 'FORMAMORPH_worldTiles',
  entities: 'FORMAMORPH_entityTiles',
  dictionaries: 'FORMAMORPH_dictionaryTiles',
  models: 'FORMAMORPH_modelTiles',
};

/**
 * The flat card-order lists the library kept before tiles. Read once, as the seed for a tab that has
 * never been arranged, so an existing library comes through the update in the order the player left it.
 */
export const LEGACY_ORDER_KEYS: Record<MainMenuCardTab, string> = {
  worlds: 'FORMAMORPH_worldOrder',
  entities: 'FORMAMORPH_entityOrder',
  dictionaries: 'FORMAMORPH_dictionaryOrder',
  models: 'FORMAMORPH_modelOrder',
};

const SIZES: LibraryTileSize[] = ['small', 'medium', 'large'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/** A stored group, or null when the entry is not one — an empty folder included, since it shows nothing. */
const readGroup = (id: string, value: unknown, taken: Set<string>): LibraryGroup | null => {
  if (!isRecord(value)) return null;
  // A member listed in two folders belongs to the first that claimed it; one item, one folder.
  const members = stringList(value.members).filter((member) => !taken.has(member));
  if (members.length === 0) return null;
  members.forEach((member) => taken.add(member));

  return {
    id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Group',
    members,
    settings: isRecord(value.settings) ? (value.settings as LibraryGroupSettings) : {},
  };
};

/**
 * Read one tab's tile arrangement. Anything unreadable — corrupt JSON, a shape from somewhere else, a
 * half-written record — falls back to the pre-tiles flat order rather than to nothing, so the worst a
 * bad write costs is the grouping, never the library's order.
 */
export function loadTabOrganization(tab: MainMenuCardTab): LibraryTabOrganization {
  const legacy = (): LibraryTabOrganization => ({
    ...emptyTabOrganization(),
    order: stringList(readJson(LEGACY_ORDER_KEYS[tab])),
  });

  const raw = readJson(TILE_STORAGE_KEYS[tab]);
  if (!isRecord(raw)) return legacy();

  const taken = new Set<string>();
  const groups: Record<string, LibraryGroup> = {};
  if (isRecord(raw.groups)) {
    for (const [id, value] of Object.entries(raw.groups)) {
      const group = readGroup(id, value, taken);
      if (group) groups[id] = group;
    }
  }

  const order = stringList(raw.order).filter((id) => (id in groups ? true : !taken.has(id)));
  // A folder the order lost would be unreachable, so it is appended rather than dropped.
  const listed = new Set(order);
  order.push(...Object.keys(groups).filter((id) => !listed.has(id)));

  const sizes: Record<string, LibraryTileSize> = {};
  if (isRecord(raw.sizes)) {
    for (const [id, value] of Object.entries(raw.sizes)) {
      if (SIZES.includes(value as LibraryTileSize)) sizes[id] = value as LibraryTileSize;
    }
  }

  return { order, groups, sizes };
}

/** Write one tab's arrangement. A full or blocked storage costs the arrangement, never the session. */
export function saveTabOrganization(tab: MainMenuCardTab, org: LibraryTabOrganization): void {
  try {
    localStorage.setItem(TILE_STORAGE_KEYS[tab], JSON.stringify(org));
  } catch {
    // Nothing to recover: the in-memory arrangement stands for as long as the page lives.
  }
}
