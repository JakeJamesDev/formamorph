import { describe, expect, it } from 'vitest';
import {
  addLayer, addVariants, listWithoutVariant, moveLayer, moveVariant, newLayeredEntry, removeLayer, removeVariant, renameLayer,
  setLayerBlend, setLayerOpacity, setLayerTint, setLayerTransition, setVariantRule,
} from './layeredEdit';
import { DEFAULT_MASCOT_TRANSITION } from './formaquestion/mascotTransition';
import { DEFAULT_LAYER_TRANSITION, OUTSIDE_PLAY, resolveLayered } from './layeredImages';
import type { LayeredMediaEntry, MediaList, TraitRequirementRow } from '@/types';

const image = (id: string) => ({ id, name: id, kind: 'image' as const, data: `data:${id}` });
const RULE: TraitRequirementRow[] = [{ all: [{ kind: 'stat', id: 'health', operator: '<', value: 50, unit: 'raw' }] }];

const rig = (): LayeredMediaEntry => ({
  id: 'rig', name: 'Rig', kind: 'layered', layers: [
    { id: 'body', name: 'Body', variants: [{ mediaId: 'body' }] },
    { id: 'face', name: 'Face', variants: [{ mediaId: 'hurt', requires: RULE }, { mediaId: 'calm' }] },
    { id: 'hat', name: 'Hat', variants: [{ mediaId: 'hat' }] },
  ],
});
const list = (entry = rig()): MediaList => ({ ...Object.fromEntries(['body', 'hurt', 'calm', 'hat'].map((id) => [id, image(id)])), [entry.id]: entry });
const names = (entry: LayeredMediaEntry) => entry.layers.map((l) => l.name);
const variants = (entry: LayeredMediaEntry, layerId: string) => entry.layers.find((l) => l.id === layerId)!.variants;

describe('newLayeredEntry', () => {
  it('names a new rig "Layered Image", suffixed past the names the list holds', () => {
    expect(newLayeredEntry({}, 'a')).toEqual({ id: 'a', name: 'Layered Image', kind: 'layered', layers: [] });
    const held = { x: { ...newLayeredEntry({}, 'x') }, y: { ...image('y'), name: 'layered image (2)' } };
    expect(newLayeredEntry(held, 'b').name).toBe('Layered Image (3)');
  });
});

