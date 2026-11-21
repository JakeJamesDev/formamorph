import { describe, expect, it } from 'vitest';
import { DEFAULT_MASCOT_TRANSITION, type MascotTransition } from './formaquestion/mascotTransition';
import { DEFAULT_LAYER_TRANSITION, type LayeredPicture, type ResolvedLayer } from './layeredImages';
import { stackChange } from './layeredTransition';

const jelly = (durationMs: number): MascotTransition => ({ ...DEFAULT_MASCOT_TRANSITION, mode: 'jelly', jelly: { ...DEFAULT_MASCOT_TRANSITION.jelly, durationMs } });
const none: MascotTransition = { ...DEFAULT_MASCOT_TRANSITION, mode: 'none' };

const layer = (id: string, data: string | undefined, transition = DEFAULT_LAYER_TRANSITION): ResolvedLayer =>
  ({ id, opacity: 1, blend: 'normal', transition, ...(data ? { data } : {}) });

const stack = (layers: ResolvedLayer[], entryId = 'rig'): LayeredPicture => ({ kind: 'layered', entryId, canvas: 'data:body', layers });

describe('stackChange', () => {
  it('fades the one Layer whose Variant changed', () => {
    const before = stack([layer('body', 'data:body'), layer('face', 'data:smile')]);
    const after = stack([layer('body', 'data:body'), layer('face', 'data:frown')]);
    expect(stackChange(before, after, false)).toEqual({
      changes: [{ layerId: 'face', to: 'data:frown', mode: 'dissolve', transition: DEFAULT_LAYER_TRANSITION }],
    });
  });

  it('squashes once with the topmost changed Jelly Layer while the others play their own modes', () => {
    const before = stack([layer('body', 'data:a', jelly(300)), layer('hat', undefined, none), layer('face', 'data:smile'), layer('glow', 'data:on', jelly(900)), layer('top', 'data:x', jelly(500))]);
    const after = stack([layer('body', 'data:b', jelly(300)), layer('hat', 'data:hat', none), layer('face', undefined), layer('glow', 'data:off', jelly(900)), layer('top', 'data:x', jelly(500))]);
    const change = stackChange(before, after, false);
    expect(change?.changes.map(({ layerId, mode, to }) => ({ layerId, mode, to }))).toEqual([
      { layerId: 'body', mode: 'jelly', to: 'data:b' },
      { layerId: 'hat', mode: 'none', to: 'data:hat' },
      { layerId: 'face', mode: 'dissolve', to: undefined },
      { layerId: 'glow', mode: 'jelly', to: 'data:off' },
    ]);
    // The unchanged top Jelly Layer does not pick the tuning.
    expect(change?.squash).toEqual(jelly(900));
  });

  it('plays nothing when no Variant changed, even when opacity or tint did', () => {
    const before = stack([layer('body', 'data:body'), layer('face', undefined)]);
    const after = stack([{ ...layer('body', 'data:body'), opacity: 0.4, tint: '#cc3300' }, layer('face', undefined)]);
    expect(stackChange(before, after, false)).toBeUndefined();
  });

  it('plays nothing for a first picture or another Layered Image', () => {
    const after = stack([layer('face', 'data:frown')]);
    expect(stackChange(undefined, after, false)).toBeUndefined();
    expect(stackChange(stack([layer('face', 'data:smile')], 'other'), after, false)).toBeUndefined();
  });

  it('plays Jelly as Dissolve with no squash under reduced motion', () => {
    const before = stack([layer('face', 'data:smile', jelly(450))]);
    const after = stack([layer('face', 'data:frown', jelly(450))]);
    expect(stackChange(before, after, true)).toEqual({
      changes: [{ layerId: 'face', to: 'data:frown', mode: 'dissolve', transition: jelly(450) }],
    });
  });
});
