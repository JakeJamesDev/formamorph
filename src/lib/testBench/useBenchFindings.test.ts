import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Entity, WorldOverview } from '@/types';
import { runRules, type RuleWorld } from './rules';
import { useBenchFindings } from './useBenchFindings';

// Structurally sound and described, so only the authored alias defect fires.
const world = (entities: Entity[]): RuleWorld => ({
  worldOverview: {
    name: 'Sedge Landing', description: '', systemPrompt: 'Narrate the fen.', readme: 'A fen primer.',
  } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: entities.map((e) => ({
    locations: ['harbor'], playerDescription: 'Seen around.', aiDescription: 'A fen regular.', ...e,
  })),
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

/** The same hook standing in one editor mode or the other, which is all the fold depends on. */
const renderInMode = (advanced: boolean, findings: ReturnType<typeof runRules>, worldId = 'w1') =>
  renderHook(
    ({ a }: { a: boolean }) => useBenchFindings(worldId, undefined, findings, a),
    { initialProps: { a: advanced } },
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

describe('useBenchFindings in Simple mode', () => {
  // One finding of each kind: an articled alias (Aliases is an Advanced-only field) and an entity with no
  // player description (a field Simple shows, so its author can act on it).
  const mixed = runRules(world([
    { id: 'e1', name: 'Maren', aliases: ['The Visitor'] },
    { id: 'e2', name: 'Old Tobb', playerDescription: '' },
  ]));

  it('lists only the rows this mode can act on, and counts the rest', () => {
    const { result } = renderInMode(false, mixed);
    expect(result.current.groups.map((g) => g.ruleId)).toEqual(['entity-missing-player-description']);
    expect(result.current.advancedOnlyCount).toBe(1);
  });

  it('leaves the list whole in Advanced, with nothing folded away', () => {
    const { result } = renderInMode(true, mixed);
    expect(result.current.groups.map((g) => g.ruleId).sort())
      .toEqual(['alias-leading-article', 'entity-missing-player-description']);
    expect(result.current.advancedOnlyCount).toBe(0);
  });

  it('keeps the folded rows off the badge’s new count', () => {
    const { result } = renderInMode(false, mixed);
    // Both rows are unseen; only the one on screen is something the author can be told about.
    expect(result.current.newCount).toBe(1);
    act(() => result.current.markAllSeen());
    expect(result.current.newCount).toBe(0);
  });

  it('still reads a folded row as new the first time Advanced shows it', () => {
    const simple = renderInMode(false, mixed);
    act(() => simple.result.current.markAllSeen());
    simple.unmount();
    // New means "you haven't seen this", not "the Bench counted it somewhere once".
    const { result } = renderInMode(true, mixed);
    expect(result.current.groups.find((g) => g.ruleId === 'alias-leading-article')?.newCount).toBe(1);
    expect(result.current.groups.find((g) => g.ruleId === 'entity-missing-player-description')?.newCount).toBe(0);
    expect(result.current.newCount).toBe(1);
  });

  it('counts one row per rule, however many findings are folded into it', () => {
    const many = runRules(world([
      { id: 'e1', name: 'Maren', aliases: ['The Visitor'] },
      { id: 'e2', name: 'Old Tobb', aliases: ['The Fishmonger'] },
    ]));
    expect(renderInMode(false, many).result.current.advancedOnlyCount).toBe(1);
  });

  it('reports a world whose every finding is folded as having something to fold', () => {
    const hidden = runRules(world([{ id: 'e1', name: 'Maren', aliases: ['The Visitor'] }]));
    const { result } = renderInMode(false, hidden);
    expect(result.current.groups).toEqual([]);
    expect(result.current.advancedOnlyCount).toBe(1);
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
