// Which image of each entity carries a Supporter mark: the Media List entry of its start picture.

import type { Entity, GalleryLink, MediaList, TraitRequirementRow, World } from '@/types';
import { galleryLinks, outsidePlayPicture } from './entityImages';
import { entitiesInTreeOrder } from './entityGroupTree';
import { startingGateStats } from './gateStats';
import { baseLayer, drawableLayered, shownVariant } from './layeredImages';
import { editorGateInput } from './owners';
import { ruleStates, type GateInput } from './traitGates';

/** One entity's mark pick: the image entry its start picture shows. */
export interface MarkPick {
  entityId: string;
  mediaId: string;
}

const holds = (input: GateInput, entityId: string, link: GalleryLink): boolean =>
  !link.requires?.length || ruleStates(input, entityId, link.requires).some((row) => row.holds);

/**
 * The image entry an entity's start picture shows, or undefined when it draws nothing or is not a Media List link.
 * The start picture is the first slot that draws and whose rule holds; a Layered Image picks its base Layer's Variant.
 */
function entityPick(entity: Entity, input: GateInput, media: MediaList | undefined): string | undefined {
  const reads = { statesOf: (rows: TraitRequirementRow[]) => ruleStates(input, entity.id, rows) };
  for (const link of galleryLinks(entity)) {
    if (!outsidePlayPicture(link, media) || !holds(input, entity.id, link)) continue;
    const layered = drawableLayered(link, media);
    if (!layered) return 'mediaId' in link ? link.mediaId : undefined;
    const base = baseLayer(layered);
    return base?.variants[shownVariant(base, media, reads)]?.mediaId;
  }
  return undefined;
}

/**
 * Each entity's mark pick in World Editor order, read at the world's starting values with no Opening drawn.
 * An entity whose start picture names no image entry has none.
 */
export function worldMarkPicks(world: Omit<World, 'id'>): MarkPick[] {
  const entities = world.entities ?? [];
  const overview = world.worldOverview ?? {};
  const input = editorGateInput(
    {
      traits: world.traits ?? [], traitGroups: world.traitGroups ?? [], entities,
      items: world.items, options: world.options, weather: overview.weather, defaultTime: overview.defaultTime,
    },
    startingGateStats({ stats: world.stats, statGroups: world.statGroups, entities }),
  );
  return entitiesInTreeOrder(world.entityGroups ?? [], entities).flatMap((entity) => {
    const mediaId = entityPick(entity, input, overview.mediaList);
    return mediaId ? [{ entityId: entity.id, mediaId }] : [];
  });
}
