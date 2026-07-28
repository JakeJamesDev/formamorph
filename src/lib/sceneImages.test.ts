import { describe, it, expect } from 'vitest';
import { addSceneImage, removeSceneImage, setSceneTags, sceneImagesAt, stripSceneImages, sceneImageWeight } from './sceneImages';
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

const imagesOf = (h: ChatMessage[], turnId: string) =>
  h.map((m) => (m.role === 'assistant' ? parseTurnContent(m.content) : null)).find((t) => t?.turnId === turnId)?.sceneImages;

describe('addSceneImage', () => {
  it('appends to the matching turn only, newest last', () => {
    const once = addSceneImage(history(), 't1', IMG)!;
    const twice = addSceneImage(once, 't1', IMG2)!;
    expect(imagesOf(twice, 't1')).toEqual([IMG, IMG2]);
    expect(imagesOf(twice, 't2')).toBeUndefined();
  });

  it('stores the tag line alongside the image', () => {
    const next = addSceneImage(history(), 't1', IMG, '1girl, dock')!;
    expect(parseTurnContent(next[1].content)?.sceneTags).toBe('1girl, dock');
  });

  it('returns null when the turn is gone, so a late render is discarded', () => {
    // The apply-guard: the turn was rolled back or re-generated while the image was rendering.
    expect(addSceneImage(history(), 'rolled-back', IMG)).toBeNull();
  });

  it('leaves the turn\'s other fields intact', () => {
    const next = addSceneImage([turn({ turnId: 't1', summary: 's', entities: ['Mira'] })], 't1', IMG)!;
    const parsed = parseTurnContent(next[0].content)!;
    expect(parsed.summary).toBe('s');
    expect(parsed.entities).toEqual(['Mira']);
  });
});

describe('removeSceneImage', () => {
  it('drops just the indexed image', () => {
    const two = addSceneImage(addSceneImage(history(), 't1', IMG)!, 't1', IMG2)!;
    expect(imagesOf(removeSceneImage(two, 't1', 0)!, 't1')).toEqual([IMG2]);
  });

  it('removes the field entirely once the last image goes, keeping the tag line', () => {
    const one = addSceneImage(history(), 't1', IMG, 'tags')!;
    const empty = removeSceneImage(one, 't1', 0)!;
    expect(parseTurnContent(empty[1].content)).not.toHaveProperty('sceneImages');
    // The tag line survives the last deletion — it's what makes the scene reproducible.
    expect(parseTurnContent(empty[1].content)?.sceneTags).toBe('tags');
  });

  it('returns null for an out-of-range index or an unknown turn', () => {
    const one = addSceneImage(history(), 't1', IMG)!;
    expect(removeSceneImage(one, 't1', 5)).toBeNull();
    expect(removeSceneImage(one, 't1', -1)).toBeNull();
    expect(removeSceneImage(one, 'nope', 0)).toBeNull();
  });
});

describe('setSceneTags', () => {
  it('writes the line without needing an image yet', () => {
    const next = setSceneTags(history(), 't2', 'no humans, rain')!;
    expect(parseTurnContent(next[3].content)?.sceneTags).toBe('no humans, rain');
  });

  it('returns null for an unknown turn', () => {
    expect(setSceneTags(history(), 'nope', 'x')).toBeNull();
  });
});

describe('sceneImagesAt', () => {
  it('reads a turn by its index in the flat history', () => {
    const next = addSceneImage(history(), 't2', IMG)!;
    expect(sceneImagesAt(next, 3)).toEqual([IMG]);
    expect(sceneImagesAt(next, 1)).toEqual([]);
    expect(sceneImagesAt(next, 0)).toEqual([]); // a user message
    expect(sceneImagesAt(next, 99)).toEqual([]);
  });
});

describe('stripSceneImages', () => {
  it('removes every image but keeps the tags and the story', () => {
    const withImages = addSceneImage(addSceneImage(history(), 't1', IMG, 'tags one')!, 't2', IMG2, 'tags two')!;
    const stripped = stripSceneImages(withImages);
    expect(sceneImageWeight(stripped)).toEqual({ count: 0, bytes: 0 });
    expect(parseTurnContent(stripped[1].content)?.sceneTags).toBe('tags one');
    expect(parseTurnContent(stripped[3].content)?.narration).toBe('n');
    expect(stripped[0]).toEqual({ role: 'user', content: 'a' });
  });

  it('leaves an image-free history byte-identical, so an ordinary save is untouched', () => {
    const plain = history();
    expect(stripSceneImages(plain)).toEqual(plain);
  });
});

describe('sceneImageWeight', () => {
  it('counts the images and approximates their decoded size', () => {
    const withImages = addSceneImage(addSceneImage(history(), 't1', IMG)!, 't2', IMG2)!;
    const { count, bytes } = sceneImageWeight(withImages);
    expect(count).toBe(2);
    // 400 base64 chars ≈ 300 bytes each, and the data: prefix is excluded.
    expect(bytes).toBe(600);
  });

  it('is zero for a history with none', () => {
    expect(sceneImageWeight(history())).toEqual({ count: 0, bytes: 0 });
  });
});
