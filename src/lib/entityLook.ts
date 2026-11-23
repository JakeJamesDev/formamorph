// What an entity's Layered Images show outside play: each Layer's Variant under the entity's starting values.

import type { Entity, MediaList } from '@/types';
import { primaryPicture } from './entityImages';
import type { LayerReads, Picture } from './layeredImages';
import { libraryGateInput } from './libraryGateInput';
import { ruleStates, type GateInput } from './traitGates';

/** Reads for entity `entityId` against `gateInput`, as Preview As reads them. */
export const entityLookReads = (gateInput: GateInput, entityId: string): LayerReads => ({
  statesOf: (rows) => ruleStates(gateInput, entityId, rows),
});

/** Reads for entity `entityId` from a gate input built at the first rule read, so a rig without rules builds none. */
export function lazyLookReads(build: () => GateInput, entityId: string): LayerReads {
  let input: GateInput | undefined;
  return { statesOf: (rows) => ruleStates((input ??= build()), entityId, rows) };
}

/** Reads for `entity` from its own traits and starting stats, with no world. */
export const carriedLookReads = (entity: Entity): LayerReads => lazyLookReads(() => libraryGateInput(entity, null), entity.id);

/** The entity's primary picture, its Layered Images read for its starting values. */
export const entityPicture = (entity: Entity | null | undefined, media?: MediaList): Picture | undefined =>
  (entity ? primaryPicture(entity, media, carriedLookReads(entity)) : undefined);
