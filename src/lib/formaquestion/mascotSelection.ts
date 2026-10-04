import { composeMascot, type MascotImageRef, type MascotLayer, type MascotRig } from './mascot';

/** What the Mascot tab previews: a layer, or one overlay of it by its place in the layer. */
export interface MascotSelection {
  readonly layerId: string;
  readonly overlay: number | null;
}

/** A selection read against the rig as it is now. */
export interface ShownSelection {
  readonly layer: MascotLayer;
  readonly overlay: number | null;
}

/** The selected layer and overlay, or null. A gone layer reads as no selection, a gone overlay as its layer. */
export function resolveSelection(rig: MascotRig, selection: MascotSelection | null): ShownSelection | null {
  const layer = selection && rig.layers.find((row) => row.id === selection.layerId);
  if (!layer) return null;
  const overlay = selection.overlay !== null && selection.overlay < layer.images.length ? selection.overlay : null;
  return { layer, overlay };
}

/**
 * The tab preview's images: the Idle look with nothing selected, the base under every overlay of a selected
 * layer, or the base under one selected overlay.
 */
export function previewMascot(rig: MascotRig, selection: MascotSelection | null): readonly MascotImageRef[] {
  const shown = resolveSelection(rig, selection);
  // An answer with no face from the AI draws the Idle look.
  if (!shown) return composeMascot(rig, 'answering', null);
  return shown.overlay === null ? [rig.base, ...shown.layer.images] : [rig.base, shown.layer.images[shown.overlay]];
}

/** A layer row's click: selects the layer, or collapses it when the layer alone is already selected. */
export const selectLayer = (selection: MascotSelection | null, layerId: string): MascotSelection | null =>
  (selection?.layerId === layerId && selection.overlay === null ? null : { layerId, overlay: null });

/** A layer's chevron: opens it selected, or collapses it. */
export const toggleLayer = (selection: MascotSelection | null, layerId: string): MascotSelection | null =>
  (selection?.layerId === layerId ? null : { layerId, overlay: null });

/** An overlay's click: selects it, or returns to its layer when it is already selected. */
export const selectOverlay = (selection: MascotSelection | null, layerId: string, index: number): MascotSelection =>
  ({ layerId, overlay: selection?.layerId === layerId && selection.overlay === index ? null : index });

/** The selection once a layer goes. */
export const selectionAfterLayerRemove = (selection: MascotSelection | null, layerId: string): MascotSelection | null =>
  (selection?.layerId === layerId ? null : selection);

/** The selection once an overlay goes: the selected one falls back to its layer, a later one keeps its image. */
export function selectionAfterRemove(selection: MascotSelection | null, layerId: string, index: number): MascotSelection | null {
  if (selection?.layerId !== layerId || selection.overlay === null || selection.overlay < index) return selection;
  return { layerId, overlay: selection.overlay === index ? null : selection.overlay - 1 };
}

/** The selection once an overlay moves, still on the same image. */
export function selectionAfterMove(selection: MascotSelection | null, layerId: string, from: number, to: number): MascotSelection | null {
  if (selection?.layerId !== layerId || selection.overlay === null) return selection;
  const at = selection.overlay;
  if (at === from) return { layerId, overlay: to };
  if (from < at && at <= to) return { layerId, overlay: at - 1 };
  if (to <= at && at < from) return { layerId, overlay: at + 1 };
  return selection;
}
