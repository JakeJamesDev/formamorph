/**
 * Adding a linked copy of a library item to a world that is not open in the editor.
 *
 * The World Editor has its own path for this, because its world is held in memory and its copies are
 * committed by the next world save. A world in storage has neither, so the same steps run here: read what
 * the content expects, let the player answer, then write the copy and whatever the world gained for it in
 * one transaction.
 */

import { withEntityLocations } from '@/lib/entityPresence';
import { linkToSource, type LibrarySource, type LinkableContent } from '@/lib/linkedContent';
import { kindOf } from '@/lib/librarySources';
import { hasAuthoredOpenings, openingsEnabled, setOpeningsEnabled } from '@/lib/openings';
import { adoptBookPlaceholders, adoptEntityPlaceholders } from '@/lib/placeholderHomes';
import { randomUUID } from '@/lib/uuid';
import { unresolvedReferences, type ConnectionPlan, type ReferenceRow } from '@/lib/worldReferences';
import WorldStorageService from '@/services/WorldStorageService';
import type { Dictionary, Entity, GameLocation, Placeholder, WorldOverview } from '@/types';

/** The world slices this pass reads out of a stored record. */
interface StoredContent extends Record<string, unknown> {
  worldOverview?: WorldOverview;
  entities?: Entity[];
  dictionaries?: Dictionary[];
  placeholders?: Placeholder[];
  locations?: GameLocation[];
}

/** One stored world, named for a picker and for what a failure says. */
export interface StoredWorldRef {
  id: string;
  name: string;
}

/**
 * Every reference a copy of `content` would leave open in one stored world.
 *
 * @param worldId - The world the copy would join
 * @param content - The content about to be copied in
 * @returns The rows to answer, or none where the world already answers everything
 */
export async function storedWorldReferences(
  worldId: string, content: LinkableContent,
): Promise<ReferenceRow[]> {
  const data = await WorldStorageService.getWorldData(worldId) as StoredContent;
  return unresolvedReferences(content, {
    placeholders: data.placeholders ?? [],
    locations: data.locations ?? [],
  });
}

/**
 * Write one linked copy of `content` into a stored world.
 *
 * The copy takes a fresh id, so importing the same component twice never overwrites the first. Its chips
 * resolve through `plan`: a reference answered with one of the world's own follows it, and one answered
 * Create New joins the world as a placeholder of its own.
 *
 * @param worldId - The world to write into
 * @param content - The content to copy in
 * @param source - The library item the copy follows
 * @param plan - What each open reference resolves to here
 */
export async function addCopyToStoredWorld(
  worldId: string, content: LinkableContent, source: LibrarySource, plan: ConnectionPlan,
): Promise<void> {
  const kind = kindOf(content);
  await WorldStorageService.updateWorldContent(worldId, (raw) => {
    const data = raw as StoredContent;
    const shared = data.placeholders ?? [];
    const locations = data.locations ?? [];
    const withId = { ...content, id: randomUUID() } as LinkableContent;

    if (kind === 'dictionary') {
      const adopted = adoptBookPlaceholders(withId as Dictionary, shared, plan.placeholders);
      const book: Dictionary = {
        ...adopted.book,
        link: {
          ...linkToSource(source),
          ...(Object.keys(adopted.connections).length ? { connections: adopted.connections } : {}),
        },
      };
      return {
        ...data,
        dictionaries: [...(data.dictionaries ?? []), book],
        ...(adopted.toAdd.length ? { placeholders: [...shared, ...adopted.toAdd] } : {}),
      };
    }

    const adopted = adoptEntityPlaceholders(withId as Entity, shared, plan.placeholders);
    const places = [...locations, ...plan.newLocations];
    const known = new Set(places.map((place) => place.id));
    const { locationRefs = [], ...rest } = adopted.entity;
    // A membership the world cannot place is dropped rather than left pointing at a location it has not got.
    const used = Object.fromEntries(locationRefs.flatMap((ref) => {
      const id = plan.locations[ref.id] ?? ref.id;
      return known.has(id) ? [[ref.id, id]] : [];
    }));
    const connections = { ...adopted.connections, ...used };
    const entity: Entity = {
      ...withEntityLocations(rest as Entity, Object.values(used)),
      link: {
        ...linkToSource(source),
        ...(Object.keys(connections).length ? { connections } : {}),
      },
    };
    // A switched-off list would bench the arriving openings, so the copy switches it back on, exactly as
    // the World Editor's own add does.
    const kept = data.entities ?? [];
    const overview = hasAuthoredOpenings(entity) && !openingsEnabled(data.worldOverview, [...kept, entity])
      ? { worldOverview: { ...(data.worldOverview as WorldOverview), ...setOpeningsEnabled(true) } }
      : {};
    return {
      ...data,
      ...overview,
      entities: [...kept, entity],
      ...(adopted.toAdd.length ? { placeholders: [...shared, ...adopted.toAdd] } : {}),
      ...(plan.newLocations.length ? { locations: places } : {}),
    };
  });
}
