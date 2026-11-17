// What a script's media members read (Q52): the Media List's names, the overrides in force, and what each owner shows with none.

import type { Entity, GameLocation, GenericStates, Item, ItemInstance, MediaList, MediaOverrides } from '@/types';
import type { SandboxMedia } from './statCodeExecutor';
import type { GateInput } from './traitGates';
import { isMediaRef } from './mediaList';
import { liveMediaId } from './mediaOverrides';
import { itemRuleImageId, locationRuleImageId, ruleImageId } from './imageVisibility';

/** Each Generic entity's Generic Entity Instances in Start order, as `entities.X.instances` lists them. */
export const genericInstancesOf = (states: GenericStates | undefined): NonNullable<SandboxMedia['instances']> =>
  Object.fromEntries(Object.entries(states ?? {}).map(([id, byStart]) =>
    [id, Object.entries(byStart).map(([startId, state]) => ({ id: startId, ...(state.position && { locationId: state.position }) }))]));

/** The linked entry a single sound field holds, when the list has it as a sound. */
const linkedSound = (value: unknown, list: MediaList | undefined): string | undefined =>
  (isMediaRef(value) ? liveMediaId(list, value.mediaId, 'sound') : undefined);

/** What a run's media is built from: the Media List, the overrides in force and what the rules read. */
export interface SandboxMediaInput {
  list: MediaList | undefined;
  overrides: MediaOverrides | undefined;
  entities: readonly Pick<Entity, 'id' | 'images' | 'sound'>[];
  /** The played persona entity's id, whose media the empty key reads. */
  personaId?: string;
  locations: readonly Pick<GameLocation, 'id' | 'images' | 'ambientSound'>[];
  items: readonly Pick<Item, 'id' | 'images'>[];
  itemInstances: readonly ItemInstance[];
  /** World music as the overview stores it. */
  music: unknown;
  /** The gates the rules read, built on the first read with no override. */
  gate: () => GateInput;
  generics?: GenericStates;
}

/** The media a script run reads. What each owner shows with none is worked out on its first read. */
export function sandboxMediaOf({ list, overrides, entities, personaId, locations, items, itemInstances, music, gate, generics }: SandboxMediaInput): SandboxMedia {
  return {
    entries: Object.values(list ?? {}).map(({ id, name, kind }) => ({ id, name, kind })),
    overrides: overrides ?? {},
    defaults: () => {
      const input = gate();
      const itemOf = new Map(items.map((item) => [item.id, item]));
      const entityRows = Object.fromEntries(entities.map((entity) => {
        const image = ruleImageId(entity, input, list);
        const sound = linkedSound(entity.sound, list);
        return [entity.id, { ...(image && { image }), ...(sound && { sound }) }];
      }));
      const played = personaId ? entityRows[personaId] : undefined;
      const instanceImages = itemInstances.flatMap((instance) => {
        const item = instance.item.kind === 'item' ? itemOf.get(instance.item.itemId) : undefined;
        const image = item && itemRuleImageId(item, instance, input, list);
        return image ? [[instance.id, image]] : [];
      });
      const musicId = linkedSound(music, list);
      return {
        entities: { ...entityRows, ...(played && { '': played }) },
        locations: Object.fromEntries(locations.map((location) => {
          const image = locationRuleImageId(location, input, list);
          const ambience = linkedSound(location.ambientSound, list);
          return [location.id, { ...(image && { image }), ...(ambience && { ambience }) }];
        })),
        items: Object.fromEntries(instanceImages),
        ...(musicId && { music: musicId }),
      };
    },
    ...(generics && { instances: genericInstancesOf(generics) }),
  };
}
