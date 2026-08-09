import { describe, it, expect } from 'vitest';
import { followReorder } from './imageGalleryOrder';

/** What the frame should show, derived from the pictures themselves rather than from the index arithmetic —
 *  so the expectations can't restate the implementation. */
const byIdentity = (list: string[], showing: number, from: number, to: number) => {
  const framed = list[showing];
  const moved = [...list];
  moved.splice(to, 0, ...moved.splice(from, 1));
  return moved.indexOf(framed);
};

const LIST = ['a', 'b', 'c', 'd', 'e'];

describe('followReorder', () => {
  it('follows the framed picture when it is the one dragged', () => {
    expect(followReorder(2, 2, 0)).toBe(0);
    expect(followReorder(0, 0, 4)).toBe(4);
  });

  it('shifts back when a picture from before it moves past it', () => {
    // 'a' moves to the end, so 'c' (framed at 2) slides down to 1.
    expect(followReorder(2, 0, 4)).toBe(1);
  });

  it('shifts forward when a picture from after it moves in front', () => {
    // 'e' moves to the front, so 'c' slides up to 3.
    expect(followReorder(2, 4, 0)).toBe(3);
  });

  it('stays put when the move happens entirely on one side of it', () => {
    expect(followReorder(3, 0, 1)).toBe(3);
    expect(followReorder(1, 3, 4)).toBe(1);
  });

  it('keeps the frame on the same picture for every move in a five-picture strip', () => {
    for (let showing = 0; showing < LIST.length; showing++) {
      for (let from = 0; from < LIST.length; from++) {
        for (let to = 0; to < LIST.length; to++) {
          expect({ showing, from, to, at: followReorder(showing, from, to) })
            .toEqual({ showing, from, to, at: byIdentity(LIST, showing, from, to) });
        }
      }
    }
  });
});
