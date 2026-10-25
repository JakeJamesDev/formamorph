// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { openOutputRun } from './outputRun';
import { narrationStream, type NarrationEvent } from './aiRequest/narrationStream';
import { rewriteSentences } from './aiRequest/narrationRewrite';
import { narrationRevealListener } from './narrationRevealListener';
import { getRevealReleased, getRevealTiming } from './revealTimingStore';
import { useSentenceReveal } from './useSentenceReveal';
import type { TransportEvent } from './aiRequest/requestTransport';
import { statCodeTurnOf } from '@/test/statCodeTurnFixture';

/** A turn whose one world script reports what sentence 3 reads, and shouts every other sentence. */
const turn = statCodeTurnOf({
  stats: [], enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {},
  ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  worldScripts: [{
    id: 'w', timing: 'output',
    code: 'narration.sentence = narration.index === 3 ? JSON.stringify([narration.sent, narration.buffered]) : narration.sentence.toUpperCase();',
  }],
});

const settle = () => new Promise<void>((resolve) => { setImmediate(resolve); });
// A wall-clock hang guard, matching `asyncUtilTimeout`: each wait spans real QuickJS runs, whose tick count grows on a slower machine.
async function until(done: () => boolean, ms = 10_000) {
  const deadline = performance.now() + ms;
  while (!done() && performance.now() < deadline) await act(settle);
  expect(done()).toBe(true);
}

describe('During AI Output with the fade reveal', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  it("shows sentence 3's script the pacer's release index at that moment", async () => {
    const fade = renderHook(() => useSentenceReveal(() => {})).result.current;
    const crawl = { push: () => {}, finish: () => {}, reset: () => {} };
    const readAt: number[] = [];
    const run = openOutputRun(turn, {
      released: () => {
        readAt.push(getRevealReleased());
        return readAt.at(-1)!;
      },
    })!;
    const heard: NarrationEvent[] = [];
    const reveal = narrationRevealListener({ fade, crawl, paced: true, wholeSentences: true, onOpened: () => {} });
    const rewriting = rewriteSentences(run.rewrite, reveal, (event) => heard.push(event));
    const sink = narrationStream(rewriting.listener);
    const delta = (content: string): TransportEvent => ({ type: 'delta', content });
    const displayed = (sentences: number) => () => heard.some((e) => e.type === 'display' && e.sentences === sentences);

    act(() => { sink({ type: 'opened' }); });
    for (const content of ['One. T', 'One. Two. T', 'One. Two. Three. F']) act(() => { sink(delta(content)); });
    // The first sentence shows at once; the pacer holds the next two behind its rhythm.
    await until(displayed(3));
    expect(getRevealReleased()).toBe(1);
    // "One." is one word, so its rhythm span is one stagger.
    act(() => { vi.advanceTimersByTime(getRevealTiming().stagger); });
    expect(getRevealReleased()).toBe(2);

    act(() => { sink(delta('One. Two. Three. Four. F')); });
    await until(displayed(4));
    const third = heard.find((e) => e.type === 'sentence' && e.index === 3);
    expect(readAt.at(-1)).toBe(2);
    expect(third).toMatchObject({ text: JSON.stringify([['ONE.', 'TWO.'], ['THREE.']]) });
  });
});
