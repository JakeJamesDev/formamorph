import { describe, it, expect } from 'vitest';
import { DEFAULT_MASCOT_RIG, composeMascot, type MascotImageRef, type MascotRig } from './mascot';
import {
  addMascotLayer, addMascotOverlays, mascotPickOptions, moveMascotLayer, moveMascotOverlay, removeMascotBase,
  removeMascotLayer, removeMascotOverlay, setMascotBase, setMascotPick, updateMascotLayer,
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

describe('pick edits', () => {
  it('points one slot at a layer and leaves the other slot and picks alone', () => {
    const rig = setMascotPick(DEFAULT_MASCOT_RIG, 'idle', 'expression', 'happy');
    expect(rig.picks).toEqual({ ...DEFAULT_MASCOT_RIG.picks, idle: { expression: 'happy', state: 'rest' } });
  });

  it('empties a slot', () => {
    expect(setMascotPick(DEFAULT_MASCOT_RIG, 'thinking', 'state', null).picks.thinking).toEqual({ expression: 'pondering', state: null });
  });

  it('offers the enabled layers of one kind, in list order', () => {
    const rig = updateMascotLayer(updateMascotLayer(DEFAULT_MASCOT_RIG, 'rest', { enabled: false }), 'happy', { kind: 'state' });
    expect(mascotPickOptions(rig, 'state').map((row) => row.id)).toEqual(['wave', 'thinking', 'happy']);
    expect(mascotPickOptions(rig, 'expression').map((row) => row.id)).not.toContain('happy');
    expect(mascotPickOptions(rig, 'expression')[0].id).toBe('excited');
  });
});
