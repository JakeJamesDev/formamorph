import type { Entity, OnMap } from '@/types';

/** The four values in editor order, with the label the control shows. */
export const ON_MAP_OPTIONS: readonly { value: OnMap; label: string }[] = [
  { value: 'always', label: 'Always' },
  { value: 'onceMet', label: 'Once Met' },
  { value: 'whenNearby', label: 'When Nearby' },
  { value: 'never', label: 'Never' },
];

/** The help line under the control, by value. */
export const ON_MAP_HELP: Record<OnMap, string> = {
  always: 'Shows it on the player’s map wherever it stands',
  onceMet: 'Hides it until the narration uses its Name. Needs a Stranger Name.',
  whenNearby: 'Shows it only in the player’s location and Nearby locations',
  never: 'Keeps it off the player’s map',
};

/** `raw` as an On Map value, or undefined when it is not one of the four. */
export const readOnMap = (raw: unknown): OnMap | undefined =>
  ON_MAP_OPTIONS.find((o) => o.value === raw)?.value;

/** The entity's On Map. Absent, or a value this build does not know, reads as Always. */
export const onMapOf = (entity: Pick<Entity, 'onMap'>): OnMap => readOnMap(entity.onMap) ?? 'always';

/** The field to store for `raw`: nothing for Always, an absent field or a value this build does not know. */
export function storedOnMap(raw: unknown): { onMap?: OnMap } {
  const value = readOnMap(raw);
  return value && value !== 'always' ? { onMap: value } : {};
}

/** A copy of `entity` with `onMap`; Always is stored as no field. */
export function withOnMap<T extends { onMap?: OnMap }>(entity: T, onMap: OnMap): T {
  const { onMap: _was, ...rest } = entity;
  return { ...rest, ...storedOnMap(onMap) } as T;
}
