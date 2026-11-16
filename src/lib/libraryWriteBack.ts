import { toast } from 'react-toastify';
import { toastError } from '@/lib/linkToast';
import { planWriteBack, type LinkStamp, type WorldContent } from '@/lib/linkedContent';
import { kindOf, loadLinkedSources, replaceLibraryItemContent, toLibraryItem } from '@/lib/librarySources';
import { traitWorldOf } from '@/lib/portableTraits';
import { loadVrmLookup, withLibraryPick } from '@/lib/libraryVrm';
import { loadMediaLookup } from '@/lib/libraryMedia';
import type { Entity, GameLocation, MediaList, Placeholder, Stat, StatGroup, SupporterCopyMarker, Trait, TraitGroup, WorldVrmStore } from '@/types';

/** What a world save hands over: its content, the combined placeholder pool its chips point at, its
 *  locations, which an entity's membership is named against, and its traits, which owned trait requirements
 *  are named against. */
export interface WorldToWriteBack extends WorldContent {
  /** The writing world's id, which a marked item's source world must match. */
  worldId: string;
  placeholders: Placeholder[];
  locations: GameLocation[];
  traits: Trait[];
  traitGroups: TraitGroup[];
  /** The world's stats, which a stat Condition's global item is read against. */
  stats?: Stat[];
  statGroups?: StatGroup[];
  /** The world's Avatar store, which a copy's Avatar pick names. */
  vrmStore?: WorldVrmStore;
  /** The world's Media List, which a copy's gallery links name. */
  mediaList?: MediaList;
  /** The world's Supporter Copy marker: undefined while unread, null for a plain world. */
  supporterCopy: SupporterCopyMarker | null | undefined;
}

/** Writes each planned copy to its item, and returns the link records of the writes that landed. */
export type OwnedWriteBack = () => Promise<LinkStamp[]>;

const NOTHING_TO_WRITE: OwnedWriteBack = async () => [];

/**
 * Plan the writes of every edited copy of an owned library item to that item. Nothing is written until the
 * save calls the result, after the world is stored, so a failed save leaves the library as it was. One
 * revision stamp per save. Last save wins: nothing checks whether the item moved on since the world opened.
 *
 * A Supporter Copy (or a world whose marker is unread) writes only to items marked for this world (R9), so
 * its edits never reach a library item the player can export or one from another source world.
 */
export async function planOwnedWriteBack(world: WorldToWriteBack): Promise<OwnedWriteBack> {
  const linkedIds = [...world.entities, ...world.dictionaries]
    .map((item) => item.link?.libraryId)
    .filter((id): id is string => !!id);
  if (!linkedIds.length) return NOTHING_TO_WRITE;
  let sources: Awaited<ReturnType<typeof loadLinkedSources>>;
  try {
    sources = await loadLinkedSources(linkedIds);
  } catch (error) {
    console.error('Could not read your library:', (error as Error).message);
    toastError(error, { headline: 'Could not read your library, so nothing was written to it.' });
    return NOTHING_TO_WRITE;
  }
  const sourceEntities = sources.flatMap((source) => (source.data && !('entries' in source.data) ? [source.data as Entity] : []));
  // Only linked copies are compared, so only theirs are hashed.
  const linkedEntities = world.entities.filter((entity) => entity.link?.libraryId);
  const [vrm, media] = await Promise.all([loadVrmLookup(world.vrmStore), loadMediaLookup([...linkedEntities, ...sourceEntities], world.mediaList)]);
  const marked = new Map(sources.flatMap((source) => (source.supporterCopy ? [[source.id, source.supporterCopy] as const] : [])));
  const plan = planWriteBack(world, sources, (copy) => toLibraryItem(copy, world.placeholders, world.locations, world, world.mediaList), traitWorldOf(world), vrm, media)
    .filter((step) => world.supporterCopy === null || marked.get(step.source.id)?.sourceWorldId === world.worldId);
  if (!plan.length) return NOTHING_TO_WRITE;
  const revision = new Date().toISOString();
  const planned = plan.map((step) => ({
    ...step,
    stamp: {
      id: step.copy.id,
      link: { ...step.copy.link, ...(step.connections && { connections: step.connections }), sourceName: step.content.name, sourceRevision: revision },
    },
  }));
  return async () => {
    const written: LinkStamp[] = [];
    for (const { copy, source, content, stamp } of planned) {
      try {
        await replaceLibraryItemContent(kindOf(copy), source.id, await withLibraryPick(content, world.vrmStore, world.supporterCopy ? marked.get(source.id) : undefined), revision);
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
