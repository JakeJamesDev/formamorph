import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Entity, WorldOverview } from '@/types';
import { runRules, type RuleWorld } from './rules';
import { useBenchFindings } from './useBenchFindings';

// Structurally sound, so only the authored alias defect fires.
const world = (entities: Entity[]): RuleWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: '' } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: entities.map((e) => ({ locations: ['harbor'], ...e })),
  traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

const findingsFor = (aliases: string[]) =>
  runRules(world([{ id: 'e1', name: 'Maren', aliases }]));

const articled = findingsFor(['the visitor']);

const renderBench = (findings = articled, worldId: string | null = 'w1', source?: string) =>
  renderHook(
    ({ f, s }: { f: typeof articled; s?: string }) => useBenchFindings(worldId, s, f),
    { initialProps: { f: findings, s: source } },
  );

beforeEach(() => localStorage.clear());

describe('useBenchFindings', () => {
  it('reads a finding the author has never been shown as new', () => {
    const { result } = renderBench();
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.newCount).toBe(1);
  });

  it('goes quiet once the list has been marked seen', () => {
    const { result } = renderBench();
    act(() => result.current.markAllSeen());
    expect(result.current.newCount).toBe(0);
    // Still listed: seen means known, not fixed.
    expect(result.current.groups).toHaveLength(1);
  });

  it('remembers that across a reload', () => {
    const first = renderBench();
    act(() => first.result.current.markAllSeen());
    first.unmount();
    expect(renderBench().result.current.newCount).toBe(0);
  });

  it('knows what has been seen on its very first render, before any effect runs', () => {
    const first = renderBench();
    act(() => first.result.current.markAllSeen());
    first.unmount();
    // Every render's answer, not just the settled one: a record read in an effect would paint the loud badge
    // for the frame before it — the one thing a badge that means "something changed" must never do.
    const perRender: number[] = [];
    renderHook(() => {
      const bench = useBenchFindings('w1', undefined, articled);
      perRender.push(bench.newCount);
      return bench;
    });
    expect(perRender[0]).toBe(0);
  });

  it('holds the marks while the world’s metadata has not arrived yet', () => {
    const first = renderBench(articled, 'w1', 'T1');
    act(() => first.result.current.markAllSeen());
    first.unmount();
    // The editor can mount before `worldMetadata` does, handing the hook no version at all.
    expect(renderBench(articled, 'w1', undefined).result.current.newCount).toBe(0);
  });

  it('raises the finding again when the item it names is edited', () => {
    const { result, rerender } = renderBench();
    act(() => result.current.markAllSeen());
    rerender({ f: findingsFor(['the wanderer']), s: undefined });
    expect(result.current.newCount).toBe(1);
  });

  it('keeps each world’s marks to itself', () => {
    const first = renderBench(articled, 'w1');
    act(() => first.result.current.markAllSeen());
    first.unmount();
    expect(renderBench(articled, 'w2').result.current.newCount).toBe(1);
  });

  it('still tracks newness for an unsaved world, without a record to keep it in', () => {
    const { result } = renderBench(articled, null);
    expect(result.current.newCount).toBe(1);
    act(() => result.current.markAllSeen());
    expect(result.current.newCount).toBe(0);
    expect(localStorage.getItem('FORMAMORPH_benchFindingState')).toBeNull();
  });
});

describe('useBenchFindings source updates', () => {
  it('clears the marks when a downloaded world’s source moved on', () => {
    const { result, rerender } = renderBench(articled, 'w1', 'T1');
    act(() => result.current.markAllSeen());
    expect(result.current.newCount).toBe(0);
    rerender({ f: articled, s: 'T2' });
    expect(result.current.newCount).toBe(1);
  });

  it('keeps them through a re-download of unchanged content', () => {
    const { result, rerender } = renderBench(articled, 'w1', 'T1');
    act(() => result.current.markAllSeen());
    rerender({ f: articled, s: 'T1' });
    expect(result.current.newCount).toBe(0);
  });

  it('writes the cleared set through, so the reset survives the reload too', () => {
    const first = renderBench(articled, 'w1', 'T1');
    act(() => first.result.current.markAllSeen());
    first.rerender({ f: articled, s: 'T2' });
    first.unmount();
    expect(renderBench(articled, 'w1', 'T2').result.current.newCount).toBe(1);
  });
});

describe('useBenchFindings dismissal', () => {
  it('takes the row out of the list and offers it back', () => {
    const { result } = renderBench();
    act(() => result.current.dismissRule('alias-leading-article'));
    expect(result.current.groups).toEqual([]);
    expect(result.current.dismissedGroups).toHaveLength(1);
    act(() => result.current.restoreRule('alias-leading-article'));
    expect(result.current.groups).toHaveLength(1);
  });

  it('keeps the row muted across a reload', () => {
    const first = renderBench();
    act(() => first.result.current.dismissRule('alias-leading-article'));
    first.unmount();
    expect(renderBench().result.current.groups).toEqual([]);
  });

  it('keeps the row muted through a re-download of unchanged content', () => {
    const first = renderBench(articled, 'w1', 'T1');
    act(() => first.result.current.dismissRule('alias-leading-article'));
    first.unmount();
    expect(renderBench(articled, 'w1', 'T1').result.current.groups).toEqual([]);
  });

  it('leaves a dismissal standing when the source updates — it was the author’s own call', () => {
    const first = renderBench(articled, 'w1', 'T1');
    act(() => first.result.current.dismissRule('alias-leading-article'));
    first.unmount();
    expect(renderBench(articled, 'w1', 'T2').result.current.groups).toEqual([]);
  });

  it('counts only the live rows as new', () => {
    const { result } = renderBench();
    act(() => result.current.dismissRule('alias-leading-article'));
    expect(result.current.newCount).toBe(0);
  });
});
