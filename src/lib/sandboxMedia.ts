// What a script's media members read (Q52): the Media List's names, the overrides in force, and what each owner shows with none.

import type { Entity, GameLocation, GenericStates, Item, ItemInstance, LayeredMediaEntry, MediaList, MediaOverrides, TraitRequirementRow } from '@/types';
import type { SandboxLayeredImage, SandboxMedia, ScriptMediaEntry } from './statCodeExecutor';
import { ruleStates, type GateInput, type RowState } from './traitGates';
import { isMediaRef } from './mediaList';
import { liveMediaId } from './mediaOverrides';
import { itemRuleImageId, itemRuleStates, locationRuleImageId, locationRuleStates, ruleImageId } from './imageVisibility';
import { clampOpacity, layeredCanvas, normalizeTint, shownVariant } from './layeredImages';

/** The Layered Images that can draw: a script's `layers` names nothing in one with no canvas. */
const layeredEntries = (list: MediaList | undefined): LayeredMediaEntry[] =>
  Object.values(list ?? {}).filter((entry): entry is LayeredMediaEntry => entry.kind === 'layered' && !!layeredCanvas(entry, list));

/** The Layered Images as `layers` names them: Layers with their authored opacity and tint, as drawn, and their
 *  Variants' image ids. */
const sandboxLayered = (entries: readonly LayeredMediaEntry[]): SandboxLayeredImage[] => entries.map(({ id, layers }) => ({
  id, layers: layers.map((layer) => {
    const tint = normalizeTint(layer.tint);
    return { id: layer.id, name: layer.name, opacity: clampOpacity(layer.opacity), ...(tint && { tint }), variants: layer.variants.map((v) => v.mediaId) };
  }),
}));

/** Per Layered Image and Layer, the image entry id the rules show for one subject, or null (Q10). */
const rulePicks = (entries: readonly LayeredMediaEntry[], list: MediaList | undefined, statesOf: (rows: TraitRequirementRow[]) => RowState[]) =>
  Object.fromEntries(entries.map((entry) => [entry.id, Object.fromEntries(entry.layers.map((layer) =>
    [layer.id, layer.variants[shownVariant(layer, list, { statesOf })]?.mediaId ?? null]))]));

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
  const layered = layeredEntries(list);
  let built: GateInput | undefined;
  const input = () => (built ??= gate());
  const picks = (statesOf: (input: GateInput, rows: TraitRequirementRow[]) => RowState[]) => () =>
    rulePicks(layered, list, (rows) => statesOf(input(), rows));
  const itemOf = new Map(items.map((item) => [item.id, item]));
  const entityRules = (id: string) => picks((gates, rows) => ruleStates(gates, id, rows));
  const layerRules: NonNullable<SandboxMedia['layerRules']> = !layered.length ? {} : {
    ...Object.fromEntries(entities.map((entity) => [`e:${entity.id}`, entityRules(entity.id)])),
    ...(personaId && { 'e:': entityRules(personaId) }),
    ...Object.fromEntries(locations.map((location) => [`l:${location.id}`, picks(locationRuleStates)])),
    ...Object.fromEntries(itemInstances.flatMap((instance) =>
      (instance.item.kind === 'item' && itemOf.has(instance.item.itemId) ? [[`t:${instance.id}`, picks((gates, rows) => itemRuleStates(gates, instance, rows))]] : []))),
  };
  return {
    ...(layered.length ? { layered: sandboxLayered(layered), layerRules } : {}),
    entries: Object.values(list ?? {}).flatMap(({ id, name, kind }): ScriptMediaEntry[] => (kind === 'mask' ? [] : [{ id, name, kind }])),
    overrides: overrides ?? {},
    defaults: () => {
      const gates = input();
      const entityRows = Object.fromEntries(entities.map((entity) => {
        const image = ruleImageId(entity, gates, list);
        const sound = linkedSound(entity.sound, list);
        return [entity.id, { ...(image && { image }), ...(sound && { sound }) }];
      }));
      const played = personaId ? entityRows[personaId] : undefined;
      const instanceImages = itemInstances.flatMap((instance) => {
        const item = instance.item.kind === 'item' ? itemOf.get(instance.item.itemId) : undefined;
        const image = item && itemRuleImageId(item, instance, gates, list);
        return image ? [[instance.id, image]] : [];
      });
      const musicId = linkedSound(music, list);
      return {
        entities: { ...entityRows, ...(played && { '': played }) },
        locations: Object.fromEntries(locations.map((location) => {
          const image = locationRuleImageId(location, gates, list);
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
