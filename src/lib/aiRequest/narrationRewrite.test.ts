import { afterEach, describe, expect, it, vi } from 'vitest';
import { narrationStream, type NarrationEvent } from './narrationStream';
import { rewriteSentences, type SentenceRewrite } from './narrationRewrite';
import type { TransportEvent } from './requestTransport';

const opened: TransportEvent = { type: 'opened' };
/** The transport's running reply grows token by token; each delta carries all of it so far. */
const deltas = (...steps: string[]): TransportEvent[] => {
  let content = '';
  return steps.map((step) => ({ type: 'delta', content: (content += step) }));
};
const done = (text: string): TransportEvent => ({ type: 'done', text, raw: text, reasoningText: '', finishReason: 'stop' });
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const flush = () => sleep(0);

/** Rewrites the test settles itself: each held call waits until `releaseAll`, which also settles any call a
 *  release starts, so no real timer races the assertions. */
function heldRewrites(holds: (sentence: string) => boolean = () => true) {
  const waiting: (() => void)[] = [];
  const rewrite: SentenceRewrite = (sentence) =>
    (holds(sentence) ? new Promise<string>((resolve) => waiting.push(() => resolve(sentence))) : sentence);
  const releaseAll = async () => {
    await flush();
    while (waiting.length) {
      waiting.shift()!();
      await flush();
    }
  };
  return { rewrite, releaseAll, waiting };
}

/** A Narration Stream feeding rewritten events to one listener. */
function wire(rewrite: SentenceRewrite) {
  const heard: NarrationEvent[] = [];
  const rewriting = rewriteSentences(rewrite, (event) => heard.push(event));
  const sink = narrationStream(rewriting.listener);
  return { heard, final: rewriting.final, abandon: rewriting.abandon, feed: (events: TransportEvent[]) => events.forEach(sink) };
}

const LINKED = 'The [door](https://example.test) creaks.';
const link: SentenceRewrite = (sentence) => sentence.replace('door', '[door](https://example.test)');
const sentences = (heard: NarrationEvent[]) =>
  heard.flatMap((e) => (e.type === 'sentence' ? [[e.index, e.text] as const] : []));
const partials = (heard: NarrationEvent[]) => heard.flatMap((e) => (e.type === 'partial' ? [e.text] : []));
const last = <T extends NarrationEvent['type']>(heard: NarrationEvent[], type: T) =>
  heard.filter((e): e is Extract<NarrationEvent, { type: T }> => e.type === type).at(-1);

afterEach(() => vi.restoreAllMocks());

