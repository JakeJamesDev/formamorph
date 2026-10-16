// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { narrationStream } from './aiRequest/narrationStream';
import { rewriteSentences } from './aiRequest/narrationRewrite';
import type { TransportEvent } from './aiRequest/requestTransport';
import { narrationRevealListener } from './narrationRevealListener';
import { useSmoothedReveal } from './useSmoothedReveal';

const TEXT = 'The door creaks. Wind howls. Rain falls';
/** The reply token by token: each delta carries all of it so far. */
const deltas = (): TransportEvent[] => {
  let content = '';
  return TEXT.split(/(?<=\s)/).map((step) => ({ type: 'delta', content: (content += step) }));
};
const done: TransportEvent = { type: 'done', text: TEXT, raw: TEXT, reasoningText: '', finishReason: 'stop' };
const fade = { push: () => {}, finish: () => {}, reset: () => {} };

/** The crawl's every frame while `TEXT` streams, through a rewrite that shouts each sentence when `shout`. */
async function crawlFrames(wholeSentences: boolean, shout: boolean) {
  const frames: string[] = [];
  const crawl = renderHook(() => useSmoothedReveal((text) => frames.push(text))).result.current;
  const reveal = narrationRevealListener({ fade, crawl, paced: false, wholeSentences, onOpened: () => {} });
  const rewriting = shout ? rewriteSentences((sentence) => sentence.toUpperCase(), reveal) : null;
  const sink = narrationStream(rewriting ? rewriting.listener : reveal);
  sink({ type: 'opened' });
  for (const event of deltas()) {
    sink(event);
    await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(16); });
  }
  sink(done);
  await act(async () => { await rewriting?.final(); vi.advanceTimersByTime(5000); });
  return frames;
}

describe('narrationRevealListener, smooth crawl', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] }));
  afterEach(() => vi.useRealTimers());

  it('never shows text a During AI Output script has not passed when the crawl holds to sentences', async () => {
    const frames = await crawlFrames(true, true);
    const final = 'THE DOOR CREAKS. WIND HOWLS. RAIN FALLS';
    expect(frames.at(-1)).toBe(final);
    for (const frame of frames) expect(final.startsWith(frame)).toBe(true);
  });

  it("crawls every display event's full text, tail included, when the world has no such script", () => {
    const targets: string[] = [];
    const crawl = { push: (target: string) => targets.push(target), finish: (text: string) => targets.push(text), reset: () => {} };
    const reveal = narrationRevealListener({ fade, crawl, paced: false, wholeSentences: false, onOpened: () => {} });
    const displayed: string[] = [];
    const sink = narrationStream(reveal, (event) => { if (event.type === 'display') displayed.push(event.text); });
    [{ type: 'opened' } as const, ...deltas(), done].forEach(sink);
    expect(targets).toEqual([...displayed, TEXT]);
    expect(targets).toContain('The door creaks. Wind howls. Rain ');
  });
});
