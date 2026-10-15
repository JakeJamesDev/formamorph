import { describe, expect, it } from 'vitest';
import { completeSentencePrefix, narrationStream, type NarrationEvent } from './narrationStream';
import type { TransportEvent } from './requestTransport';

/** Feeds transport events through a fresh stream and answers what its listener heard. */
function run(events: TransportEvent[]): NarrationEvent[] {
  const heard: NarrationEvent[] = [];
  const sink = narrationStream((event) => heard.push(event));
  for (const event of events) sink(event);
  return heard;
}

const opened: TransportEvent = { type: 'opened' };
/** The transport's running reply grows token by token; each delta carries all of it so far. */
const deltas = (...steps: string[]): TransportEvent[] => {
  let content = '';
  return steps.map((step) => ({ type: 'delta', content: (content += step) }));
};
const done = (text: string, raw = text): TransportEvent => ({ type: 'done', text, raw, reasoningText: '', finishReason: 'stop' });

const sentences = (heard: NarrationEvent[]) =>
  heard.flatMap((e) => (e.type === 'sentence' ? [[e.index, e.text] as const] : []));
const partials = (heard: NarrationEvent[]) => heard.flatMap((e) => (e.type === 'partial' ? [e.text] : []));

describe('Narration Stream', () => {
  it('emits each completed sentence once, in order, across many deltas', () => {
    const heard = run([opened, ...deltas('The door', ' creaks.', ' Wind', ' howls. Rain', ' falls.', ' A')]);
    expect(sentences(heard)).toEqual([[0, 'The door creaks.'], [1, 'Wind howls.'], [2, 'Rain falls.']]);
  });

  it('holds the trailing in-progress sentence back', () => {
    const heard = run([opened, ...deltas('The door creaks.', ' Wind howls')]);
    expect(sentences(heard)).toEqual([[0, 'The door creaks.']]);
    const last = heard.filter((e) => e.type === 'display').at(-1);
    expect(last).toEqual({ type: 'display', text: 'The door creaks. Wind howls', revealed: 'The door creaks.', sentences: 1, boundary: true });
  });

  it('emits two sentences that complete in one delta in order', () => {
    const heard = run([opened, ...deltas('One. Two. Three')]);
    expect(sentences(heard)).toEqual([[0, 'One.'], [1, 'Two.']]);
  });

  it('flushes the last sentence on finish, even without a terminator', () => {
    const heard = run([opened, ...deltas('The door creaks.', ' Wind howls'), done('The door creaks. Wind howls')]);
    expect(sentences(heard)).toEqual([[0, 'The door creaks.'], [1, 'Wind howls']]);
    expect(heard.at(-1)).toEqual({ type: 'finished', text: 'The door creaks. Wind howls' });
  });

  it('flushes nothing past a reply the transport trimmed shorter', () => {
    const heard = run([opened, ...deltas('One. Two. Thr'), done('One. Two.')]);
    expect(sentences(heard)).toEqual([[0, 'One.'], [1, 'Two.']]);
  });

  it('clears on retract, and later sentences restart from zero', () => {
    const heard = run([
      opened, ...deltas('Let me check. Hm'), { type: 'retract' },
      ...deltas('The door creaks.', ' Wind'), done('The door creaks. Wind'),
    ]);
    expect(sentences(heard)).toEqual([[0, 'Let me check.'], [0, 'The door creaks.'], [1, 'Wind']]);
    expect(heard.find((e) => e.type === 'retract')).toEqual({ type: 'retract', hadPartial: true });
  });

  it('emits no sentences after a cancel', () => {
    const heard = run([opened, ...deltas('One. Two'), { type: 'canceled' }, ...deltas(' more. Three.'), done('One. Two more. Three.')]);
    expect(sentences(heard)).toEqual([[0, 'One.']]);
    expect(heard.at(-1)).toEqual({ type: 'canceled' });
  });

  it('adds the partial message on first text and refreshes it only on sentence boundaries', () => {
    const heard = run([opened, ...deltas('The', ' door', ' creaks.', ' Wind', ' howls')]);
    expect(partials(heard)).toEqual(['The', 'The door creaks. Wind']);
  });

  it('persists nothing before narration text, so an early stop leaves no partial', () => {
    const heard = run([opened, ...deltas('<think>Plan the scene', '.</think>', '\n\n'), { type: 'canceled' }]);
    expect(partials(heard)).toEqual([]);
  });

  it('reads past a reasoning block and its leading blank lines', () => {
    const heard = run([opened, ...deltas('<think>plan</think>\n\nThe door creaks.', ' Wind')]);
    expect(sentences(heard)).toEqual([[0, 'The door creaks.']]);
    expect(partials(heard)).toEqual(['The door creaks.', 'The door creaks. Wind']);
  });

  it('reports a retract with no partial when nothing was persisted', () => {
    const heard = run([opened, ...deltas('<think>x'), { type: 'retract' }]);
    expect(heard.find((e) => e.type === 'retract')).toEqual({ type: 'retract', hadPartial: false });
  });

  it('passes opened through once the endpoint accepts the request', () => {
    expect(run([opened])).toEqual([{ type: 'opened' }]);
  });
});

describe('completeSentencePrefix', () => {
  it('answers the text up to its last complete sentence', () => {
    expect(completeSentencePrefix('One. Two. Thr')).toBe('One. Two.');
    expect(completeSentencePrefix('One')).toBe('');
  });
});
