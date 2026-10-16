import { describe, expect, it } from 'vitest';
import { bindLink, bindLinks, comparableLink, linksBound, portableLinks, type LinkLists, type PortableLink } from './portableLinks';

type Link = PortableLink & { kind: 'leaf' | 'group' };

const leaves = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
/** A world whose one group holds both leaves, and where only `a` and the group may be linked. */
const lists: LinkLists<Link> = {
  originalNamed: (link) => [...leaves, { id: 'g', name: 'G' }].find((item) => item.id === link.originalId),
  originals: (kind) => (kind === 'group' ? [{ id: 'g', name: 'G' }] : [leaves[0]]),
  leaves,
  brought: (original, kind) => (kind === 'group' ? { ids: ['g', 'a', 'b'], leaves } : { ids: [original.id], leaves: [original] }),
};
const link = (over: Partial<Link> = {}): Link => ({ id: 'l', originalId: 'a', kind: 'leaf', originalName: 'A', groupId: null, ...over });

describe('bindLinks', () => {
  it('keeps the first of two overlapping links in tree order, in stored order', () => {
    const toA = link({ id: 'toA' });
    const toB = link({ id: 'toB', originalId: 'x', originalName: 'Nothing' });
    const toG = link({ id: 'toG', originalId: 'g', kind: 'group', originalName: 'G' });
    expect(bindLinks([toA, toG, toB], [toG, toA, toB], lists).map((l) => l.id)).toEqual(['toG']);
    expect(bindLinks([toG, toA], [toA, toG], lists).map((l) => l.id)).toEqual(['toA']);
  });
});

describe('bindLink', () => {
  it('binds by the stored name when the id is gone, and moves each override key by name', () => {
    const carried = link({ originalId: 'old-g', kind: 'group', originalName: 'G', overrides: { 'old-b': 1 }, keyNames: { 'old-b': 'B' } });
    expect(bindLink(carried, lists)).toEqual({ ids: ['g', 'a', 'b'], link: link({ originalId: 'g', kind: 'group', originalName: 'G', overrides: { b: 1 } }) });
  });

  it('binds nothing outside what its kind may link', () => {
    expect(bindLink(link({ originalId: 'b', originalName: 'B' }), lists)).toBeNull();
  });

  it('passes the bound link through the kind’s finish step', () => {
    const finished = bindLink(link(), { ...lists, finish: (l) => ({ ...l, order: 7 }) });
    expect(finished?.link.order).toBe(7);
  });
});

describe('linksBound', () => {
  it('keeps a link that binds nothing as stored', () => {
    const lost = link({ originalId: 'x', originalName: 'Nothing' });
    expect(linksBound([lost], lists)).toEqual([lost]);
  });
});

describe('portableLinks and comparableLink', () => {
  it('names the original and each other override key, and two copies compare the same', () => {
    const here = link({ originalId: 'g', kind: 'group', originalName: 'Old', overrides: { b: 1 } });
    const carried = portableLinks([here], lists)[0];
    expect(carried).toMatchObject({ originalName: 'G', keyNames: { b: 'B' } });
    const there = { ...carried, originalId: 'n-g', overrides: { 'n-b': 1 }, keyNames: { 'n-b': 'B' } };
    expect(comparableLink(there)).toEqual(comparableLink(carried));
  });

  it('keeps the stored names without a world', () => {
    const stored = link({ originalName: 'Kept', overrides: { b: 1 }, keyNames: { b: 'B' } });
    expect(portableLinks([stored])).toEqual([stored]);
  });
});
