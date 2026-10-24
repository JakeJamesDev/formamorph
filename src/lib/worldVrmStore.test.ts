import { describe, expect, it } from 'vitest';
import { replaceWorldVrm } from './worldVrmStore';
import type { WorldVrmStore } from '@/types';

const OLD = { data: 'data:model/vrm;base64,AAAA', type: 'model/vrm', name: 'Heron.vrm' };
const NEW = { data: 'data:model/vrm;base64,BBBB', type: 'model/vrm', name: 'Heron v2.vrm' };

describe('replaceWorldVrm', () => {
  const store: WorldVrmStore = {
    heron: { name: 'Heron', file: OLD, hash: 'old-hash' },
    reed: { name: 'Reed', file: OLD },
  };

  it('swaps the file and hash under the same id and name, and leaves other entries alone', () => {
    const next = replaceWorldVrm(store, 'heron', NEW, 'new-hash');
    expect(next?.heron).toEqual({ name: 'Heron', file: NEW, hash: 'new-hash' });
    expect(next?.reed).toBe(store.reed);
  });

  it('drops the old hash when no new one is given', () => {
    expect(replaceWorldVrm(store, 'heron', NEW)?.heron).toEqual({ name: 'Heron', file: NEW });
  });

  it('returns the store untouched for an id it lacks', () => {
    expect(replaceWorldVrm(store, 'gone', NEW, 'h')).toBe(store);
  });
});
