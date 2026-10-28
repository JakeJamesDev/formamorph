/**
 * The mascot preset store: the Default mascot and the player's own, each a named rig. The Default mascot is
 * read-only and reads its rig from the code, so each release updates it. A preset's name is the mascot's name:
 * the AI and the window know her by it, and the Default's is Morphie. Custom mascots hold their images by
 * id in the mascot image store; a duplicate shares its source's ids. A Supporter mascot is installed Supporter
 * content: read-only like the Default, held for the account it was installed for, its pixels in that cache.
 */
import { isRecord } from '@/lib/tools/toolValidation';
import type { CommunityLink } from '@/types';
import { DEFAULT_MASCOT_RIG, parseMascotRig, type MascotRig } from './mascot';
import { mascotImageIds } from './mascotRigEdits';

/** The Supporter content a Supporter mascot was built from, and the account it was installed for. */
export interface SupporterMascotSource {
  readonly listingId: string;
  readonly revision: number;
  readonly accountId: string;
}

/** A mascot and, for one downloaded from Community Creations, the listing it follows. */
export interface MascotPreset extends Readonly<CommunityLink> {
  readonly id: string;
  readonly name: string;
  readonly rig: MascotRig;
  readonly supporter?: SupporterMascotSource;
}

/** The active mascot id and every custom mascot. The Default mascot is virtual, never stored. */
export interface MascotPresetStore {
  readonly activeId: string;
  readonly mascots: readonly MascotPreset[];
}

export const DEFAULT_MASCOT_ID = 'default';
export const DEFAULT_MASCOT_NAME = 'Morphie';

/** The store of a player who has made no mascot. */
export const EMPTY_MASCOT_PRESET_STORE: MascotPresetStore = { activeId: DEFAULT_MASCOT_ID, mascots: [] };

/** The Default mascot, from the code of this build. */
export const defaultMascotPreset = (): MascotPreset => ({ id: DEFAULT_MASCOT_ID, name: DEFAULT_MASCOT_NAME, rig: DEFAULT_MASCOT_RIG });

const customOf = (store: MascotPresetStore, id: string): MascotPreset | undefined => store.mascots.find((mascot) => mascot.id === id);

/** The id a Supporter mascot takes, from its listing. */
export const supporterMascotId = (listingId: string): string => `supporter:${listingId}`;

export type MascotPresetKind = 'default' | 'custom' | 'supporter';

/** The kind of the mascot `id` names. An id no mascot holds reads as the Default. */
export function mascotPresetKind(store: MascotPresetStore, id: string): MascotPresetKind {
  const mascot = customOf(store, id);
  return !mascot ? 'default' : mascot.supporter ? 'supporter' : 'custom';
}

export type MascotPresetAction = 'edit' | 'rename' | 'delete' | 'duplicate' | 'export' | 'publish';

const ALLOWED: { readonly [K in MascotPresetKind]: ReadonlySet<MascotPresetAction> } = {
  default: new Set(['duplicate', 'export']),
  custom: new Set(['edit', 'rename', 'delete', 'duplicate', 'export', 'publish']),
  // No copy of the rig leaves the app.
  supporter: new Set(),
};

/** Whether a mascot of `kind` takes `action`. Every preset action asks this. */
export const mascotAllows = (kind: MascotPresetKind, action: MascotPresetAction): boolean => ALLOWED[kind].has(action);

/** The mascot `id` names: a custom mascot, else the Default mascot. */
export const mascotPresetOf = (store: MascotPresetStore, id: string): MascotPreset => customOf(store, id) ?? defaultMascotPreset();

export const activeMascotPreset = (store: MascotPresetStore): MascotPreset => mascotPresetOf(store, store.activeId);

/** The rig the window, the face call and AI Context draw from. */
export const activeMascotRig = (store: MascotPresetStore): MascotRig => activeMascotPreset(store).rig;

/** True when `id` names no custom mascot, so it reads as the Default. */
export const isDefaultMascot = (store: MascotPresetStore, id: string): boolean => customOf(store, id) === undefined;

const allows = (store: MascotPresetStore, id: string, action: MascotPresetAction) => mascotAllows(mascotPresetKind(store, id), action);

/** Selects a mascot. An id no mascot holds selects the Default. */
export const selectMascotPreset = (store: MascotPresetStore, id: string): MascotPresetStore =>
  ({ ...store, activeId: customOf(store, id)?.id ?? DEFAULT_MASCOT_ID });

/** Adds a mascot under `id` and selects it. */
export const addMascotPreset = (store: MascotPresetStore, mascot: MascotPreset): MascotPresetStore =>
  ({ activeId: mascot.id, mascots: [...store.mascots, mascot] });

/** Adds a copy of the mascot `sourceId` names, sharing its images, and selects it. A mascot that refuses copies is left alone. */
export const duplicateMascotPreset = (store: MascotPresetStore, sourceId: string, id: string, name: string): MascotPresetStore =>
  (allows(store, sourceId, 'duplicate') ? addMascotPreset(store, { id, name, rig: mascotPresetOf(store, sourceId).rig }) : store);

