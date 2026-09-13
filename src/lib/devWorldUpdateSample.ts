/**
 * DEV-only stand-in for one world update review. Dynamically imported by
 * `#dev?view=mainMenu&modal=worldUpdate`, so the dialog is reachable without an installed world copy, a
 * republished listing, and a library holding the sources behind it.
 *
 * It carries all three row kinds, both states a changed row can be in, and a new required source the
 * server cannot resolve, so every group and every line the dialog can draw is on screen at once.
 */
import type { WorldUpdateReview } from '@/lib/useDownloadCoordinator';

export function devWorldUpdateReview(): WorldUpdateReview {
  return {
    world: { _id: 'dev-listing-world', name: 'Sedge Landing' },
    localId: 'dev-local-1',
    localName: 'Sedge Landing',
    rows: [
      {
        sourceId: 'dev-src-1', name: 'Marsh Warden', rowKind: 'changed', library: 'entity', state: 'linked',
        itemId: 'dev-copy-1',
      },
      {
        sourceId: 'dev-src-2', name: 'Marsh Lore', rowKind: 'changed', library: 'dictionary',
        state: 'local-replacement', itemId: 'dev-copy-2',
      },
      { sourceId: 'dev-src-3', name: 'The Ferryman', rowKind: 'added', library: 'entity' },
      { sourceId: 'dev-src-5', name: 'Reed Cutter', rowKind: 'added', library: 'entity', unavailable: true },
      {
        sourceId: 'dev-src-4', name: 'Fen Dialect', rowKind: 'dropped', library: 'dictionary', state: 'linked',
        itemId: 'dev-copy-4',
      },
    ],
    previous: {},
  };
}
