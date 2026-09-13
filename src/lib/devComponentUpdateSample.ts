/**
 * DEV-only stand-in for one component update review. Dynamically imported by
 * `#dev?view=mainMenu&modal=componentUpdates`, so the dialog is reachable without a library item, two
 * worlds following it, and a saved change to put them behind it.
 *
 * It carries both row states: an unmodified copy defaulting to Update, and a local replacement defaulting
 * to Keep Mine. The content differs by a changed field, an added entry and a removed one, so View Changes
 * shows every group it can draw.
 */
import type { UpdateRow } from '@/lib/componentUpdates';
import type { LibrarySource, LinkableContent } from '@/lib/linkedContent';
import type { Dictionary } from '@/types';

export function devUpdateSource(): LibrarySource {
  return { id: 'dev-lib-1', name: 'Marsh Lore', revision: 'r4', owned: false, sourceId: 'dev-listing-1' };
}

export function devUpdateSourceData(): LinkableContent {
  return {
    id: 'dev-lib-content',
    name: 'Marsh Lore',
    description: 'Terms the fen people use.',
    tags: ['marsh', 'folklore'],
    entries: [
      { id: 'e-reeds', name: 'Reeds', key: ['reeds'], value: 'Tall, sharp, and endless.' },
      { id: 'e-ferry', name: 'Ferry', key: ['ferry', 'boat'], value: 'Runs at dawn and at dusk, weather allowing.' },
      { id: 'e-lantern', name: 'Bog Lantern', key: ['lantern'], value: 'A light that walks the water at night.' },
    ],
  } as Dictionary;
}

/** The copies the two sample worlds hold, which the dialog compares against the source above. */
export function devUpdateCopies(): Record<string, LinkableContent> {
  const held = devUpdateSourceData() as Dictionary;
  return {
    'dev-copy-1': {
      ...held,
      id: 'dev-copy-1',
      entries: [
        held.entries[0],
        { id: 'c-ferry', name: 'Ferry', key: ['ferry', 'boat'], value: 'Runs at dawn.' },
        { id: 'c-silt', name: 'Silt Road', key: ['silt road'], value: 'The dry way, in a dry year.' },
      ],
    },
    'dev-copy-2': {
      ...held,
      id: 'dev-copy-2',
      description: 'Terms the fen people use, with my own notes.',
      entries: held.entries,
    },
  };
}

export function devUpdateRows(): UpdateRow[] {
  return [
    {
      worldId: 'dev-world-1', worldName: 'Sedge Landing', itemId: 'dev-copy-1', itemName: 'Marsh Lore',
      kind: 'dictionary', state: 'linked',
    },
    {
      worldId: 'dev-world-2', worldName: 'Fen Crossing', itemId: 'dev-copy-2', itemName: 'Marsh Lore',
      kind: 'dictionary', state: 'local-replacement',
    },
  ];
}