/** Applies `change` to the mascot `id` names when it takes `action`. */
const withAllowed = (store: MascotPresetStore, id: string, change: (mascot: MascotPreset) => MascotPreset, action: MascotPresetAction = 'edit'): MascotPresetStore =>
  (allows(store, id, action) ? { ...store, mascots: store.mascots.map((mascot) => (mascot.id === id ? change(mascot) : mascot)) } : store);

/** An edit to a copy that follows a listing: it no longer matches what the listing served. */
const edited = (mascot: MascotPreset): Pick<MascotPreset, 'dirty'> => (mascot.sourceId ? { dirty: true } : {});

export const renameMascotPreset = (store: MascotPresetStore, id: string, name: string): MascotPresetStore =>
  withAllowed(store, id, (mascot) => (mascot.name === name ? mascot : { ...mascot, name, ...edited(mascot) }), 'rename');

/** Writes a rig to a custom mascot. The Default refuses it. */
export const saveMascotRig = (store: MascotPresetStore, id: string, rig: MascotRig): MascotPresetStore =>
  withAllowed(store, id, (mascot) => ({ ...mascot, rig, ...edited(mascot) }));

/** Stores a mascot downloaded from a listing: replaces the copy with the same id, else adds it. The selection stays. */
export const putDownloadedMascot = (store: MascotPresetStore, mascot: MascotPreset): MascotPresetStore =>
  (customOf(store, mascot.id) === undefined
    ? { ...store, mascots: [...store.mascots, mascot] }
    : { ...store, mascots: store.mascots.map((held) => (held.id === mascot.id ? mascot : held)) });

/** The listing a published mascot links to. */
export type MascotListingLink = Required<Pick<CommunityLink, 'sourceId'>> & Pick<CommunityLink, 'sourceUpdatedAt' | 'sourceAuthorId' | 'sourceAuthorName'>;

/** Links a mascot to the listing it was just published as. Any older link is replaced whole, and the copy is clean. */
export const linkMascotPreset = (store: MascotPresetStore, id: string, link: MascotListingLink): MascotPresetStore =>
  withAllowed(store, id, (mascot) => {
    const { sourceUpdatedAt: _s, sourceAuthorId: _a, sourceAuthorName: _n, downloadedAt: _d, dirty: _x, ...content } = mascot;
    return { ...content, ...link };
  }, 'publish');

/** Removes a custom mascot. When it was active, the Default becomes active. */
export function deleteMascotPreset(store: MascotPresetStore, id: string): MascotPresetStore {
  if (!allows(store, id, 'delete')) return store;
  return { activeId: store.activeId === id ? DEFAULT_MASCOT_ID : store.activeId, mascots: store.mascots.filter((mascot) => mascot.id !== id) };
}

/**
 * The store with exactly `installed` as its Supporter mascots, each replacing the entry with its id. When the
 * active mascot was a Supporter mascot that is gone, the Default becomes active. Unchanged input gives `store`.
 */
export function reconcileSupporterMascots(store: MascotPresetStore, installed: readonly MascotPreset[]): MascotPresetStore {
  const held = store.mascots.filter((mascot) => mascot.supporter);
  if (held.length === installed.length && installed.every((mascot, index) => mascot === held[index])) return store;
  const mascots = [...store.mascots.filter((mascot) => !mascot.supporter), ...installed];
  const activeId = mascots.some((mascot) => mascot.id === store.activeId) ? store.activeId : DEFAULT_MASCOT_ID;
  return { activeId, mascots };
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

/** The community link fields a stored mascot carries. None without a source id. */
function readLink(value: Record<string, unknown>): CommunityLink {
  const text = (key: string): string | undefined => (typeof value[key] === 'string' && value[key] !== '' ? value[key] : undefined);
  const sourceId = text('sourceId');
  if (sourceId === undefined) return {};
  const link: CommunityLink = { sourceId, ...(value.dirty === true ? { dirty: true } : {}) };
  for (const key of ['downloadedAt', 'sourceUpdatedAt', 'sourceAuthorId', 'sourceAuthorName'] as const) {
    const field = text(key);
    if (field !== undefined) link[key] = field;
  }
  return link;
}

/** A stored Supporter source, or null when the value is not one or does not match the mascot's id. */
function readSupporter(value: unknown, id: string): SupporterMascotSource | null {
  if (!isRecord(value)) return null;
  const { listingId, revision, accountId } = value;
  if (typeof listingId !== 'string' || listingId === '' || supporterMascotId(listingId) !== id) return null;
  if (!Number.isInteger(revision) || typeof accountId !== 'string' || accountId === '') return null;
  return { listingId, revision: revision as number, accountId };
}

function readMascot(value: unknown): MascotPreset | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '' || value.id === DEFAULT_MASCOT_ID) return null;
  if (typeof value.name !== 'string' || !isRecord(value.rig)) return null;
  const mascot = { id: value.id, name: value.name, rig: parseMascotRig(value.rig) };
  if (value.supporter === undefined) return { ...mascot, ...readLink(value) };
  const supporter = readSupporter(value.supporter, value.id);
  return supporter ? { ...mascot, supporter } : null;
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
