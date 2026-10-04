import { describe, it, expect } from 'vitest';
import { DEFAULT_MASCOT_RIG, composeMascot } from './mascot';
import {
  previewMascot, resolveSelection, selectLayer, selectOverlay, selectionAfterLayerRemove, selectionAfterMove, selectionAfterRemove, toggleLayer,
  type MascotSelection,
} from './mascotSelection';

const rig = DEFAULT_MASCOT_RIG;
const happy = rig.layers.find((row) => row.id === 'happy')!;
const at = (overlay: number | null, layerId = 'happy'): MascotSelection => ({ layerId, overlay });

describe('previewMascot', () => {
  it('draws the Idle look with nothing selected, or a selection whose layer is gone', () => {
    expect(previewMascot(rig, null)).toEqual(composeMascot(rig, 'answering', null));
    expect(previewMascot(rig, at(null, 'gone'))).toEqual(composeMascot(rig, 'answering', null));
  });

  it('draws the base under every overlay of a layer, or under one overlay', () => {
    expect(previewMascot(rig, at(null))).toEqual([rig.base, ...happy.images]);
    expect(previewMascot(rig, at(1))).toEqual([rig.base, happy.images[1]]);
  });

  it('reads an overlay past the end as its layer', () => {
    expect(resolveSelection(rig, at(happy.images.length))).toEqual({ layer: happy, overlay: null });
    expect(previewMascot(rig, at(happy.images.length))).toEqual([rig.base, ...happy.images]);
  });
});

describe('the selection transitions', () => {
  it('selects a layer from anywhere, and a second click on it alone collapses it', () => {
    expect(selectLayer(null, 'happy')).toEqual(at(null));
    expect(selectLayer(at(1), 'happy')).toEqual(at(null));
    expect(selectLayer(at(null), 'happy')).toBeNull();
    expect(selectLayer(at(null, 'sad'), 'happy')).toEqual(at(null));
  });

  it('collapses through the chevron even with an overlay selected', () => {
    expect(toggleLayer(at(1), 'happy')).toBeNull();
    expect(toggleLayer(at(null, 'sad'), 'happy')).toEqual(at(null));
  });

  it('selects an overlay, and a second click returns to its layer', () => {
    expect(selectOverlay(null, 'happy', 1)).toEqual(at(1));
    expect(selectOverlay(at(1), 'happy', 1)).toEqual(at(null));
    expect(selectOverlay(at(1, 'sad'), 'happy', 1)).toEqual(at(1));
  });

  it('drops the selection with its layer, and keeps another layer selected', () => {
    expect(selectionAfterLayerRemove(at(1), 'happy')).toBeNull();
    expect(selectionAfterLayerRemove(at(1, 'sad'), 'happy')).toEqual(at(1, 'sad'));
  });

  it('follows the selected image through a removal', () => {
    expect(selectionAfterRemove(at(2), 'happy', 2)).toEqual(at(null));
    expect(selectionAfterRemove(at(2), 'happy', 0)).toEqual(at(1));
    expect(selectionAfterRemove(at(1), 'happy', 3)).toEqual(at(1));
    expect(selectionAfterRemove(at(1, 'sad'), 'happy', 0)).toEqual(at(1, 'sad'));
  });

  it('follows the selected image through a move', () => {
    expect(selectionAfterMove(at(1), 'happy', 1, 3)).toEqual(at(3));
    // Moved down past it: it shifts up.
    expect(selectionAfterMove(at(2), 'happy', 0, 3)).toEqual(at(1));
    expect(selectionAfterMove(at(3), 'happy', 0, 3)).toEqual(at(2));
    // Moved up past it: it shifts down.
    expect(selectionAfterMove(at(1), 'happy', 3, 0)).toEqual(at(2));
    expect(selectionAfterMove(at(0), 'happy', 3, 0)).toEqual(at(1));
    // Outside the move's span, or another layer: unchanged.
    expect(selectionAfterMove(at(4), 'happy', 0, 3)).toEqual(at(4));
    expect(selectionAfterMove(at(1, 'sad'), 'happy', 0, 3)).toEqual(at(1, 'sad'));
  });
});
