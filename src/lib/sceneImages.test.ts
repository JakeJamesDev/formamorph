import { describe, it, expect } from 'vitest';
import { addSceneImage, removeSceneImage, pruneSceneImages, sceneImageWeight, setSceneTags, type SceneImageMap } from './sceneImages';
import { parseTurnContent, serializeTurnContent } from './turnDigest';
import type { AITurnResult, ChatMessage } from '@/types';

const IMG = `data:image/png;base64,${'A'.repeat(400)}`;
const IMG2 = `data:image/png;base64,${'B'.repeat(400)}`;

const turn = (over: Partial<AITurnResult>): ChatMessage => ({
  role: 'assistant',
  content: serializeTurnContent({ narration: 'n', choices: [], stat_changes: [], ...over }),
});

const history = (): ChatMessage[] => [
  { role: 'user', content: 'a' },
  turn({ turnId: 't1' }),
  { role: 'user', content: 'b' },
  turn({ turnId: 't2' }),
];

describe('addSceneImage', () => {
  it('appends to the turn, newest last, leaving other turns alone', () => {
    const once = addSceneImage({}, 't1', IMG);
    const twice = addSceneImage(once, 't1', IMG2);
    expect(twice).toEqual({ t1: [IMG, IMG2] });
  });

  it('does not mutate the map it was given', () => {
    const before: SceneImageMap = { t1: [IMG] };
    addSceneImage(before, 't1', IMG2);
    expect(before).toEqual({ t1: [IMG] });
  });
});

describe('removeSceneImage', () => {
  it('drops just the indexed image', () => {
    expect(removeSceneImage({ t1: [IMG, IMG2] }, 't1', 0)).toEqual({ t1: [IMG2] });
  });

  it('leaves no entry behind once a turn loses its last image', () => {
    expect(removeSceneImage({ t1: [IMG], t2: [IMG2] }, 't1', 0)).toEqual({ t2: [IMG2] });
  });

  it('returns the map unchanged for an out-of-range index or unknown turn', () => {
    const map = { t1: [IMG] };
    expect(removeSceneImage(map, 't1', 5)).toBe(map);
    expect(removeSceneImage(map, 't1', -1)).toBe(map);
    expect(removeSceneImage(map, 'nope', 0)).toBe(map);
  });
});

describe('pruneSceneImages', () => {
  it('forgets images whose turn is gone from the history', () => {
    // The rollback case: living beside the history rather than inside it, they have to be swept.
    const map = { t1: [IMG], t2: [IMG2], rolledBack: [IMG] };
    expect(pruneSceneImages(map, history())).toEqual({ t1: [IMG], t2: [IMG2] });
  });

  it('keeps the same object when nothing needs dropping, so React can skip the update', () => {
    const map = { t1: [IMG] };
    expect(pruneSceneImages(map, history())).toBe(map);
  });

  it('empties out against a history with no turns left', () => {
    expect(pruneSceneImages({ t1: [IMG] }, [])).toEqual({});
  });
});

describe('sceneImageWeight', () => {
  it('counts the images and reports what the save actually grows by (the base64 string itself)', () => {
    expect(sceneImageWeight({ t1: [IMG], t2: [IMG2] })).toEqual({ count: 2, bytes: IMG.length + IMG2.length });
  });

  it('is zero for an empty map', () => {
    expect(sceneImageWeight({})).toEqual({ count: 0, bytes: 0 });
  });
});

describe('setSceneTags', () => {
  it('writes the tag line into the turn, where it rides rollback with the story', () => {
    const next = setSceneTags(history(), 't2', 'no humans, rain')!;
    expect(parseTurnContent(next[3].content)?.sceneTags).toBe('no humans, rain');
    expect(parseTurnContent(next[1].content)?.sceneTags).toBeUndefined();
  });

  it('keeps the turn\'s other fields', () => {
    const next = setSceneTags([turn({ turnId: 't1', summary: 's', entities: ['Mira'] })], 't1', 'tags')!;
    const parsed = parseTurnContent(next[0].content)!;
    expect(parsed.summary).toBe('s');
    expect(parsed.entities).toEqual(['Mira']);
  });

  it('returns null for an unknown turn', () => {
    expect(setSceneTags(history(), 'nope', 'x')).toBeNull();
  });
});

describe('the history stays free of pixels', () => {
  it('never writes an image into a message, whatever the map holds', () => {
    // The whole point of the split: a megabyte in a turn is re-parsed by every history walk.
    const tagged = setSceneTags(history(), 't1', 'tags')!;
    for (const message of tagged) expect(message.content).not.toContain('data:image');
  });
});
