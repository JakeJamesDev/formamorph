/**
 * The Mascot tab's draft: one immutable copy of the selected mascot's rig that only Save writes to the
 * store. Images leave the image store only at Save or Cancel, and only when no mascot references them.
 */
import { DEFAULT_MASCOT_RIG, type MascotRig } from './mascot';
import { mascotImageIds } from './mascotRigEdits';
import { activeMascotPreset, saveMascotRig, unreferencedMascotImages, type MascotPresetStore } from './mascotPresets';

export interface MascotDraft {
  /** The mascot the draft edits. */
  readonly mascotId: string;
  /** The rig the draft started from. */
  readonly saved: MascotRig;
  readonly rig: MascotRig;
  /** Every stored image id the draft has referenced, so Save and Cancel can drop the ones left behind. */
  readonly touched: ReadonlySet<string>;
}

/** A clean draft of the active mascot. */
export function openMascotDraft(store: MascotPresetStore): MascotDraft {
  const { id, rig } = activeMascotPreset(store);
  return { mascotId: id, saved: rig, rig, touched: mascotImageIds(rig) };
}

export const editMascotDraft = (draft: MascotDraft, rig: MascotRig): MascotDraft =>
  ({ ...draft, rig, touched: new Set([...draft.touched, ...mascotImageIds(rig)]) });

/** The draft with `ids` marked as its own uploads, so Save and Cancel drop them even when no rig holds them. */
export const touchMascotDraft = (draft: MascotDraft, ids: Iterable<string>): MascotDraft =>
  ({ ...draft, touched: new Set([...draft.touched, ...ids]) });

/** The draft with the Default mascot's rig. */
export const resetMascotDraft = (draft: MascotDraft): MascotDraft => editMascotDraft(draft, DEFAULT_MASCOT_RIG);

/** Structural equality of plain data: rigs are JSON-shaped. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every((key) => same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

export const isMascotDraftDirty = (draft: MascotDraft): boolean => !same(draft.rig, draft.saved);

/** The store with the draft written, and the images no mascot references after it. */
export function saveMascotDraft(store: MascotPresetStore, draft: MascotDraft): { store: MascotPresetStore; orphans: string[] } {
  const next = saveMascotRig(store, draft.mascotId, draft.rig);
  return { store: next, orphans: unreferencedMascotImages(draft.touched, next) };
}

/** The images the dropped draft leaves that no mascot of the store references. */
export const cancelMascotDraft = (store: MascotPresetStore, draft: MascotDraft): string[] => unreferencedMascotImages(draft.touched, store);
