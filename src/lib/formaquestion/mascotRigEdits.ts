/**
 * The Mascot tab's edits to a rig, as pure functions, and the rule that names the stored images an edit
 * leaves unreferenced. Picks are never touched: a pick that names a removed layer stays and warns.
 */
import { DEFAULT_MASCOT_RIG, type MascotImageRef, type MascotLayer, type MascotRig } from './mascot';

/** The editable fields of a layer. */
export type MascotLayerPatch = Partial<Pick<MascotLayer, 'name' | 'kind' | 'enabled'>>;

const withLayers = (rig: MascotRig, layers: readonly MascotLayer[]): MascotRig => ({ ...rig, layers });

const mapLayer = (rig: MascotRig, id: string, edit: (row: MascotLayer) => MascotLayer): MascotRig =>
  withLayers(rig, rig.layers.map((row) => (row.id === id ? edit(row) : row)));

/** Moves the item at `from` to `to`, shifting the items between. */
function moved<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const addMascotLayer = (rig: MascotRig, id: string): MascotRig =>
  withLayers(rig, [...rig.layers, { id, name: 'New Layer', kind: 'expression', enabled: true, images: [] }]);

export const updateMascotLayer = (rig: MascotRig, id: string, patch: MascotLayerPatch): MascotRig =>
  mapLayer(rig, id, (row) => ({ ...row, ...patch }));

export const removeMascotLayer = (rig: MascotRig, id: string): MascotRig =>
  withLayers(rig, rig.layers.filter((row) => row.id !== id));

/** Moves the layer `id` to the place of the layer `over`. The rig comes back as is when either is missing. */
export function moveMascotLayer(rig: MascotRig, id: string, over: string): MascotRig {
  const from = rig.layers.findIndex((row) => row.id === id);
  const to = rig.layers.findIndex((row) => row.id === over);
  return from === -1 || to === -1 ? rig : withLayers(rig, moved(rig.layers, from, to));
}

export const addMascotOverlays = (rig: MascotRig, layerId: string, images: readonly MascotImageRef[]): MascotRig =>
  mapLayer(rig, layerId, (row) => ({ ...row, images: [...row.images, ...images] }));

export const removeMascotOverlay = (rig: MascotRig, layerId: string, index: number): MascotRig =>
  mapLayer(rig, layerId, (row) => ({ ...row, images: row.images.filter((_, at) => at !== index) }));

export const moveMascotOverlay = (rig: MascotRig, layerId: string, from: number, to: number): MascotRig =>
  mapLayer(rig, layerId, (row) => ({ ...row, images: moved(row.images, from, to) }));

export const setMascotBase = (rig: MascotRig, base: MascotImageRef): MascotRig => ({ ...rig, base });

/** The base goes back to the default rig's bundled one. */
export const removeMascotBase = (rig: MascotRig): MascotRig => setMascotBase(rig, DEFAULT_MASCOT_RIG.base);

/** Every image a rig draws from: its base, then each layer's overlays. */
export const mascotImageRefs = (rig: MascotRig): readonly MascotImageRef[] => [rig.base, ...rig.layers.flatMap((row) => row.images)];

/** The store ids a rig references. */
export function mascotImageIds(rig: MascotRig): ReadonlySet<string> {
  return new Set(mascotImageRefs(rig).flatMap((ref) => (ref.kind === 'stored' ? [ref.id] : [])));
}

/** The store ids `before` references and `after` does not: the images an edit leaves to delete. */
export function orphanedMascotImages(before: MascotRig, after: MascotRig): string[] {
  const kept = mascotImageIds(after);
  return [...mascotImageIds(before)].filter((id) => !kept.has(id));
}
