import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/types';
import type { TransportRequest } from '@/lib/aiRequest/requestTransport';
import { parseTurns } from '@/lib/turnBanding';
import { parseIncrementalMilestoneReply } from '@/lib/milestoneMemory';
import { parseTurnContent, serializeTurnContent } from '@/lib/turnDigest';
import {
  createBackgroundPassQueue, type QueueEnv, type QueueSnapshot, type StoredMilestoneSelection,
} from './backgroundPassQueue';

/**
 * The queue through its own interface: a fake transport holds every request open until the test answers
 * it, and a small host stands in for the view, re-rendering a snapshot after each state write.
 */

interface Turn { id: string; narration?: string; summary?: string }

const turn = ({ id, narration = `Narration of ${id}.`, summary }: Turn): ChatMessage[] => [
  { role: 'user', content: `Action for ${id}` },
  {
    role: 'assistant',
    content: serializeTurnContent({ narration, choices: [], stat_changes: [], turnId: id, ...(summary !== undefined ? { summary } : {}) }),
  },
];
const historyOf = (...turns: Turn[]) => turns.flatMap(turn);

interface Sent {
  request: TransportRequest;
  signal: AbortSignal;
  answer: (reply: string) => Promise<void>;
  /** Answers without the re-render that follows, as when a render lags behind the write. */
  answerQuietly: (reply: string) => Promise<void>;
  fail: () => Promise<void>;
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function host(initial: ChatMessage[], over: Partial<QueueSnapshot> = {}) {
  let history = initial;
  let selection: StoredMilestoneSelection | null = null;
  let session = 0;
  let dirty = false;
  const gate = { busy: false, concurrent: false, memoryDigests: true, ...over };
  const sent: Sent[] = [];

  const render = (rendered = history) => queue.update({
    history: rendered,
    effectiveTurns: parseTurns(rendered),
    milestoneSelection: selection,
    memoryPins: {},
    ...gate,
  });
  /** Lets every answered request land, then re-renders until the host is stable, as React would. */
  const settle = async () => {
    await flush();
    while (dirty) {
      dirty = false;
      render();
      await flush();
    }
  };

  const env: QueueEnv = {
    send: (request) => new Promise<string>((resolve, reject) => {
      sent.push({
        request,
        signal: request.signal!,
        answer: async (reply) => { resolve(reply); await settle(); },
        answerQuietly: async (reply) => { resolve(reply); await flush(); },
        fail: async () => { reject(new Error('429 Too Many Requests')); await settle(); },
      });
    }),
    digestRequest: (target) => ({
      type: 'summary', systemPrompt: 'SUMMARY', silent: true, attachTurnId: target.turnId,
      messages: [{ role: 'user', content: `${target.action} | ${target.narration}` }],
    }),
    milestoneRequest: (kept, fresh, attachTurnId) => ({
      request: { type: 'milestoneSelect', systemPrompt: 'SELECT', silent: true, attachTurnId, messages: [{ role: 'user', content: fresh.join('\n') }] },
      parse: (reply) => parseIncrementalMilestoneReply(reply, kept.length, fresh.length),
    }),
    setHistory: (update) => {
      history = update(history);
      dirty = true;
    },
    setMilestoneSelection: (next) => {
      selection = next;
      dirty = true;
    },
    session: () => session,
  };
  const queue = createBackgroundPassQueue(env);

  return {
    queue,
    sent,
    render: () => render(),
    /** A render of an older history than the host holds now. */
    renderWith: (rendered: ChatMessage[]) => render(rendered),
    settle,
    gate,
    /** The turn ids each request targets, in send order. */
    targets: () => sent.map((s) => `${s.request.type}:${s.request.attachTurnId}`),
    summaryOf: (id: string) => history
      .map((m) => (m.role === 'assistant' ? parseTurnContent(m.content) : null))
      .find((t) => t?.turnId === id)?.summary,
    selection: () => selection,
    /** A history change the queue did not make. */
    replaceHistory: (next: ChatMessage[]) => {
      history = next;
      render();
    },
    history: () => history,
    newSession: () => { session += 1; },
  };
}

describe('serial mode', () => {
  it('runs one pass at a time: digests oldest first, then the milestone', async () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2' }, { id: 't3' }));
    h.render();
    expect(h.targets()).toEqual(['summary:t1']);
    await h.sent[0].answer('First.');
    expect(h.targets()).toEqual(['summary:t1', 'summary:t2']);
    await h.sent[1].answer('Second.');
    await h.sent[2].answer('Third.');
    expect(h.targets()).toEqual(['summary:t1', 'summary:t2', 'summary:t3', 'milestoneSelect:t3']);
    expect([h.summaryOf('t1'), h.summaryOf('t2'), h.summaryOf('t3')]).toEqual(['First.', 'Second.', 'Third.']);
  });

  it('reports the running kind to its listeners', async () => {
    const h = host(historyOf({ id: 't1' }));
    const seen: string[][] = [];
    h.queue.subscribe(() => seen.push([...h.queue.running()]));
    h.render();
    await h.sent[0].answer('First.');
    await h.sent[1].answer('Keep: 1');
    expect(seen).toEqual([['digest'], [], ['milestone'], []]);
  });
});

