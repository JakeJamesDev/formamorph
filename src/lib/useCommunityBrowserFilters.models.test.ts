import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCommunityBrowserFilters } from './useCommunityBrowserFilters';
import { type BrowseTab } from '@/lib/browseTabs';
import { type WorldRecord } from '@/components/WorldDetails';

/**
 * The Models filter of the Prompts section: substring match on the listing's models, its `model:` search
 * prefix, and its place in the stored per-section filters.
 */

const catalog: WorldRecord[] = [
  { id: 'p1', name: 'Cydonia Tuned', kind: 'prompt', models: ['Cydonia-24B-v4.1'], author: { id: 'x', username: 'Wren' }, tags: ['horror'], updated_at: '2026-03-01T00:00:00.000Z' },
  { id: 'p2', name: 'Mero Tuned', kind: 'prompt', models: ['G4-MeroMero-31B', 'Silver-Siren-ST-12B'], author: { id: 'y', username: 'Ash' }, tags: ['romance'], updated_at: '2026-03-02T00:00:00.000Z' },
  { id: 'p3', name: 'Siren Tuned', kind: 'prompt', models: ['silver-siren-st-12b'], author: { id: 'x', username: 'Wren' }, tags: ['romance'], updated_at: '2026-03-03T00:00:00.000Z' },
  { id: 'p4', name: 'No Models', kind: 'prompt', author: { id: 'y', username: 'Ash' }, tags: [], updated_at: '2026-03-04T00:00:00.000Z' },
  { id: 'w1', name: 'A World', kind: 'world', author: { id: 'x', username: 'Wren' }, tags: ['horror'], updated_at: '2026-03-05T00:00:00.000Z' },
] as unknown as WorldRecord[]; // fixtures carry only the fields the pipeline reads

const downloadStateOf = () => 'none' as const;

const render = (tab: BrowseTab = 'prompt') =>
  renderHook(() => useCommunityBrowserFilters(catalog, downloadStateOf, true, tab));

const names = (list: WorldRecord[]) => list.map((w) => w.name).sort();

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    media: '',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Models filter', () => {
  it('keeps every listing when empty', () => {
    const { result } = render();
    expect(result.current.modelFilter).toEqual([]);
    expect(names(result.current.filteredRemoteWorlds)).toEqual(['Cydonia Tuned', 'Mero Tuned', 'No Models', 'Siren Tuned']);
  });

  it('matches a substring of any model, ignoring case', () => {
    const { result } = render();
    act(() => result.current.setModelFilter(['SIREN']));
    expect(names(result.current.filteredRemoteWorlds)).toEqual(['Mero Tuned', 'Siren Tuned']);
  });

  it('matches a listing when any chip hits any model', () => {
    const { result } = render();
    act(() => result.current.setModelFilter(['cydonia', 'meromero']));
    expect(names(result.current.filteredRemoteWorlds)).toEqual(['Cydonia Tuned', 'Mero Tuned']);
  });

  it('counts as an active filter and clears with the rest', () => {
    const { result } = render();
    act(() => result.current.setModelFilter(['cydonia']));
    expect(result.current.activeFilterCount).toBe(1);
    act(() => result.current.clearFilters());
    expect(result.current.modelFilter).toEqual([]);
  });

  it('suggests the models on the listings in view, one per spelling ignoring case', () => {
    const { result } = render();
    expect(result.current.allModels).toEqual(['Cydonia-24B-v4.1', 'G4-MeroMero-31B', 'Silver-Siren-ST-12B']);
  });
});

describe('model: search prefix', () => {
  it('becomes a model chip and filters', () => {
    const { result } = render();
    act(() => result.current.applySearchInput('model:cydonia ', false));
    expect(result.current.modelFilter).toEqual(['cydonia']);
    expect(result.current.searchQuery.trim()).toBe('');
    expect(names(result.current.filteredRemoteWorlds)).toEqual(['Cydonia Tuned']);
  });

  it('combines with tag: and author:', () => {
    const { result } = render();
    act(() => result.current.applySearchInput('model:siren tag:romance author:Wren', true));
    expect(result.current.modelFilter).toEqual(['siren']);
    expect(result.current.tagFilter).toEqual(['romance']);
    expect(result.current.authorFilter).toEqual(['Wren']);
    expect(names(result.current.filteredRemoteWorlds)).toEqual(['Siren Tuned']);
  });

  it('stays search text in a section without the Models filter', () => {
    const { result } = render('world');
    act(() => result.current.applySearchInput('model:cydonia', true));
    expect(result.current.modelFilter).toEqual([]);
    expect(result.current.searchQuery).toBe('model:cydonia');
  });
});

describe('stored filters', () => {
  it('keeps every section of a value stored before the Models filter existed', () => {
    const stored = {
      world: { authorFilter: ['Wren'], tagFilter: ['horror'], tagMode: 'all', statusFilter: ['liked'], sortField: 'likes', sortOrder: 'asc', sortUpdatesFirst: false },
      prompt: { authorFilter: ['Ash'], tagFilter: [], tagMode: 'any', statusFilter: [], sortField: 'downloads', sortOrder: 'desc', sortUpdatesFirst: true },
    };
    localStorage.setItem('FORMAMORPH_communityFilters', JSON.stringify(stored));

    const world = render('world').result.current;
    expect(world.authorFilter).toEqual(['Wren']);
    expect(world.tagFilter).toEqual(['horror']);
    expect(world.tagMode).toBe('all');
    expect(world.statusFilter).toEqual(['liked']);
    expect(world.sortField).toBe('likes');
    expect(world.sortOrder).toBe('asc');
    expect(world.sortUpdatesFirst).toBe(false);

    const prompt = render('prompt').result.current;
    expect(prompt.authorFilter).toEqual(['Ash']);
    expect(prompt.sortField).toBe('downloads');
    expect(prompt.modelFilter).toEqual([]);
  });

  it('persists the model chips with the section', () => {
    const first = render();
    act(() => first.result.current.setModelFilter(['cydonia']));
    first.unmount();
    expect(render().result.current.modelFilter).toEqual(['cydonia']);
    expect(render('world').result.current.modelFilter).toEqual([]);
  });
});