describe('rewriteSentences', () => {
  it('carries a rewritten sentence in every copy: sentence, display, partial and finished', async () => {
    const { heard, feed, final } = wire(link);
    feed([opened, ...deltas('The door creaks.', ' Wind howls'), done('The door creaks. Wind howls')]);
    expect(await final()).toBe(`${LINKED} Wind howls`);
    expect(sentences(heard)).toEqual([[0, LINKED], [1, 'Wind howls']]);
    expect(heard.filter((e) => e.type === 'display').at(1)).toMatchObject({ text: `${LINKED} Wind howls`, revealed: LINKED });
    expect(partials(heard).at(-1)).toBe(`${LINKED} Wind howls`);
    expect(last(heard, 'finished')).toEqual({ type: 'finished', text: `${LINKED} Wind howls` });
  });

  it('keeps sentences in order when a script is slow on the even ones', async () => {
    const slowEven: SentenceRewrite = async (sentence, { index }) => {
      await sleep(index % 2 === 0 ? 25 : 0);
      return `${index}:${sentence}`;
    };
    const { heard, feed, final } = wire(slowEven);
    feed([opened, ...deltas('One. Two. Three. Four. Fi', 've.'), done('One. Two. Three. Four. Five.')]);
    expect(await final()).toBe('0:One. 1:Two. 2:Three. 3:Four. 4:Five.');
    expect(sentences(heard).map(([index]) => index)).toEqual([0, 1, 2, 3, 4]);
    const order = heard.flatMap((e) => (e.type === 'sentence' || e.type === 'display' || e.type === 'finished' ? [e.type] : []));
    expect(order.at(-1)).toBe('finished');
    // A display never shows a sentence before its own sentence event.
    for (const [at, event] of heard.entries()) {
      if (event.type !== 'display' || !event.revealed) continue;
      const released = heard.slice(0, at).filter((e) => e.type === 'sentence').length;
      expect(event.revealed.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(released);
    }
  });

  it('releases a rewrite holding two sentences as one sentence event and keeps the indexes', async () => {
    const { heard, feed, final } = wire((sentence) => (sentence === 'Two.' ? 'Two. And a half.' : sentence));
    feed([opened, ...deltas('One. Two. Three.'), done('One. Two. Three.')]);
    expect(await final()).toBe('One. Two. And a half. Three.');
    expect(sentences(heard)).toEqual([[0, 'One.'], [1, 'Two. And a half.'], [2, 'Three.']]);
    expect(last(heard, 'display')).toMatchObject({ revealed: 'One. Two. And a half.' });
  });

  it('passes a sentence unchanged when its rewrite fails', async () => {
    const failure = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { heard, feed, final } = wire((sentence) => {
      if (sentence === 'Two.') throw new Error('script broke');
      return sentence.toUpperCase();
    });
    feed([opened, ...deltas('One. Two. Three.'), done('One. Two. Three.')]);
    expect(await final()).toBe('ONE. Two. THREE.');
    expect(sentences(heard).map(([, text]) => text)).toEqual(['ONE.', 'Two.', 'THREE.']);
    expect(failure).toHaveBeenCalled();
  });

  it('shows a script the narration as it stands: rewritten sentences, then the current one and the tail as written', async () => {
    const seen: string[] = [];
    const { feed, final } = wire((sentence, { full }) => {
      seen.push(full);
      return `<${sentence}>`;
    });
    feed([opened, ...deltas('One. Two. Th', 'ree.'), done('One. Two. Three.')]);
    await final();
    expect(seen).toEqual(['One. Two. Th', '<One.> Two. Th', '<One.> <Two.> Three.']);
  });

  it('shows a script the earlier sentences as rewritten, and none of a retracted round', async () => {
    const seen: (readonly string[])[] = [];
    const { feed, final } = wire((sentence, { earlier }) => {
      seen.push(earlier);
      return `<${sentence}>`;
    });
    feed([opened, ...deltas('Hm. Plan')]);
    await vi.waitFor(() => expect(seen).toHaveLength(1), { timeout: 10_000 });
    feed([{ type: 'retract' }, ...deltas('One. Two. Th', 'ree.'), done('One. Two. Three.')]);
    await final();
    expect(seen).toEqual([[], [], ['<One.>'], ['<One.>', '<Two.>']]);
  });

  it('drops queued work when the request is canceled', async () => {
    const held = heldRewrites();
    const { heard, feed, final } = wire(held.rewrite);
    feed([opened, ...deltas('One. Two. Three. Fo')]);
    await flush();
    expect(held.waiting).toHaveLength(1);
    feed([{ type: 'canceled' }]);
    expect(await final()).toBeUndefined();
    await held.releaseAll();
    expect(heard.at(-1)).toEqual({ type: 'canceled' });
    expect(sentences(heard)).toEqual([]);
  });

  it('restarts the round on a retract, and drops the old round\'s pending sentences', async () => {
    const held = heldRewrites((sentence) => sentence === 'Let me check.');
    const { heard, feed, final } = wire(held.rewrite);
    feed([opened, ...deltas('Let me check. Hm'), { type: 'retract' }, ...deltas('The door creaks.', ' Wind'), done('The door creaks. Wind')]);
    await held.releaseAll();
    expect(await final()).toBe('The door creaks. Wind');
    expect(sentences(heard)).toEqual([[0, 'The door creaks.'], [1, 'Wind']]);
    expect(heard.find((e) => e.type === 'retract')).toEqual({ type: 'retract', hadPartial: true });
  });

  it('stops waiting and drops queued work when the view abandons the request', async () => {
    const held = heldRewrites();
    const { heard, feed, final, abandon } = wire(held.rewrite);
    feed([opened, ...deltas('One. Two. Th'), done('One. Two. Three.')]);
    await flush();
    expect(held.waiting).toHaveLength(1);
    abandon();
    await expect(final()).resolves.toBeUndefined();
    await held.releaseAll();
    expect(sentences(heard)).toEqual([]);
    expect(heard.some((e) => e.type === 'finished')).toBe(false);
  });

  it('passes opened through at once', () => {
    const { heard, feed } = wire(link);
    feed([opened]);
    expect(heard).toEqual([{ type: 'opened' }]);
  });
});
