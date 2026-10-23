import { createStoredString } from './keyedStorage';

/** The bundled default player avatar. Single source of truth for VRMViewer's fallback avatar, the headless
 *  morph-name loader, and the copy seeded into the avatar library, so they all read the same file. */
export const DEFAULT_AVATAR_URL = './default-avatar.vrm';

/**
 * Library id of the seeded copy of the bundled avatar. Fixed rather than random so saves can name it and
 * `migrateSave` can fold the two older values onto it.
 *
 * It is an ordinary library record once seeded: deletable like any other, protected only by the library's
 * "never fewer than one avatar" rule.
 */
export const DEFAULT_AVATAR_ID = 'default-avatar';

/** Pre-library saves picked the bundled avatar by this sentinel; `migrateSave` rewrites it to the id above. */
export const LEGACY_DEFAULT_AVATAR_SENTINEL = 'default';

/** 2.5.0–2.9.2 id, back when the library called these models. `migrateSave` rewrites it in saves and
 *  `ModelStorageService` rekeys the stored record. */
export const LEGACY_DEFAULT_AVATAR_ID = 'default-model';

/** The player's default Avatar, a library id: what User's Default shows. Device-local, never exported. */
const userDefaultAvatar = createStoredString('local', 'FORMAMORPH_defaultAvatar');

export const readUserDefaultAvatar = (): string | undefined => userDefaultAvatar.read();
export const setUserDefaultAvatar = (modelId: string): void => userDefaultAvatar.write(modelId);
export const clearUserDefaultAvatar = (): void => userDefaultAvatar.clear();

/** The library Avatar a picker opens on: the device default, else the bundled copy, else the first. */
export const pickerStart = (libraryIds: readonly string[], deviceDefault: string | undefined): string =>
  [deviceDefault, DEFAULT_AVATAR_ID].find((id) => id && libraryIds.includes(id)) ?? libraryIds[0] ?? DEFAULT_AVATAR_ID;
