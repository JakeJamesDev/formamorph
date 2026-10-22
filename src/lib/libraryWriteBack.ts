import { toast } from 'react-toastify';
import { toastError } from '@/lib/linkToast';
import { planWriteBack, type LibrarySource, type LinkStamp, type WorldContent } from '@/lib/linkedContent';
import { kindOf, loadLinkedSources, replaceLibraryItemContent, toLibraryItem } from '@/lib/librarySources';
import { traitWorldOf } from '@/lib/portableTraits';
import { loadVrmLookup, withLibraryPick } from '@/lib/libraryVrm';
import type { GameLocation, Placeholder, Stat, StatGroup, Trait, TraitGroup, WorldVrmStore } from '@/types';

/** What a world save hands over: its content, the combined placeholder pool its chips point at, its
 *  locations, which an entity's membership is named against, and its traits, which owned trait requirements
 *  are named against. */
export interface WorldToWriteBack extends WorldContent {
  placeholders: Placeholder[];
  locations: GameLocation[];
  traits: Trait[];
  traitGroups: TraitGroup[];
  /** The world's stats, which a stat Condition's global item is read against. */
  stats?: Stat[];
  statGroups?: StatGroup[];
  /** The world's Avatar store, which a copy's Avatar pick names. */
  vrmStore?: WorldVrmStore;
}

/** Writes each planned copy to its item, and returns the link records of the writes that landed. */
export type OwnedWriteBack = () => Promise<LinkStamp[]>;

const NOTHING_TO_WRITE: OwnedWriteBack = async () => [];

/**
 * Plan the writes of every edited copy of an owned library item to that item. Nothing is written until the
 * save calls the result, after the world is stored, so a failed save leaves the library as it was. One
 * revision stamp per save. Last save wins: nothing checks whether the item moved on since the world opened.
 */
export async function planOwnedWriteBack(world: WorldToWriteBack): Promise<OwnedWriteBack> {
  const linkedIds = [...world.entities, ...world.dictionaries]
    .map((item) => item.link?.libraryId)
    .filter((id): id is string => !!id);
  if (!linkedIds.length) return NOTHING_TO_WRITE;
  let sources: LibrarySource[];
  try {
    sources = await loadLinkedSources(linkedIds);
  } catch (error) {
    console.error('Could not read your library:', (error as Error).message);
    toastError(error, { headline: 'Could not read your library, so nothing was written to it.' });
    return NOTHING_TO_WRITE;
  }
  const vrm = await loadVrmLookup(world.vrmStore);
  const plan = planWriteBack(world, sources, (copy) => toLibraryItem(copy, world.placeholders, world.locations, world), traitWorldOf(world), vrm);
  if (!plan.length) return NOTHING_TO_WRITE;
  const revision = new Date().toISOString();
  const planned = plan.map((step) => ({
    ...step,
    stamp: { id: step.copy.id, link: { ...step.copy.link, sourceName: step.content.name, sourceRevision: revision } },
  }));
  return async () => {
    const written: LinkStamp[] = [];
    for (const { copy, source, content, stamp } of planned) {
      try {
        await replaceLibraryItemContent(kindOf(copy), source.id, await withLibraryPick(content, world.vrmStore), revision);
        written.push(stamp);
      } catch (error) {
        toastError(error, { headline: `Could not write “${source.name}” to your library: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
    if (written.length) {
      toast.info(written.length === 1
        ? 'Formamorph saved one linked copy to your library.'
        : `Formamorph saved ${written.length} linked copies to your library.`);
    }
    return written;
  };
}
