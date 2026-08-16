import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Entity, WorldOverview } from '@/types';
import { useDebouncedFindings } from './useFindings';
import type { RuleWorld } from './rules';

// Structurally sound (a starting location, the entity placed there), so only the authored alias defect fires.
const world = (entities: Entity[]): RuleWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: '' } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: entities.map((e) => ({ locations: ['harbor'], ...e })),
  traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

const clean = world([{ id: 'e1', name: 'Maren' }]);
const broken = world([{ id: 'e1', name: 'Maren', aliases: ['the visitor'] }]);

afterEach(() => vi.useRealTimers());

describe('useDebouncedFindings', () => {
  it('has the world diagnosed before the first paint', () => {
    const { result } = renderHook(() => useDebouncedFindings(broken));
    expect(result.current).toHaveLength(1);
  });

  it('holds the previous answer until the edits stop', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ w }) => useDebouncedFindings(w, 400), {
      initialProps: { w: clean },
    });
    rerender({ w: broken });
    expect(result.current).toEqual([]);
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current).toHaveLength(1);
  });

  it('does not run a pass per keystroke — only the last world is diagnosed', () => {
    vi.useFakeTimers();
    const typing = ['t', 'th', 'the visitor'].map((alias) => world([{ id: 'e1', name: 'Maren', aliases: [alias] }]));
    const { result, rerender } = renderHook(({ w }) => useDebouncedFindings(w, 400), {
      initialProps: { w: clean },
    });
    for (const w of typing) {
      rerender({ w });
      act(() => { vi.advanceTimersByTime(300) });
    }
    // Each rerender restarted the clock, so nothing has been recomputed yet.
    expect(result.current).toEqual([]);
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current).toHaveLength(1);
  });
});
