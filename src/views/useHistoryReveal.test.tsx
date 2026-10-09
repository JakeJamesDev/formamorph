import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { HistoryMoveEvent } from '@/contexts/worldRecorder';
import { createHistory, diffSlice, record, type SliceEdit, type SliceName, type WorldSlices } from '@/lib/editorHistory';
import type { Connection, Stat } from '@/types';
import { useHistoryReveal, type HistoryRevealOptions } from './useHistoryReveal';

/** The editor's side of a reveal: which calls an undo or redo makes on the tabs, the selection and the canvas. */

// Reveal reads ids and names only, so the fixtures carry no other field.
const stat = (id: string): Stat => ({ id, name: id } as unknown as Stat);
const wire = (id: string): Connection => ({ id } as unknown as Connection);

const world = (over: Partial<WorldSlices> = {}): WorldSlices => ({
  worldOverview: { name: 'Sedge Landing' } as WorldSlices['worldOverview'], stats: [], locations: [], connections: [],
  entities: [], entityGroups: [], traits: [], traitGroups: [], statUpdates: [], dictionaries: [], placeholders: [],
  placeholderGroups: [], ...over,
});

/** A move over the Step that added `after[0]` to an empty slice, leaving the world as `left` says. */
const moveOf = <S extends SliceName>(slice: S, after: WorldSlices[S], left: WorldSlices): HistoryMoveEvent => ({
  // The slice is generic here, and an empty list is the earlier side of every record slice.
  steps: record(createHistory(), [diffSlice(slice, [] as unknown as WorldSlices[S], after) as SliceEdit]).steps,
  world: left,
});

const setup = (over: Partial<HistoryRevealOptions> = {}) => {
  let hear: ((move: HistoryMoveEvent) => void) | null = null;
  const calls = {
    setActiveTab: vi.fn(), clearSearch: vi.fn(), setLocationView: vi.fn(), navigateToItem: vi.fn(),
  };
  const view = renderHook(() => useHistoryReveal({
    onMove: (listener) => { hear = listener; return () => { hear = null; }; },
    touring: false,
    visibleTabs: [{ value: 'stats' }, { value: 'locations' }, { value: 'overview' }],
    holds: () => false,
    ...calls,
    ...over,
  }));
  return { calls, view, move: (event: HistoryMoveEvent) => act(() => { hear?.(event); }) };
};

describe('useHistoryReveal', () => {
  it('opens a restored record through the find bar\'s route', () => {
    const { calls, move } = setup();
    move(moveOf('stats', [stat('a')], world({ stats: [stat('a')] })));
    expect(calls.navigateToItem).toHaveBeenCalledWith('stats', 'a');
  });

  it('only opens the tab for a record the move removed', () => {
    const { calls, move } = setup();
    move(moveOf('stats', [stat('a')], world()));
    expect(calls.setActiveTab).toHaveBeenCalledWith('stats');
    expect(calls.navigateToItem).not.toHaveBeenCalled();
  });

  it('does nothing for a tab the editor mode hides', () => {
    const { calls, move } = setup({ visibleTabs: [{ value: 'overview' }] });
    move(moveOf('stats', [stat('a')], world({ stats: [stat('a')] })));
    expect(calls.setActiveTab).not.toHaveBeenCalled();
    expect(calls.navigateToItem).not.toHaveBeenCalled();
  });

  it('does nothing while the tour runs', () => {
    const { calls, move } = setup({ touring: true });
    move(moveOf('stats', [stat('a')], world({ stats: [stat('a')] })));
    expect(calls.setActiveTab).not.toHaveBeenCalled();
    expect(calls.navigateToItem).not.toHaveBeenCalled();
  });

  it('opens the canvas for a connection and hands the canvas one request until it takes it', () => {
    const { calls, view, move } = setup();
    move(moveOf('connections', [wire('c1')], world({ connections: [wire('c1')] })));
    expect(calls.setActiveTab).toHaveBeenCalledWith('locations');
    expect(calls.setLocationView).toHaveBeenCalledWith('canvas');
    expect(view.result.current.connectionReveal).toEqual({ id: 'c1' });

    act(() => view.result.current.clearConnectionReveal());
    expect(view.result.current.connectionReveal).toBeNull();
  });

  it('hands the canvas the whole selection of an Origin and shows the canvas to take it', () => {
    const { calls, view, move } = setup({ holds: (_tab, id) => id !== 'c' });
    const steps = record(createHistory(), [diffSlice('stats', [], [stat('x')]) as SliceEdit], {
      origin: { tab: 'locations', ids: ['a', 'b', 'c'] },
    }).steps;
    move({ steps, world: world({ stats: [stat('x')] }) });
    expect(calls.navigateToItem).toHaveBeenCalledWith('locations', 'a');
    expect(calls.setLocationView).toHaveBeenCalledWith('canvas');
    expect(view.result.current.selectionReveal).toEqual({ ids: ['a', 'b'] });

    act(() => view.result.current.clearSelectionReveal());
    expect(view.result.current.selectionReveal).toBeNull();
  });

  it('makes no canvas request for a single record', () => {
    const { calls, view, move } = setup();
    move(moveOf('stats', [stat('a')], world({ stats: [stat('a')] })));
    expect(calls.setLocationView).not.toHaveBeenCalled();
    expect(view.result.current.selectionReveal).toBeNull();
  });

  it('marks a removed connection as gone so the canvas can drop it', () => {
    const { view, move } = setup();
    move(moveOf('connections', [wire('c1')], world()));
    expect(view.result.current.connectionReveal).toEqual({ id: 'c1', gone: true });
  });
});
