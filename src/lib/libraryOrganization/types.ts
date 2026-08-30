/**
 * How much room a library tile takes in the grid layout. Half, one, or double a medium tile per side,
 * which the packer turns into 1x1, 2x2, and 4x4 base cells.
 */
export type LibraryTileSize = 'small' | 'medium' | 'large';

/**
 * Settings a group applies to the items inside it. An open map so a later setting is a new key, not a
 * stored-shape migration; V1 fills only `promptPreset`, and only on world groups.
 */
export interface LibraryGroupSettings {
  /** Preset id every member world runs on unless that world carries a pin of its own. */
  promptPreset?: string;
  /** Keys a later version adds. They survive storage and an edit here untouched. */
  [key: string]: unknown;
}

/** A folder tile: a name, the items it holds, and whatever it applies to them. */
export interface LibraryGroup {
  id: string;
  name: string;
  /** Item ids, in the order the folder view shows them. Never holds another group id. */
  members: string[];
  settings: LibraryGroupSettings;
}

/** A tile's home in the base-cell grid: the cell its top-left corner sits in. */
export interface TilePlacement {
  row: number;
  col: number;
}

/** Every tile's home at one grid width, by id. Ids the map has never seen have no home yet. */
export type PlacementMap = Record<string, TilePlacement>;

/**
 * One library tab's organization. `order` is the top level and holds item ids and group ids together;
 * `sizes` covers both kinds, so a folder tile resizes like any other.
 *
 * `placements` is where the arrangement really lives: one map per base-cell column count, so a board
 * arranged on a phone and the same board on a desktop keep their own layouts and never scramble each
 * other. Holes are part of the arrangement — nothing here ever compacts. `order` stays as the linear
 * reading of the board, for the detailed layout and for seeding a width no one has visited yet.
 */
export interface LibraryTabOrganization {
  order: string[];
  groups: Record<string, LibraryGroup>;
  sizes: Record<string, LibraryTileSize>;
  placements: Record<number, PlacementMap>;
}

/** The name a group takes until the player renames it. */
export const NEW_GROUP_NAME = 'New Group';

export const emptyTabOrganization = (): LibraryTabOrganization => ({
  order: [],
  groups: {},
  sizes: {},
  placements: {},
});
