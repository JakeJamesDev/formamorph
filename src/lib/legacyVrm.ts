import { normalizeCustomVRM } from './worldImport';
import { vrmDisplayName } from './worldVrmStore';
import { customPersonaEntity } from './blueprints';
import { DEFAULT_AVATAR_ID, LEGACY_DEFAULT_AVATAR_ID, LEGACY_DEFAULT_AVATAR_SENTINEL } from './defaultAvatar';
import type { CharacterData, ChosenVrm, Entity, VrmPick, WorldOverview, WorldVrmStore } from '@/types';

// Worlds and saves from before per-entity Avatars: the old 3D Player Avatar flag and world Avatar become a
// store entry and a hidden fallback, and a save's old player model becomes its chosen Avatar.

/** The store id the old world Avatar moves to. Fixed, because the migration runs on every load and stored
 *  worlds are not rewritten. */
export const LEGACY_VRM_ID = 'legacy-player-avatar';

/**
 * Move a world's old `use3DModel` flag and `customPlayerVRM` (or the v1.2 root key) into the Avatar store
 * and `legacyVrmFallback`. Only an explicit `true` sets the fallback: the old Avatar when there is one, else
 * User's Default. An old Avatar under a flag that is off still moves, with no fallback. Idempotent: a world
 * without the old keys keeps what it has.
 */
export function migrateLegacyPlayerAvatar(world: Record<string, unknown>): void {
  const raw = world.worldOverview;
  const overview: Record<string, unknown> = raw && typeof raw === 'object' ? { ...raw } : {};
  const hasFlag = 'use3DModel' in overview;
  const oldVrm = overview.customPlayerVRM ?? world.customPlayerVRM;
  if (!hasFlag && oldVrm === undefined) return;
  const file = normalizeCustomVRM(oldVrm);
  if (file) {
    const name = (oldVrm as { name?: unknown }).name;
    if (typeof name === 'string' && name) file.name = name;
    const store = (overview.vrmStore && typeof overview.vrmStore === 'object' ? overview.vrmStore : {}) as WorldVrmStore;
    overview.vrmStore = { ...store, [LEGACY_VRM_ID]: { name: vrmDisplayName(file.name), file } };
  }
  if (overview.use3DModel === true) {
    const fallback: VrmPick = file ? { kind: 'world', id: LEGACY_VRM_ID } : { kind: 'default' };
    overview.legacyVrmFallback = fallback;
  }
  delete overview.use3DModel;
  delete overview.customPlayerVRM;
  delete world.customPlayerVRM;
  world.worldOverview = overview;
}

/** The overview without its fallback once the Custom Persona has a pick: the world then holds one rule. */
export function withoutSpentFallback(overview: WorldOverview, entities: readonly Entity[]): WorldOverview {
  if (!overview.legacyVrmFallback || !customPersonaEntity(entities)?.vrmPick) return overview;
  const { legacyVrmFallback: _spent, ...rest } = overview;
  return rest;
}

/** Character data as a save made before per-entity Avatars holds it. */
export type LegacyCharacterData = CharacterData & { playerModelId?: string };

/** The two older ids of the bundled Avatar, both meaning its seeded library copy. */
export const LEGACY_DEFAULT_AVATAR_VALUES: readonly unknown[] = [LEGACY_DEFAULT_AVATAR_SENTINEL, LEGACY_DEFAULT_AVATAR_ID];

/**
 * A save's character data with its pre-per-entity `playerModelId` turned into `chosenVrm`, at game load where
 * the world's store is known. Unset or `'world'` becomes the legacy store entry when the world has one, else
 * no choice. A library id stays, marked legacy. Data that already carries `chosenVrm` passes through.
 */
export function remapChosenVrm(
  data: CharacterData | null | undefined, store: WorldVrmStore | undefined,
): CharacterData | null {
  if (!data) return null;
  if (data.chosenVrm !== undefined) return data;
  const { playerModelId: old, ...rest } = data as LegacyCharacterData;
  const id = LEGACY_DEFAULT_AVATAR_VALUES.includes(old) ? DEFAULT_AVATAR_ID : old;
  const chosenVrm: ChosenVrm | null = typeof id === 'string' && id && id !== 'world'
    ? { pick: { kind: 'library', id }, legacy: true }
    : store && Object.hasOwn(store, LEGACY_VRM_ID) ? { pick: { kind: 'world', id: LEGACY_VRM_ID }, legacy: true }
    : null;
  return { ...rest, chosenVrm };
}

/** Default Avatar customization: no colors, so the model keeps its own. */
export const defaultCharacterData: CharacterData = {
  bodyMorphs: {},
  currentHairStyle: '',
  hairLength: 0,
  hairTypes: {
    ponytail: { shapekey: 'Hair', canChangeLength: true },
    bobcut: { shapekey: 'Hair001', canChangeLength: false },
  },
  chosenVrm: null,
};

/** The character data a playthrough holds: its own, else the defaults when the played side shows an Avatar. */
export const seededCharacterData = (data: CharacterData | null, showsAvatar: boolean): CharacterData | null =>
  data ?? (showsAvatar ? defaultCharacterData : null);
