import { describe, expect, it, vi } from 'vitest';
import { bubbleActions, type BubbleActionHandlers, type BubbleState } from './bubbleActions';

const idle: BubbleState = {
  isLatest: true,
  live: false,
  busy: false,
  hasImage: false,
  canRegenStats: true,
  sceneImagesAvailable: true,
  sceneJob: null,
  ttsLoaded: true,
  ttsGenerating: false,
};

function handlers(): BubbleActionHandlers {
  return {
    regenerate: vi.fn(), regenerateStats: vi.fn(), sceneImage: vi.fn(), sceneTags: vi.fn(), edit: vi.fn(),
    textToSpeech: vi.fn(), copy: vi.fn(), regenerateAudio: vi.fn(), rewind: vi.fn(),
  };
}

const labels = (state: BubbleState) => bubbleActions(state, handlers()).map((a) => a.label);
const rowLabels = (state: BubbleState) => bubbleActions(state, handlers()).filter((a) => !a.menuOnly).map((a) => a.label);
const find = (state: BubbleState, label: string) => bubbleActions(state, handlers()).find((a) => a.label === label);

describe('bubbleActions', () => {
  it('gives the latest turn the re-generate actions and no Rewind to Here', () => {
    expect(rowLabels(idle)).toEqual([
      'Re-generate Narration', 'Re-generate Stats', 'Generate Scene Image', 'Edit', 'Text to Speech', 'Copy Text',
    ]);
    expect(labels(idle)).not.toContain('Rewind to Here');
  });

  it('gives a past turn Rewind to Here and no re-generate actions', () => {
    const past = { ...idle, isLatest: false };
    expect(rowLabels(past)).toEqual(['Generate Scene Image', 'Edit', 'Copy Text', 'Rewind to Here']);
  });

  it('keeps Write Scene Tags and Regenerate Audio off the row but in the list', () => {
    for (const state of [idle, { ...idle, isLatest: false }]) {
      expect(labels(state)).toEqual(expect.arrayContaining(['Write Scene Tags', 'Regenerate Audio']));
      expect(rowLabels(state)).not.toContain('Write Scene Tags');
      expect(rowLabels(state)).not.toContain('Regenerate Audio');
    }
  });

  it('drops Generate Scene Image once the turn has an image', () => {
    expect(labels({ ...idle, hasImage: true })).not.toContain('Generate Scene Image');
    expect(labels({ ...idle, hasImage: true })).toContain('Write Scene Tags');
  });

  it('drops the scene actions when image generation is off', () => {
    const off = labels({ ...idle, sceneImagesAvailable: false });
    expect(off).not.toContain('Generate Scene Image');
    expect(off).not.toContain('Write Scene Tags');
  });

  it('drops Re-generate Stats when stats cannot be re-rolled', () => {
    expect(labels({ ...idle, canRegenStats: false })).not.toContain('Re-generate Stats');
  });

  it('drops Regenerate Audio with no voice model loaded, but keeps Text to Speech', () => {
    const noTts = labels({ ...idle, ttsLoaded: false });
    expect(noTts).not.toContain('Regenerate Audio');
    expect(noTts).toContain('Text to Speech');
  });

  it('offers Text to Speech on the latest bubble only, since the modal reads the latest text', () => {
    expect(labels(idle)).toContain('Text to Speech');
    expect(labels({ ...idle, isLatest: false })).not.toContain('Text to Speech');
    expect(labels({ ...idle, isLatest: false })).toContain('Regenerate Audio');
  });

  it('gives a live turn no actions', () => {
    expect(bubbleActions({ ...idle, live: true }, handlers())).toEqual([]);
  });

  it('disables every action that starts a request while a reply streams', () => {
    for (const isLatest of [true, false]) {
      const actions = bubbleActions({ ...idle, isLatest, busy: true }, handlers());
      const disabled = actions.filter((a) => a.disabled).map((a) => a.key).sort();
      const expected = isLatest ? ['image', 'regenerate', 'stats', 'tags'] : ['image', 'rewind', 'tags'];
      expect(disabled).toEqual(expected.sort());
    }
  });

  it('disables the scene actions and the stat re-roll while a scene job runs, and marks the running one', () => {
    const tags = bubbleActions({ ...idle, sceneJob: 'tags' }, handlers());
    expect(tags.filter((a) => a.disabled).map((a) => a.key).sort()).toEqual(['image', 'stats', 'tags']);
    expect(tags.find((a) => a.key === 'tags')?.spinning).toBe(true);
    expect(tags.find((a) => a.key === 'image')?.spinning).toBeFalsy();
  });

  it('disables Regenerate Audio while audio generates', () => {
    const actions = bubbleActions({ ...idle, ttsGenerating: true }, handlers());
    expect(actions.filter((a) => a.disabled).map((a) => a.key).sort()).toEqual(['regenerateAudio']);
  });

  it('makes Rewind to Here the only destructive action, and puts it last', () => {
    const actions = bubbleActions({ ...idle, isLatest: false }, handlers());
    expect(actions.filter((a) => a.section === 'destructive').map((a) => a.label)).toEqual(['Rewind to Here']);
    expect(actions[actions.length - 1].label).toBe('Rewind to Here');
    expect(bubbleActions(idle, handlers()).some((a) => a.section === 'destructive')).toBe(false);
  });

  it('orders the sections generate, then content, then destructive', () => {
    const order = { generate: 0, content: 1, destructive: 2 };
    const sections = bubbleActions({ ...idle, isLatest: false }, handlers()).map((a) => order[a.section]);
    expect(sections).toEqual([...sections].sort((a, b) => a - b));
  });

  it('runs only its own handler for each action', () => {
    const expected: Record<string, keyof BubbleActionHandlers> = {
      'Re-generate Narration': 'regenerate', 'Re-generate Stats': 'regenerateStats',
      'Generate Scene Image': 'sceneImage', 'Write Scene Tags': 'sceneTags', Edit: 'edit',
      'Text to Speech': 'textToSpeech', 'Regenerate Audio': 'regenerateAudio', 'Copy Text': 'copy',
      'Rewind to Here': 'rewind',
    };
    const seen = new Set<string>();
    for (const isLatest of [true, false]) {
      for (const label of labels({ ...idle, isLatest })) {
        const h = handlers();
        bubbleActions({ ...idle, isLatest }, h).find((a) => a.label === label)!.run();
        const called = (Object.keys(h) as (keyof BubbleActionHandlers)[]).filter((k) => vi.mocked(h[k]).mock.calls.length);
        expect(called).toEqual([expected[label]]);
        seen.add(label);
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(expected).sort());
    expect(find(idle, 'Copy Text')?.icon).toBeDefined();
  });
});
