import { describe, expect, it } from 'vitest';
import {
  EMPTY_MAP_WIDTH, MIN_MAP_EDGE, coverFrame, firstMapFrame, locationsBounds, mapGalleryStepLabel, mapImages, moveFrame, resizeFrame, withMapImages,
} from './mapBackground';
import { CANVAS_NODE_HEIGHT, CANVAS_NODE_WIDTH } from './locationCanvas';
import type { GameLocation, MapBackground } from '@/types';

const harbor: GameLocation = { id: 'harbor', name: 'Harbor', canvasPosition: { x: 0, y: 0 } };
const marsh: GameLocation = { id: 'marsh', name: 'Marsh', canvasPosition: { x: 620, y: 248 } };
const background: MapBackground = { images: [{ data: 'a' }], frame: { x: 0, y: 0, width: 400, height: 200 }, opacity: 0.5 };

describe('locationsBounds', () => {
  it('spans every box, nested ones inside their parents', () => {
    const dock: GameLocation = { id: 'dock', name: 'Dock', parentId: 'harbor', canvasPosition: { x: 20, y: 36 } };
    expect(locationsBounds([harbor, dock, marsh])).toEqual({
      x: 0, y: 0, width: 620 + CANVAS_NODE_WIDTH, height: 248 + CANVAS_NODE_HEIGHT,
    });
  });

  it('is null with no locations', () => {
    expect(locationsBounds([])).toBeNull();
  });
});

describe('coverFrame', () => {
  it('matches a wide box on its width when the image is wider still, centered on the box', () => {
    expect(coverFrame({ x: 0, y: 0, width: 800, height: 100 }, 4)).toEqual({ x: 0, y: -50, width: 800, height: 200 });
  });

  it('matches a tall box on its height when the image is narrower', () => {
    expect(coverFrame({ x: 10, y: 10, width: 100, height: 100 }, 2)).toEqual({ x: -40, y: 10, width: 200, height: 100 });
  });
});

describe('firstMapFrame', () => {
  it('covers the locations', () => {
    const frame = firstMapFrame([harbor, marsh], 2);
    expect(frame.width / frame.height).toBeCloseTo(2);
    expect(frame.x).toBeLessThanOrEqual(0);
    expect(frame.y).toBeLessThanOrEqual(0);
    expect(frame.x + frame.width).toBeGreaterThanOrEqual(620 + CANVAS_NODE_WIDTH);
    expect(frame.y + frame.height).toBeGreaterThanOrEqual(248 + CANVAS_NODE_HEIGHT);
  });

  it('covers the visible area when there are no locations, and ignores it when there are', () => {
    const visible = { x: 100, y: 100, width: 600, height: 300 };
    expect(firstMapFrame([], 2, visible)).toEqual({ x: 100, y: 100, width: 600, height: 300 });
    expect(firstMapFrame([harbor], 2, visible).x).toBeLessThan(visible.x);
  });

  it('is 1280 wide at the image aspect, centered on the origin, with nothing to cover (Q78)', () => {
    expect(firstMapFrame([], 4)).toEqual({ x: -EMPTY_MAP_WIDTH / 2, y: -160, width: EMPTY_MAP_WIDTH, height: 320 });
  });
});

describe('resizeFrame', () => {
  const frame = { x: 100, y: 100, width: 400, height: 200 };

  it('keeps the aspect ratio and the opposite corner, scaling by the axis that moved further', () => {
    expect(resizeFrame(frame, 'se', 100, 0)).toEqual({ x: 100, y: 100, width: 500, height: 250 });
    expect(resizeFrame(frame, 'nw', 0, -100)).toEqual({ x: -100, y: 0, width: 600, height: 300 });
    expect(resizeFrame(frame, 'ne', -200, 100)).toEqual({ x: 100, y: 200, width: 200, height: 100 });
  });

  it('stops at the smallest edge', () => {
    const shrunk = resizeFrame(frame, 'sw', 1000, -1000);
    expect(Math.min(shrunk.width, shrunk.height)).toBeCloseTo(MIN_MAP_EDGE);
    expect(shrunk.width / shrunk.height).toBeCloseTo(2);
    expect(shrunk.x + shrunk.width).toBe(500);
  });

  it('moves without resizing', () => {
    expect(moveFrame(frame, -5, 7)).toEqual({ x: 95, y: 107, width: 400, height: 200 });
  });
});

describe('withMapImages', () => {
  it('keeps the frame and opacity when the gallery changes', () => {
    expect(withMapImages(background, [{ data: 'b' }, { data: 'a' }])).toEqual({ ...background, images: [{ data: 'b' }, { data: 'a' }] });
  });

  it('drops the whole field with the last image (Q77)', () => {
    expect(withMapImages(background, [])).toBeUndefined();
    expect(withMapImages(background, [{ data: '' }])).toBeUndefined();
  });

  it('gives a first image its frame at full opacity (Q81)', () => {
    const frame = { x: 1, y: 2, width: 3, height: 4 };
    expect(withMapImages(undefined, [{ data: 'a' }], frame)).toEqual({ images: [{ data: 'a' }], frame, opacity: 1 });
  });
});

describe('mapImages', () => {
  it('reads the gallery without blanks, and nothing from a world without one', () => {
    expect(mapImages({ mapBackground: { ...background, images: [{ data: '' }, { data: 'a' }] } })).toEqual([{ data: 'a' }]);
    expect(mapImages({})).toEqual([]);
  });
});

describe('mapGalleryStepLabel', () => {
  const a = { data: 'a' };
  const b = { data: 'b' };
  const c = { data: 'c' };

  it('names each gallery change the card can make', () => {
    expect(mapGalleryStepLabel([], [a])).toBe('Set Map Background');
    expect(mapGalleryStepLabel([a, b], [a, b, c])).toBe('Add Image 3: Map Background');
    expect(mapGalleryStepLabel([a, b, c], [a, c])).toBe('Remove Image 2: Map Background');
    expect(mapGalleryStepLabel([a, b], [{ data: '' }, b])).toBe('Remove Image 1: Map Background');
    expect(mapGalleryStepLabel([a, b, c], [c, a, b])).toBe('Reorder Images: Map Background');
    expect(mapGalleryStepLabel([a, b], [a, c])).toBe('Replace Image 2: Map Background');
    expect(mapGalleryStepLabel([a, b], [a, { ...b, requires: [] }])).toBe('Edit Map Background');
  });
});
