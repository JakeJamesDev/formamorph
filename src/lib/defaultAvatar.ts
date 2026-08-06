/** The bundled default player avatar. Single source of truth for VRMViewer's fallback avatar, the headless
 *  morph-name loader, and the copy seeded into the avatar library, so they all read the same file. */
export const DEFAULT_AVATAR_URL = './default-avatar.vrm';

/**
 * Library id of the seeded copy of the bundled avatar. Fixed rather than random so saves can name it and
 * `migrateSave` can fold the old `'default'` sentinel onto it.
 *
 * The value stays `default-model`: it is written into stored saves and library records, so changing the
 * string would orphan every avatar seeded before the rename.
 *
 * It is an ordinary library record once seeded: deletable like any other, protected only by the library's
 * "never fewer than one avatar" rule.
 */
export const DEFAULT_AVATAR_ID = 'default-model';

/** Pre-library saves picked the bundled avatar by this sentinel; `migrateSave` rewrites it to the id above. */
export const LEGACY_DEFAULT_AVATAR_SENTINEL = 'default';
