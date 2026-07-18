/** The bundled default player VRM. Single source of truth for VRMViewer's fallback model, the headless
 *  morph-name loader, and the copy seeded into the model library, so they all read the same file. */
export const DEFAULT_MODEL_URL = './default-model.vrm';

/**
 * Library id of the seeded copy of the bundled model. Fixed rather than random so saves can name it and
 * `migrateSave` can fold the old `'default'` sentinel onto it.
 *
 * It is an ordinary library record once seeded: deletable like any other, protected only by the library's
 * "never fewer than one model" rule.
 */
export const DEFAULT_MODEL_ID = 'default-model';

/** Pre-library saves picked the bundled model by this sentinel; `migrateSave` rewrites it to the id above. */
export const LEGACY_DEFAULT_MODEL_SENTINEL = 'default';