describe('concurrent mode', () => {
  it('starts every due digest together and holds the milestone until they are written', async () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2' }, { id: 't3' }), { concurrent: true });
    h.render();
    expect(h.targets()).toEqual(['summary:t1', 'summary:t2', 'summary:t3']);
    await h.sent[1].answer('Second.');
    await h.sent[0].answer('First.');
    expect(h.targets()).toHaveLength(3);
    await h.sent[2].answer('Third.');
    expect(h.targets()).toEqual(['summary:t1', 'summary:t2', 'summary:t3', 'milestoneSelect:t3']);
  });

  it('does not resend an applied pass when a render lags behind its write', async () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2' }), { concurrent: true });
    h.render();
    await h.sent[0].answerQuietly('First.');
    const firstWriteOnly = h.history();
    await h.sent[1].answerQuietly('Second.');
    h.renderWith(firstWriteOnly);
    expect(h.targets()).toEqual(['summary:t1', 'summary:t2']);
    await h.settle();
    expect(h.targets()).toEqual(['summary:t1', 'summary:t2', 'milestoneSelect:t2']);
  });

  it('never sends the same pass twice while it runs', async () => {
    const h = host(historyOf({ id: 't1' }), { concurrent: true });
    h.render();
    h.render();
    expect(h.targets()).toEqual(['summary:t1']);
  });
});

describe('due rules', () => {
  it('skips a turn whose narration is blank', () => {
    const h = host(historyOf({ id: 't1', narration: '   ' }, { id: 't2' }), { concurrent: true });
    h.render();
    expect(h.targets()).toEqual(['summary:t2']);
  });

  it('stores an empty digest, so the turn stops being due and the milestone proceeds', async () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2' }));
    h.render();
    await h.sent[0].answer('   ');
    expect(h.summaryOf('t1')).toBe('');
    await h.sent[1].answer('Second.');
    expect(h.targets()).toEqual(['summary:t1', 'summary:t2', 'milestoneSelect:t2']);
  });

  it('sends the milestone only for fresh candidates', async () => {
    const h = host(historyOf({ id: 't1', summary: 'First.' }, { id: 't2', summary: 'Second.' }));
    h.render();
    await h.sent[0].answer('Keep: 1, 2');
    expect(h.selection()).toEqual({ seen: ['t1', 't2'], selected: ['t1', 't2'] });
    h.render();
    expect(h.sent).toHaveLength(1);
  });

  it('prunes verdicts on turns that left when nothing is fresh to judge', async () => {
    const h = host(historyOf({ id: 't1', summary: 'First.' }, { id: 't2', summary: 'Second.' }));
    h.render();
    await h.sent[0].answer('Keep: 1');
    h.replaceHistory(historyOf({ id: 't1', summary: 'First.' }));
    await h.settle();
    expect(h.selection()).toEqual({ seen: ['t1'], selected: ['t1'] });
    expect(h.sent).toHaveLength(1);
  });

  it('sends nothing with Memory Digests off', () => {
    const h = host(historyOf({ id: 't1' }), { memoryDigests: false });
    h.render();
    expect(h.sent).toHaveLength(0);
  });
});

describe('the gate', () => {
  it('starts nothing while a turn or a scene render holds the model', () => {
    const h = host(historyOf({ id: 't1' }), { busy: true });
    h.render();
    expect(h.sent).toHaveLength(0);
    h.gate.busy = false;
    h.render();
    expect(h.targets()).toEqual(['summary:t1']);
  });

  it('lets a running pass finish and apply when a turn starts', async () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2' }));
    h.render();
    h.gate.busy = true;
    h.render();
    await h.sent[0].answer('First.');
    expect(h.summaryOf('t1')).toBe('First.');
    expect(h.sent).toHaveLength(1);
  });
});

