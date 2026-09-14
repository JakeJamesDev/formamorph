/**
 * DEV-only stand-in for one component-file import review. Dynamically imported by
 * `#dev?view=mainMenu&modal=importComponent`, so the review is reachable without an exported file that
 * names worlds this machine happens to hold.
 *
 * The file names two worlds. The first downloaded world here stands in for one you already have, so the
 * Add To Your Worlds section draws; with no downloaded world the review shows the other section alone,
 * which is what a file naming only worlds you lack looks like.
 */

import type { ComponentFileLinks } from '@/lib/componentFileLinks';
import type { LinkableContent } from '@/lib/linkedContent';
import WorldStorageService from '@/services/WorldStorageService';
import type { Entity } from '@/types';

/** The character the sample file carries. */
export function devImportContent(): LinkableContent {
  return {
    id: 'dev-file-content',
    name: 'Wren the Guide',
    type: 'guide',
    playerDescription: 'A ferrywoman who knows every channel in the fen.',
    aiDescription: 'Wren runs the ferry at dawn and dusk, and trades in directions.',
    tags: ['guide', 'marsh'],
  } as Entity;
}

/** What the sample file says about where it came from and which worlds it suits. */
export async function devImportLinks(): Promise<ComponentFileLinks> {
  const worlds = await WorldStorageService.getWorldMetadata().catch(() => []);
  const installed = worlds.find((world) => world.sourceId);
  return {
    associations: [
      ...(installed ? [{ id: installed.sourceId!, name: installed.name }] : []),
      { id: 'dev-listing-thaw', name: 'The Long Thaw' },
    ],
  };
}
