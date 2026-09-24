import { describe, expect, it } from 'vitest';
import type { Stat } from '@/types';
import { newStat, withDefaultDescriptors } from './blankWorld';
import { defaultDescriptorBands, followRename } from './statDescriptors';

const stat = (name: string, descriptors: Stat['descriptors']): Stat =>
  ({ id: 's1', name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors });

const texts = (descriptors: Stat['descriptors']) => descriptors.map((d) => d.description);

describe('defaultDescriptorBands', () => {
  it('is the one source the added stat draws its descriptors from', () => {
    const added = withDefaultDescriptors(newStat('s1', 'Grit'));
    expect(added.descriptors.map(({ threshold, description }) => ({ threshold, description })))
      .toEqual(defaultDescriptorBands('Grit'));
    expect(new Set(added.descriptors.map((d) => d.id)).size).toBe(3);
  });
});

describe('followRename', () => {
  it('rebuilds every default descriptor from the new name', () => {
    const before = withDefaultDescriptors(newStat('s1', 'New Stat'));
    const next = followRename(before, { ...before, name: 'Sea Change' });
    expect(texts(next)).toEqual(['Sea Change is low', 'Sea Change is medium', 'Sea Change is high']);
    expect(next.map((d) => d.id)).toEqual(before.descriptors.map((d) => d.id));
    expect(next.map((d) => d.threshold)).toEqual([30, 60, 100]);
  });

  it('leaves an edited descriptor as the author wrote it', () => {
    const before = stat('New Stat', [
      { id: 'd1', threshold: 30, description: 'Barely holding on' },
      { id: 'd2', threshold: 60, description: 'new stat is medium' },
      { id: 'd3', threshold: 100, description: ' New Stat is high' },
    ]);
    const next = followRename(before, { ...before, name: 'Sea Change' });
    expect(texts(next)).toEqual(['Barely holding on', 'new stat is medium', ' New Stat is high']);
  });

  it('judges each descriptor on its own in a mix', () => {
    const before = stat('New Stat', [
      { id: 'd1', threshold: 30, description: 'New Stat is low' },
      { id: 'd2', threshold: 60, description: 'Barely holding on' },
      { id: 'd3', threshold: 100, description: 'New Stat is high' },
    ]);
    const next = followRename(before, { ...before, name: 'Sea Change' });
    expect(texts(next)).toEqual(['Sea Change is low', 'Barely holding on', 'Sea Change is high']);
    expect(next[1]).toBe(before.descriptors[1]);
  });

  it('ends on the final name when the rename passes through an empty name', () => {
    let current = withDefaultDescriptors(newStat('s1', 'New Stat'));
    for (const name of ['', 'S', 'Se', 'Sea']) {
      current = { ...current, name, descriptors: followRename(current, { ...current, name }) };
    }
    expect(texts(current.descriptors)).toEqual(['Sea is low', 'Sea is medium', 'Sea is high']);
  });

  it('returns the same array when the name did not change', () => {
    const before = withDefaultDescriptors(newStat('s1', 'New Stat'));
    const after = { ...before, description: 'Nerve.' };
    expect(followRename(before, after)).toBe(after.descriptors);
  });

  it('returns the same array when a rename matches no descriptor', () => {
    const before = stat('New Stat', [{ id: 'd1', threshold: 30, description: 'Barely holding on' }]);
    const after = { ...before, name: 'Sea Change' };
    expect(followRename(before, after)).toBe(after.descriptors);
  });
});
