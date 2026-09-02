import { describe, it, expect } from 'vitest';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder, PlaceholderGroup } from '@/types';
import {
  childPlaceholderGroups, placeholderGroupOf, placeholderGroupsInTreeOrder, portablePlaceholders,
  removePlaceholderGroup, withPlaceholderGroup,
} from './placeholderGroups';

const G = (id: string, name: string, parentId: string | null = null, order?: number): PlaceholderGroup =>
  ({ id, name, parentId, ...(order !== undefined ? { order } : {}) });
const P = (id: string, groupId?: string | null): Placeholder =>
  ({ id, name: id, values: phValues(['x']), ...(groupId !== undefined ? { groupId } : {}) });

const GROUPS = [G('body', 'Body', null, 1), G('face', 'Face', 'body'), G('gear', 'Gear', null, 0)];

describe('placeholderGroupOf', () => {
  it('reads the folder, or null for a loose row, an explicit null, or a folder that is gone', () => {
    expect(placeholderGroupOf(GROUPS, P('a', 'face'))).toBe('face');
    expect(placeholderGroupOf(GROUPS, P('a'))).toBeNull();
    expect(placeholderGroupOf(GROUPS, P('a', null))).toBeNull();
    expect(placeholderGroupOf(GROUPS, P('a', 'gone'))).toBeNull();
  });
});

describe('placeholderGroupsInTreeOrder', () => {
  it('walks depth-first by sibling order, heading each folder with its path', () => {
    expect(placeholderGroupsInTreeOrder(GROUPS).map((g) => [g.group.id, g.depth, g.heading])).toEqual([
      ['gear', 0, 'Gear'], ['body', 0, 'Body'], ['face', 1, 'Body › Face'],
    ]);
    expect(childPlaceholderGroups(GROUPS, null).map((g) => g.id)).toEqual(['gear', 'body']);
  });

  it('lifts a folder whose parent is gone to the root', () => {
    expect(placeholderGroupsInTreeOrder([G('face', 'Face', 'gone')]).map((g) => g.heading)).toEqual(['Face']);
  });
});

describe('withPlaceholderGroup', () => {
  it('sets a folder, and removes the key rather than writing null', () => {
    const grouped = withPlaceholderGroup(P('a'), 'body');
    expect(grouped.groupId).toBe('body');
    expect(withPlaceholderGroup(grouped, null)).not.toHaveProperty('groupId');
    expect(withPlaceholderGroup(P('a', null), null)).not.toHaveProperty('groupId');
  });

  it('keeps identity when nothing changes', () => {
    const loose = P('a');
    expect(withPlaceholderGroup(loose, null)).toBe(loose);
    const grouped = P('a', 'body');
    expect(withPlaceholderGroup(grouped, 'body')).toBe(grouped);
  });
});

describe('removePlaceholderGroup', () => {
  it('lifts the folder’s subfolders and placeholders to its parent', () => {
    const placeholders = [P('a', 'body'), P('b', 'face'), P('c')];
    const next = removePlaceholderGroup(GROUPS, placeholders, 'body');
    expect(next.groups.map((g) => [g.id, g.parentId])).toEqual([['face', null], ['gear', null]]);
    expect(next.placeholders[0]).not.toHaveProperty('groupId');
    expect(next.placeholders[1].groupId).toBe('face');
    expect(next.placeholders[2]).toBe(placeholders[2]);
  });

  it('moves a nested folder’s placeholders up one level, and leaves an unknown id alone', () => {
    const placeholders = [P('b', 'face')];
    expect(removePlaceholderGroup(GROUPS, placeholders, 'face').placeholders[0].groupId).toBe('body');
    const same = removePlaceholderGroup(GROUPS, placeholders, 'gone');
    expect(same.groups).toBe(GROUPS);
    expect(same.placeholders).toBe(placeholders);
  });
});

describe('portablePlaceholders', () => {
  it('strips every folder reference, and hands back an ungrouped list as it is', () => {
    const list = [P('a', 'body'), P('b')];
    const out = portablePlaceholders(list);
    expect(out.every((p) => !('groupId' in p))).toBe(true);
    expect(out[1]).toBe(list[1]);
    const loose = [P('c')];
    expect(portablePlaceholders(loose)).toBe(loose);
  });
});