describe('set-aside', () => {
  it('sets a failed pass aside and lets the next one start without a history change', async () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2' }));
    h.render();
    await h.sent[0].fail();
    expect(h.targets()).toEqual(['summary:t1', 'summary:t2']);
    expect(h.summaryOf('t1')).toBeUndefined();
  });

  it('keeps the milestone waiting while a digest is set aside', async () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2', summary: 'Second.' }));
    h.render();
    await h.sent[0].fail();
    h.render();
    expect(h.targets()).toEqual(['summary:t1']);
  });

  it('keeps a failed pass aside across the queue\'s own writes', async () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2' }, { id: 't3' }));
    h.render();
    await h.sent[0].fail();
    await h.sent[1].answer('Second.');
    await h.sent[2].answer('Third.');
    expect(h.targets()).toEqual(['summary:t1', 'summary:t2', 'summary:t3']);
  });

  it('clears on a history change the queue did not make', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    await h.sent[0].fail();
    h.replaceHistory([...h.history(), ...turn({ id: 't2', summary: 'Second.' })]);
    expect(h.targets()).toEqual(['summary:t1', 'summary:t1']);
  });

  it('clears on a session change', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    await h.sent[0].fail();
    h.newSession();
    h.render();
    expect(h.targets()).toEqual(['summary:t1', 'summary:t1']);
  });

  it('sets an empty milestone reply aside without writing the selection', async () => {
    const h = host(historyOf({ id: 't1', summary: 'First.' }));
    h.render();
    await h.sent[0].answer('');
    h.render();
    expect(h.selection()).toBeNull();
    expect(h.sent).toHaveLength(1);
  });

  it('applies a malformed milestone reply as keep-everything', async () => {
    const h = host(historyOf({ id: 't1', summary: 'First.' }, { id: 't2', summary: 'Second.' }));
    h.render();
    await h.sent[0].answer('I would rather describe the weather in great detail than pick a number here.');
    expect(h.selection()).toEqual({ seen: ['t1', 't2'], selected: ['t1', 't2'] });
  });
});

describe('cancel', () => {
  it('applies nothing for a canceled digest and does not set it aside', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    h.queue.abort();
    expect(h.sent[0].signal.aborted).toBe(true);
    await h.sent[0].answer('');
    expect(h.summaryOf('t1')).toBeUndefined();
    expect(h.targets()).toEqual(['summary:t1', 'summary:t1']);
    expect(h.sent[1].signal.aborted).toBe(false);
  });

  it('marks no candidate seen when a milestone is canceled', async () => {
    const h = host(historyOf({ id: 't1', summary: 'First.' }));
    h.render();
    h.queue.abort();
    await h.sent[0].answer('Keep: 1');
    expect(h.selection()).toBeNull();
  });

  it('treats a throw after abort as canceled, not failed', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    h.queue.abort();
    await h.sent[0].fail();
    expect(h.targets()).toEqual(['summary:t1', 'summary:t1']);
  });

  it('aborts every running signal on dispose and applies nothing after', async () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2' }), { concurrent: true });
    h.render();
    h.queue.dispose();
    expect(h.sent.map((s) => s.signal.aborted)).toEqual([true, true]);
    await h.sent[0].answer('First.');
    expect(h.summaryOf('t1')).toBeUndefined();
    expect(h.sent).toHaveLength(2);
  });

  it('starts nothing from the old save until the loaded one renders', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    h.newSession();
    h.queue.abort();
    await h.sent[0].answer('');
    expect(h.sent).toHaveLength(1);
    h.replaceHistory(historyOf({ id: 'loaded' }));
    expect(h.targets()).toEqual(['summary:t1', 'summary:loaded']);
  });

  it('aborts every running signal on load', () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2' }), { concurrent: true });
    h.render();
    h.queue.abort();
    expect(h.sent.map((s) => s.signal.aborted)).toEqual([true, true]);
  });
});

describe('session guard', () => {
  it('drops a digest whose session changed', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    h.newSession();
    await h.sent[0].answer('First.');
    expect(h.summaryOf('t1')).toBeUndefined();
  });

  it('drops a digest whose turn narration changed and redoes it over the new text', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    h.gate.busy = true;
    h.replaceHistory(historyOf({ id: 't1', narration: 'Edited narration.' }));
    await h.sent[0].answer('Old text digest.');
    expect(h.summaryOf('t1')).toBeUndefined();
    h.gate.busy = false;
    h.render();
    expect(h.sent[1].request.messages[0].content).toContain('Edited narration.');
  });

  it('drops a milestone whose session changed', async () => {
    const h = host(historyOf({ id: 't1', summary: 'First.' }));
    h.render();
    h.newSession();
    await h.sent[0].answer('Keep: 1');
    expect(h.selection()).toBeNull();
  });

  it('drops a milestone whose latest turn was rolled back', async () => {
    const h = host(historyOf({ id: 't1', summary: 'First.' }, { id: 't2', summary: 'Second.' }));
    h.render();
    h.gate.busy = true;
    h.replaceHistory(historyOf({ id: 't1', summary: 'First.' }));
    await h.sent[0].answer('Keep: 1, 2');
    expect(h.selection()).toBeNull();
  });
});