describe('Layer edits', () => {
  it('adds a top Layer named "Layer", suffixed within the rig', () => {
    const once = addLayer(rig(), 'l1');
    const twice = addLayer(once.entry, 'l2');
    expect(names(twice.entry)).toEqual(['Body', 'Face', 'Hat', 'Layer', 'Layer (2)']);
    expect(twice.layerId).toBe('l2');
    expect(variants(twice.entry, 'l2')).toEqual([]);
  });

  it('renames a Layer to a name unique in the rig, and ignores a blank one', () => {
    expect(names(renameLayer(rig(), 'hat', 'face '))).toEqual(['Body', 'Face', 'face (2)']);
    expect(names(renameLayer(rig(), 'hat', '  '))).toEqual(['Body', 'Face', 'Hat']);
    expect(names(renameLayer(rig(), 'face', 'Face'))).toEqual(['Body', 'Face', 'Hat']);
  });

  it('moves a Layer, which changes the order the stack draws in', () => {
    const moved = moveLayer(rig(), 2, 0);
    expect(names(moved)).toEqual(['Hat', 'Body', 'Face']);
    expect(resolveLayered(moved, list(moved), OUTSIDE_PLAY)?.layers.map((l) => l.data)).toEqual(['data:hat', 'data:body', 'data:hurt']);
    expect(names(moveLayer(rig(), 0, 9))).toEqual(['Body', 'Face', 'Hat']);
  });

  it('stores a tint as lowercase #rrggbb, and clears it for white, null or junk', () => {
    const tinted = setLayerTint(rig(), 'hat', '#FF8800');
    expect(tinted.layers[2].tint).toBe('#ff8800');
    for (const clear of ['#ffffff', null, 'red']) expect('tint' in setLayerTint(tinted, 'hat', clear).layers[2]).toBe(false);
  });

  it('stores a blend mode, and Normal as absent', () => {
    const screened = setLayerBlend(rig(), 'hat', 'screen');
    expect(screened.layers[2].blend).toBe('screen');
    expect('blend' in setLayerBlend(screened, 'hat', 'normal').layers[2]).toBe(false);
  });

  it('stores a transition, the default as absent, and resolves a missing one as Dissolve at the Mascot tuning', () => {
    expect(resolveLayered(rig(), list(), OUTSIDE_PLAY)?.layers[2].transition).toEqual({ ...DEFAULT_MASCOT_TRANSITION, mode: 'dissolve' });
    const jelly = { ...DEFAULT_LAYER_TRANSITION, mode: 'jelly' as const, jelly: { ...DEFAULT_LAYER_TRANSITION.jelly, squash: 0.3 } };
    const bouncy = setLayerTransition(rig(), 'hat', jelly);
    expect(bouncy.layers[2].transition).toEqual(jelly);
    expect(resolveLayered(bouncy, list(bouncy), OUTSIDE_PLAY)?.layers[2].transition).toEqual(jelly);
    expect('transition' in setLayerTransition(bouncy, 'hat', DEFAULT_LAYER_TRANSITION).layers[2]).toBe(false);
    // A stored value past its range resolves held to the Mascot's.
    const wild = { ...rig(), layers: rig().layers.map((l) => ({ ...l, transition: { ...jelly, jelly: { ...jelly.jelly, squash: 9 } } })) };
    expect(resolveLayered(wild, list(wild), OUTSIDE_PLAY)?.layers[2].transition.jelly.squash).toBe(0.5);
  });

  it('carries tint and blend mode into the resolved stack, and leaves white as no tint', () => {
    const styled = setLayerBlend(setLayerTint(rig(), 'hat', '#336699'), 'hat', 'add');
    const hat = resolveLayered(styled, list(styled), OUTSIDE_PLAY)?.layers[2];
    expect(hat).toMatchObject({ tint: '#336699', blend: 'add' });
    const plain = resolveLayered(rig(), list(), OUTSIDE_PLAY)?.layers[2];
    expect(plain?.blend).toBe('normal');
    expect('tint' in plain!).toBe(false);
    const white = { ...rig(), layers: rig().layers.map((l) => ({ ...l, tint: '#FFFFFF' })) };
    expect('tint' in resolveLayered(white, list(white), OUTSIDE_PLAY)!.layers[2]).toBe(false);
  });

  it('removes a Layer', () => {
    expect(names(removeLayer(rig(), 'face'))).toEqual(['Body', 'Hat']);
  });

  it('stores opacity between 0 and 1, and full opacity as absent', () => {
    expect(setLayerOpacity(rig(), 'hat', 0.4).layers[2].opacity).toBe(0.4);
    expect(setLayerOpacity(rig(), 'hat', -2).layers[2].opacity).toBe(0);
    expect('opacity' in setLayerOpacity(setLayerOpacity(rig(), 'hat', 0.4), 'hat', 1).layers[2]).toBe(false);
  });
});

describe('Variant edits', () => {
  it('adds images as the last Variants, never twice in one Layer', () => {
    expect(variants(addVariants(rig(), 'hat', ['body', 'hat', 'body']), 'hat')).toEqual([{ mediaId: 'hat' }, { mediaId: 'body' }]);
    const same = rig();
    expect(addVariants(same, 'hat', ['hat']).layers[2]).toBe(same.layers[2]);
  });

  it('reorders and removes Variants, so another one shows first', () => {
    const swapped = moveVariant(rig(), 'face', 1, 0);
    expect(variants(swapped, 'face').map((v) => v.mediaId)).toEqual(['calm', 'hurt']);
    expect(resolveLayered(swapped, list(swapped), OUTSIDE_PLAY)?.layers[1].data).toBe('data:calm');
    expect(variants(removeVariant(rig(), 'face', 0), 'face')).toEqual([{ mediaId: 'calm' }]);
  });

  it('sets a Variant rule, and clears it with no rows', () => {
    expect(variants(setVariantRule(rig(), 'face', 1, RULE), 'face')[1]).toEqual({ mediaId: 'calm', requires: RULE });
    expect(variants(setVariantRule(rig(), 'face', 0, []), 'face')[0]).toEqual({ mediaId: 'hurt' });
  });
});

describe('listWithoutVariant', () => {
  it('drops every Variant that links the image and keeps the emptied Layer (Q28)', () => {
    const out = listWithoutVariant(list(), 'body')!;
    const entry = out.rig as LayeredMediaEntry;
    expect(names(entry)).toEqual(['Body', 'Face', 'Hat']);
    expect(variants(entry, 'body')).toEqual([]);
    expect(variants(entry, 'face')).toHaveLength(2);
  });

  it('returns the same list when no Variant links the image', () => {
    const held = list();
    expect(listWithoutVariant(held, 'nothing')).toBe(held);
  });
});
