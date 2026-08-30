/**
 * Library tile organization: the per-tab arrangement of the main-menu grids — folder groups, tile
 * sizes, and the order both sit in — as pure operations over one state object, plus the packer that
 * turns that state into grid positions. Device-local throughout: nothing here reaches a world export,
 * a publish, or a backup.
 */
export * from './types';
export * from './operations';
export * from './packer';
export * from './placements';
export * from './cellSim';
export * from './codec';
