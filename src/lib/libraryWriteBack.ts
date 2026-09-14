import { toast } from 'react-toastify';
import { planWriteBack, type LibrarySource, type LinkStamp, type WorldContent } from '@/lib/linkedContent';
import { kindOf, loadLinkedSources, replaceLibraryItemContent, toLibraryItem } from '@/lib/librarySources';
import type { GameLocation, Placeholder } from '@/types';

/** What a world save hands over: its content, the combined placeholder pool its chips point at, and its
 *  locations, which an entity's membership is named against. */
export interface WorldToWriteBack extends WorldContent {
  placeholders: Placeholder[];
  locations: GameLocation[];
}

/**
 * Write every edited copy of an owned library item to that item, ahead of the world save. Returns the
 * link records the save writes onto those copies, so each holds the revision it wrote. One revision stamp
 * per save. Last save wins: nothing checks whether the item moved on since the world opened. A write that
 * fails is named and skipped, and a library that cannot be read writes nothing; the world save goes ahead
 * either way.
 */
export async function writeBackOwnedCopies(world: WorldToWriteBack): Promise<LinkStamp[]> {
  const linkedIds = [...world.entities, ...world.dictionaries]
    .map((item) => item.link?.libraryId)
    .filter((id): id is string => !!id);
  if (!linkedIds.length) return [];
  let sources: LibrarySource[];
  try {
    sources = await loadLinkedSources(linkedIds);
  } catch (error) {
    console.error('Could not read your library:', (error as Error).message);
    toast.error('Could not read your library, so nothing was written to it.');
    return [];
  }
  const plan = planWriteBack(world, sources, (copy) => toLibraryItem(copy, world.placeholders, world.locations));
  if (!plan.length) return [];
  const revision = new Date().toISOString();
  const stamps: LinkStamp[] = [];
  for (const { copy, source, content } of plan) {
    try {
      await replaceLibraryItemContent(kindOf(copy), source.id, content, revision);
      stamps.push({ id: copy.id, link: { ...copy.link, sourceName: content.name, sourceRevision: revision } });
    } catch (error) {
      toast.error(`Could not write “${source.name}” to your library: ${(error as Error).message}`);
    }
  }
  if (stamps.length) {
    toast.info(stamps.length === 1
      ? 'Formamorph saved one linked copy to your library.'
      : `Formamorph saved ${stamps.length} linked copies to your library.`);
  }
  return stamps;
}
