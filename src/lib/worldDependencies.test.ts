import { describe, it, expect } from 'vitest';
import {
  addonTabs, componentKind, downloadItemCount, linkInstalledSources, listingId, selectedAddons,
  type AddonRow, type DependencyRow, type InstalledSource,
} from './worldDependencies';
import type { Dictionary, Entity } from '@/types';

const addon = (id: string, reviewState?: AddonRow['reviewState']): AddonRow =>
  ({ _id: id, name: id, kind: 'entity', ...(reviewState ? { reviewState } : {}) });

describe('componentKind', () => {
  it('names the library an entity or a dictionary listing belongs in', () => {
    expect(componentKind({ kind: 'entity' })).toBe('entity');
    expect(componentKind({ kind: 'dictionary' })).toBe('dictionary');
  });

  it('answers nothing for a kind with no component library', () => {
    // An Avatar cannot be required or offered; a world is not a component at all.
    expect(componentKind({ kind: 'model' })).toBeNull();
    expect(componentKind({ kind: 'world' })).toBeNull();
    // A row that predates the column defaults to a world, which is still not a component.
    expect(componentKind({})).toBeNull();
  });
});

describe('listingId', () => {
  it('reads either spelling the catalog uses', () => {
    expect(listingId({ _id: 'a' })).toBe('a');
    expect(listingId({ id: 'b' })).toBe('b');
    expect(listingId({})).toBe('');
  });
});

describe('addonTabs', () => {
  it('puts approved offerings in their own tab and everything else in the community tab', () => {
    const tabs = addonTabs([addon('a', 'approved'), addon('b', 'unreviewed'), addon('c')]);
    expect(tabs.approved.map(listingId)).toEqual(['a']);
    expect(tabs.community.map(listingId)).toEqual(['b', 'c']);
  });

  it('offers a declined add-on in neither tab', () => {
    // The world author sees declined rows from the server, because their review list is the same list.
    // Offering one back to them here would put content they turned away in their own download review.
    const tabs = addonTabs([addon('a', 'approved'), addon('d', 'declined')]);
    expect(tabs.approved.map(listingId)).toEqual(['a']);
    expect(tabs.community).toEqual([]);
  });
});

describe('selectedAddons', () => {
  const addons = [addon('a', 'approved'), addon('b', 'unreviewed'), addon('d', 'declined')];

  it('keeps only what the player picked, approved first', () => {
    expect(selectedAddons(addons, ['b', 'a']).map(listingId)).toEqual(['a', 'b']);
  });

  it('drops a selection the world no longer offers', () => {
    // A declined offering is not selectable, so a stale id must not smuggle one into the download.
    expect(selectedAddons(addons, ['d', 'gone'])).toEqual([]);
  });
});

describe('downloadItemCount', () => {
  const resolved = (id: string): DependencyRow =>
    ({ id, status: 'ok', listing: { _id: id, name: id, kind: 'dictionary' } });
  const dependencies = [resolved('r1'), resolved('r2')];

  it('counts every required source plus the selected add-ons', () => {
    expect(downloadItemCount(dependencies, [addon('a', 'approved')], ['a'])).toBe(3);
  });

  it('counts the required sources alone when nothing optional is picked', () => {
    expect(downloadItemCount(dependencies, [addon('a', 'approved')], [])).toBe(2);
  });

  it('does not count a required source the server could not resolve', () => {
    // The button would otherwise promise an install that cannot complete: a dead source keeps the world
    // pending rather than arriving with it.
    const withDead: DependencyRow[] = [...dependencies, { id: 'gone', status: 'not_found' }];
    expect(downloadItemCount(withDead, [], [])).toBe(2);
  });
});

describe('linkInstalledSources', () => {
  const installed: InstalledSource[] = [
    { sourceId: 'dep-1', libraryId: 'lib-1', name: 'Guide', revision: 'R1' },
  ];

  const world = () => ({
    entities: [
      { id: 'e1', name: 'Guide', link: { sourceId: 'dep-1', sourceName: 'Guide', connections: { p1: 'w1' } } },
      { id: 'e2', name: 'Local' },
    ] as Entity[],
    dictionaries: [{ id: 'd1', name: 'Lore', link: { sourceId: 'dep-2' } }] as Dictionary[],
  });

  it('gives a required copy the library item behind the listing it names', () => {
    const linked = linkInstalledSources(world(), installed);
    expect(linked.entities?.[0].link).toEqual({
      sourceId: 'dep-1', sourceName: 'Guide', libraryId: 'lib-1', sourceRevision: 'R1',
      connections: { p1: 'w1' },
    });
  });

  it('leaves an embedded copy and a copy for an uninstalled source alone', () => {
    const linked = linkInstalledSources(world(), installed);
    expect(linked.entities?.[1].link).toBeUndefined();
    expect(linked.dictionaries?.[0].link).toEqual({ sourceId: 'dep-2' });
  });

  it('returns the world untouched when nothing was installed', () => {
    const content = world();
    expect(linkInstalledSources(content, [])).toBe(content);
  });
});
