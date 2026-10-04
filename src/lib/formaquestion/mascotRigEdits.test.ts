import { describe, it, expect } from 'vitest';
import { DEFAULT_MASCOT_RIG, composeMascot, type MascotImageRef, type MascotRig } from './mascot';
import {
  addMascotLayer, addMascotOverlays, moveMascotLayer, moveMascotOverlay, orphanedMascotImages, removeMascotBase,
  removeMascotLayer, removeMascotOverlay, setMascotBase, updateMascotLayer,
} from './mascotRigEdits';

const stored = (id: string): MascotImageRef => ({ kind: 'stored', id });
const layerIds = (rig: MascotRig) => rig.layers.map((row) => row.id);

describe('layer edits', () => {
  it('appends a new layer as an enabled, empty expression named New Layer', () => {
    const rig = addMascotLayer(DEFAULT_MASCOT_RIG, 'fresh');
    expect(rig.layers.at(-1)).toEqual({ id: 'fresh', name: 'New Layer', kind: 'expression', enabled: true, images: [] });
    expect(rig.layers).toHaveLength(DEFAULT_MASCOT_RIG.layers.length + 1);
  });

  it('renames, rekinds and switches one layer', () => {
    const rig = updateMascotLayer(DEFAULT_MASCOT_RIG, 'happy', { name: 'Glad', kind: 'state', enabled: false });
    expect(rig.layers.find((row) => row.id === 'happy')).toMatchObject({ name: 'Glad', kind: 'state', enabled: false });
    expect(rig.layers.find((row) => row.id === 'sad')).toEqual(DEFAULT_MASCOT_RIG.layers.find((row) => row.id === 'sad'));
  });

  it('moves a layer onto the place of another, and the draw order follows', () => {
    const rig = moveMascotLayer(DEFAULT_MASCOT_RIG, 'wave', 'thinking');
    expect(layerIds(rig).slice(0, 3)).toEqual(['rest', 'thinking', 'wave']);
  });

  it('ignores a move that names a layer the rig lacks', () => {
    expect(moveMascotLayer(DEFAULT_MASCOT_RIG, 'wave', 'nothing')).toBe(DEFAULT_MASCOT_RIG);
  });

  it('removes a layer and keeps a pick that named it', () => {
    const rig = removeMascotLayer(DEFAULT_MASCOT_RIG, 'wave');
    expect(layerIds(rig)).not.toContain('wave');
    expect(rig.picks.initial.state).toBe('wave');
  });
});

describe('overlay edits', () => {
  const rig = addMascotOverlays(DEFAULT_MASCOT_RIG, 'happy', [stored('a'), stored('b')]);
  const happy = (next: MascotRig) => next.layers.find((row) => row.id === 'happy')!.images;

  it('appends overlays in order, and the composition draws them on top', () => {
    expect(happy(rig).slice(-2)).toEqual([stored('a'), stored('b')]);
    expect(composeMascot(rig, 'answering', 'happy').slice(-2)).toEqual([stored('a'), stored('b')]);
  });

  it('removes one overlay by its place', () => {
    const next = removeMascotOverlay(rig, 'happy', 2);
    expect(happy(next)).toEqual([...happy(DEFAULT_MASCOT_RIG), stored('b')]);
  });

  it('moves one overlay to another place', () => {
    const next = moveMascotOverlay(rig, 'happy', 3, 0);
    expect(happy(next)[0]).toEqual(stored('b'));
    expect(happy(next)).toHaveLength(4);
  });
});

describe('base edits', () => {
  it('sets a stored base and removes it back to the bundled one', () => {
    const rig = setMascotBase(DEFAULT_MASCOT_RIG, stored('mine'));
    expect(rig.base).toEqual(stored('mine'));
    expect(removeMascotBase(rig).base).toEqual(DEFAULT_MASCOT_RIG.base);
  });
});

describe('orphanedMascotImages', () => {
  const rig = setMascotBase(
    addMascotOverlays(addMascotOverlays(DEFAULT_MASCOT_RIG, 'happy', [stored('shared'), stored('solo')]), 'sad', [stored('shared')]),
    stored('base'),
  );

  it('names a stored image that the edit left unreferenced', () => {
    expect(orphanedMascotImages(rig, removeMascotOverlay(rig, 'happy', 3))).toEqual(['solo']);
  });

  it('keeps an image another layer still references', () => {
    expect(orphanedMascotImages(rig, removeMascotOverlay(rig, 'happy', 2))).toEqual([]);
  });

  it('names every image only a removed layer held', () => {
    expect(orphanedMascotImages(rig, removeMascotLayer(rig, 'happy'))).toEqual(['solo']);
    expect(orphanedMascotImages(rig, removeMascotLayer(removeMascotLayer(rig, 'happy'), 'sad'))).toEqual(['shared', 'solo']);
  });

  it('names the base once it is removed', () => {
    expect(orphanedMascotImages(rig, removeMascotBase(rig))).toEqual(['base']);
  });

  it('names every stored image when the rig resets to the default', () => {
    expect(orphanedMascotImages(rig, DEFAULT_MASCOT_RIG).sort()).toEqual(['base', 'shared', 'solo']);
  });
});
