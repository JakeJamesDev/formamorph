import { describe, expect, it } from 'vitest';
import {
  addLayer, addVariants, listWithoutVariant, moveLayer, moveVariant, newLayeredEntry, removeLayer, removeVariant, renameLayer,
  setLayerOpacity, setVariantRule,
} from './layeredEdit';
import { OUTSIDE_PLAY, resolveLayered } from './layeredImages';
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
