// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { WorldOverview } from '@/types';
import { useBodyMorphSources } from './useBodyMorphNames';

const overview = vi.hoisted(() => ({ current: {} as Partial<WorldOverview> }));
vi.mock('@/contexts/GameDataContext', () => ({ useGameDataOptional: () => ({ worldOverview: overview.current }) }));

// Each file's morphs are named for the file, so a group shows which model it came from.
const MORPHS: Record<string, { body: string[]; head: string[] }> = {
  'data:heron': { body: ['HeronNeck'], head: ['HeronBeak'] },
  'data:reed': { body: ['ReedHeight'], head: [] },
  'data:bare': { body: [], head: [] },
  'blob:lib': { body: ['LibraryChest'], head: ['LibraryEars'] },
};
vi.mock('./vrmMorphLoader', () => ({ loadMorphSplit: async (url: string) => MORPHS[url] ?? { body: [], head: [] } }));
vi.mock('./modelLoader', () => ({ loadModelMorphNames: async () => [] }));
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelMetadata: async () => [{ id: 'lib-1', name: 'Fen Walker', type: 'model/vrm', size: 1 }],
    getModelData: async () => ({ blob: new Blob(['x']), type: 'model/vrm', size: 1 }),
  },
}));

const file = (data: string) => ({ data, type: 'model/vrm' });

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:lib', revokeObjectURL: () => {} }));
});

const loadedHeadings = async () => {
  const { result } = renderHook(() => useBodyMorphSources());
  act(() => result.current.load());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current.sources.map((s) => [s.heading, s.morphs, s.head]);
};

describe('the stat morph-binding picker', () => {
  it('lists every store Avatar by display name, then the library', async () => {
    overview.current = {
      vrmStore: { a: { name: 'Heron', file: file('data:heron') }, b: { name: 'Reed', file: file('data:reed') } },
    };
    expect(await loadedHeadings()).toEqual([
      ['Heron', ['HeronNeck'], ['HeronBeak']],
      ['Reed', ['ReedHeight'], []],
      ['Fen Walker', ['LibraryChest'], ['LibraryEars']],
    ]);
  });

  it('skips a store Avatar with no morphs', async () => {
    overview.current = { vrmStore: { a: { name: 'Bare', file: file('data:bare') } } };
    expect(await loadedHeadings()).toEqual([['Fen Walker', ['LibraryChest'], ['LibraryEars']]]);
  });
});
