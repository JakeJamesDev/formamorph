/**
 * The mascot preset store: the Default mascot and the player's own, each a named rig. The Default mascot is
 * read-only and reads its rig from the code, so each release updates it. Custom mascots hold their images by
 * id in the mascot image store; a duplicate shares its source's ids.
 */
import { isRecord } from '@/lib/tools/toolValidation';
import { DEFAULT_MASCOT_RIG, parseMascotRig, type MascotRig } from './mascot';
import { mascotImageIds } from './mascotRigEdits';

export interface MascotPreset {
  readonly id: string;
  readonly name: string;
  readonly rig: MascotRig;
}

/** The active mascot id and every custom mascot. The Default mascot is virtual, never stored. */
export interface MascotPresetStore {
  readonly activeId: string;
  readonly mascots: readonly MascotPreset[];
}

export const DEFAULT_MASCOT_ID = 'default';
export const DEFAULT_MASCOT_NAME = 'Default';

/** The store of a player who has made no mascot. */
export const EMPTY_MASCOT_PRESET_STORE: MascotPresetStore = { activeId: DEFAULT_MASCOT_ID, mascots: [] };

/** The Default mascot, from the code of this build. */
export const defaultMascotPreset = (): MascotPreset => ({ id: DEFAULT_MASCOT_ID, name: DEFAULT_MASCOT_NAME, rig: DEFAULT_MASCOT_RIG });

const customOf = (store: MascotPresetStore, id: string): MascotPreset | undefined => store.mascots.find((mascot) => mascot.id === id);

/** The mascot `id` names: a custom mascot, else the Default mascot. */
export const mascotPresetOf = (store: MascotPresetStore, id: string): MascotPreset => customOf(store, id) ?? defaultMascotPreset();

export const activeMascotPreset = (store: MascotPresetStore): MascotPreset => mascotPresetOf(store, store.activeId);

/** The rig the window, the face call and AI Context draw from. */
export const activeMascotRig = (store: MascotPresetStore): MascotRig => activeMascotPreset(store).rig;

/** True when `id` names no custom mascot, so it reads as the Default, which refuses edits. */
export const isDefaultMascot = (store: MascotPresetStore, id: string): boolean => customOf(store, id) === undefined;

/** Selects a mascot. An id no mascot holds selects the Default. */
export const selectMascotPreset = (store: MascotPresetStore, id: string): MascotPresetStore =>
  ({ ...store, activeId: customOf(store, id)?.id ?? DEFAULT_MASCOT_ID });

/** Adds a mascot under `id` and selects it. */
export const addMascotPreset = (store: MascotPresetStore, mascot: MascotPreset): MascotPresetStore =>
  ({ activeId: mascot.id, mascots: [...store.mascots, mascot] });

/** Adds a copy of the mascot `sourceId` names, sharing its images, and selects it. */
export const duplicateMascotPreset = (store: MascotPresetStore, sourceId: string, id: string, name: string): MascotPresetStore =>
  addMascotPreset(store, { id, name, rig: mascotPresetOf(store, sourceId).rig });

const withCustom = (store: MascotPresetStore, id: string, change: (mascot: MascotPreset) => MascotPreset): MascotPresetStore =>
  (customOf(store, id) === undefined ? store : { ...store, mascots: store.mascots.map((mascot) => (mascot.id === id ? change(mascot) : mascot)) });

export const renameMascotPreset = (store: MascotPresetStore, id: string, name: string): MascotPresetStore =>
  withCustom(store, id, (mascot) => ({ ...mascot, name }));

/** Writes a rig to a custom mascot. The Default refuses it. */
export const saveMascotRig = (store: MascotPresetStore, id: string, rig: MascotRig): MascotPresetStore =>
  withCustom(store, id, (mascot) => ({ ...mascot, rig }));

/** Removes a custom mascot. When it was active, the Default becomes active. */
export function deleteMascotPreset(store: MascotPresetStore, id: string): MascotPresetStore {
  if (customOf(store, id) === undefined) return store;
  return { activeId: store.activeId === id ? DEFAULT_MASCOT_ID : store.activeId, mascots: store.mascots.filter((mascot) => mascot.id !== id) };
}

/** `name`, or `name 2`, `name 3` and on: the first that no mascot, the Default included, has. */
export function uniqueMascotName(store: MascotPresetStore, name: string): string {
  const taken = new Set([DEFAULT_MASCOT_NAME, ...store.mascots.map((mascot) => mascot.name)]);
  if (!taken.has(name)) return name;
  let n = 2;
  while (taken.has(`${name} ${n}`)) n++;
  return `${name} ${n}`;
}

/** Every image id the store's mascots reference. */
export const mascotStoreImageIds = (store: MascotPresetStore): ReadonlySet<string> =>
  new Set(store.mascots.flatMap((mascot) => [...mascotImageIds(mascot.rig)]));

/** The ids of `candidates` that no mascot of `store` references: the images to delete. */
export function unreferencedMascotImages(candidates: Iterable<string>, store: MascotPresetStore): string[] {
  const kept = mascotStoreImageIds(store);
  return [...new Set(candidates)].filter((id) => !kept.has(id));
}

function readMascot(value: unknown): MascotPreset | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '' || value.id === DEFAULT_MASCOT_ID) return null;
  if (typeof value.name !== 'string' || !isRecord(value.rig)) return null;
  return { id: value.id, name: value.name, rig: parseMascotRig(value.rig) };
}

/**
 * The store as stored on the device. A value that is not a store reads as the empty store; a mascot that is
 * not well formed or repeats an id is dropped; an active id no kept mascot holds reads as the Default.
 */
export function parseMascotPresetStore(value: unknown): MascotPresetStore {
  if (!isRecord(value) || !Array.isArray(value.mascots)) return EMPTY_MASCOT_PRESET_STORE;
  const seen = new Set<string>();
  const mascots = value.mascots.flatMap((entry) => {
    const mascot = readMascot(entry);
    if (!mascot || seen.has(mascot.id)) return [];
    seen.add(mascot.id);
    return [mascot];
  });
  return selectMascotPreset({ activeId: DEFAULT_MASCOT_ID, mascots }, typeof value.activeId === 'string' ? value.activeId : DEFAULT_MASCOT_ID);
}
