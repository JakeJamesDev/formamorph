import { describe, expect, it } from 'vitest';
import type { ChatMessage, Entity, InventoryPassOp, RuntimeItem } from '@/types';
import type { MentionReading } from '@/lib/coref/mentionReading';
import { narrationHash, type MentionReadingMap } from '@/lib/coref/mentionReadings';
import { knownNameFor, memoryNarrationFor, readingNamesFor } from '@/lib/coref/mentionMemory';
import { metCheck, strangersInPlay } from '@/lib/presence';
import type { TransportRequest } from '@/lib/aiRequest/requestTransport';
import { buildBandedHistory, buildVerbatimHistory, parseTurns } from '@/lib/turnBanding';
import { parseIncrementalMilestoneReply } from '@/lib/milestoneMemory';
import { parseTurnContent, serializeTurnContent } from '@/lib/turnDigest';
import { withItemDescription } from '@/lib/inventory/describe';
import { collectCandidateEvidence, extractCharacterCandidates } from '@/lib/characterCandidates';
import { stripQuotedSpeech } from '@/lib/entityMatch';
import type { TurnTextEdits } from '@/lib/turnTextEdits';
import {
  createBackgroundPassQueue, diaryPassInput, dueDiaries, dueDiscoveries, type QueueEnv, type QueueSnapshot, type StoredMilestoneSelection,
} from './backgroundPassQueue';

/**
 * The queue through its own interface: a fake transport holds every request open until the test answers
 * it, and a small host stands in for the view, re-rendering a snapshot after each state write.
 */

interface Turn {
  id: string; narration?: string; summary?: string; entities?: string[]; diaries?: Record<string, string>; locationId?: string;
  inventoryOps?: InventoryPassOp[];
}

const turn = ({ id, narration = `Narration of ${id}.`, summary, entities, diaries, locationId, inventoryOps }: Turn): ChatMessage[] => [
  { role: 'user', content: `Action for ${id}` },
  {
    role: 'assistant',
    content: serializeTurnContent({
      narration, choices: [], stat_changes: [], turnId: id,
      ...(summary !== undefined ? { summary } : {}),
      ...(entities ? { entities } : {}),
      ...(diaries ? { diaries } : {}),
      ...(locationId ? { locationId } : {}),
      ...(inventoryOps ? { inventoryOps } : {}),
    }),
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
  const descriptions = new Map<string, string>();
  const uncommitted: Array<{ name: string; description: string }> = [];
  const gate = {
    busy: false, concurrent: false, memoryDigests: true,
    describeCharacters: false, characterDiaries: false, entityNames: [] as string[], suppressedNames: [] as string[],
    runtimeItems: [] as readonly RuntimeItem[],
    ...over,
  };
  const sent: Sent[] = [];
  const discovered: Array<{ name: string; turnId: string; description: string; locationId?: string }> = [];

  const render = (rendered = history) => {
    for (const { name, description } of uncommitted.splice(0)) {
      descriptions.set(name, description);
      gate.entityNames = [...gate.entityNames, name];
    }
    queue.update({
      history: rendered,
      effectiveTurns: parseTurns(rendered),
      milestoneSelection: selection,
      memoryPins: {},
      ...gate,
    });
  };
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
    discoverRequest: (target) => ({
      type: 'discoverEntity', systemPrompt: 'DISCOVER', silent: true, attachTurnId: target.turnId,
      messages: [{ role: 'user', content: `${target.name} | ${target.narration}` }],
    }),
    // A diary carries the entity text that exists when the pass starts.
    diaryRequest: (target) => ({
      type: 'diary', systemPrompt: 'DIARY', silent: true, attachTurnId: target.turnId,
      messages: [
        { role: 'user', content: `${target.name} | ${descriptions.get(target.name) ?? 'no description'}` },
        { role: 'user', content: target.narration },
      ],
    }),
    // The entity joins the cast at the next render, as React state does.
    addDiscovered: (target, description) => {
      discovered.push({ name: target.name, turnId: target.turnId, description, locationId: target.locationId });
      uncommitted.push({ name: target.name, description });
      dirty = true;
    },
    describeItemRequest: (target) => ({
      type: 'inventory', systemPrompt: 'ITEM', silent: true, attachTurnId: target.turnId,
      messages: [{ role: 'user', content: `${target.name} | ${target.narration}` }],
    }),
    describeItem: (target, description) => {
      gate.runtimeItems = withItemDescription(gate.runtimeItems, target.runtimeItemId, description);
      dirty = true;
    },
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
    /** Every request sent, as `type:turn:name` for the per-name passes. */
    names: () => sent.map((s) => `${s.request.type}:${s.request.attachTurnId}:${String(s.request.messages[0].content).split(' | ')[0]}`),
    discovered,
    diaryOf: (id: string, name: string) => history
      .map((m) => (m.role === 'assistant' ? parseTurnContent(m.content) : null))
      .find((t) => t?.turnId === id)?.diaries?.[name],
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
    /** A load or new game: the old save's pending entities go with it. */
    newSession: () => {
      session += 1;
      uncommitted.length = 0;
    },
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

describe('the due selectors', () => {
  const rawTurn = (fields: Record<string, unknown>): ChatMessage => ({
    role: 'assistant', content: JSON.stringify({ narration: 'n', choices: [], stat_changes: [], ...fields }),
  });

  it('lists a discover for every unknown name, oldest turn first, with the turn\'s location', () => {
    const history = [
      rawTurn({ turnId: 't1', narration: 'Old.', entities: ['Goblin'] }),
      rawTurn({ turnId: 't2', narration: 'A mouse squeaks.', entities: ['Alice', 'Mouse'], locationId: 'loc-1' }),
    ];
    expect(dueDiscoveries(history, ['Alice'])).toEqual([
      { turnId: 't1', name: 'Goblin', narration: 'Old.', locationId: undefined },
      { turnId: 't2', name: 'Mouse', narration: 'A mouse squeaks.', locationId: 'loc-1' },
    ]);
  });

  it('skips a name a known one covers, variants included', () => {
    const history = [rawTurn({ turnId: 't1', narration: 'He nods.', entities: ['Aldric', 'Alice'] })];
    expect(dueDiscoveries(history, ['Sergeant Aldric', 'Alice'])).toEqual([]);
  });

  it('ignores turns without an id, without narration, or without participants', () => {
    const history = [
      rawTurn({ narration: 'No id.', entities: ['Ghost'] }),
      rawTurn({ turnId: 't2', narration: '   ', entities: ['Wraith'] }),
      rawTurn({ turnId: 't3', narration: 'Quiet.', entities: [] }),
      rawTurn({ turnId: 't4', narration: 'Quiet.' }),
    ];
    expect(dueDiscoveries(history, [])).toEqual([]);
    expect(dueDiaries(history)).toEqual([]);
  });

  it('discovers a character on the first turn its clusters qualify (Q73)', () => {
    // Written passages: a species label used as a name, two spellings, only "paused" and "listened" for verbs.
    const first = 'An Anthro Zorvak waited beside the well. You watched as the Zorvak paused, and she listened to the wind. '
      + 'Rain dripped while the Zorvac kept her eyes on the road. "Rain soon," she says.';
    const second = 'Later the Zorvak nodded to you, and you thanked the Zorvak.';
    const stored = (narration: string, prior: string) =>
      extractCharacterCandidates(stripQuotedSpeech(narration), {}, collectCandidateEvidence(prior));
    const history = [
      rawTurn({ turnId: 't1', narration: first, entities: stored(first, '') }),
      rawTurn({ turnId: 't2', narration: second, entities: stored(second, first) }),
    ];
    let from = 0;
    const spans = ['An Anthro Zorvak', 'the Zorvak', 'she', 'the Zorvac', 'her', 'she'].map((mention): [number, number] => {
      const start = first.indexOf(mention, from);
      from = start + mention.length;
      return [start, from];
    });
    const read = (clusters?: [number, number][][]): MentionReadingMap => ({
      t1: { model: 'small', version: 1, textHash: narrationHash(first), reading: { mentions: [], quotes: [] }, ...(clusters ? { clusters, clusterEntities: [null] } : {}) },
    });
    const firstDue = (readings: MentionReadingMap) =>
      dueDiscoveries(history, [], readingNamesFor(true, readings, [], {}))[0];
    expect(firstDue(read([spans]))).toMatchObject({ turnId: 't1', name: 'Anthro Zorvak' });
    expect(firstDue(read())).toMatchObject({ turnId: 't2', name: 'Zorvak' });
    expect(firstDue({})).toMatchObject({ turnId: 't2', name: 'Zorvak' });
  });

  it('judges a turn\'s clusters against the turns before it', () => {
    const before = 'You first saw the Zorvak at the market.';
    const now = 'Rain fell while the Zorvak paused. She listened. "Rain soon," she says.';
    const spans = ['the Zorvak', 'She', 'she'].map((mention): [number, number] => [now.indexOf(mention), now.indexOf(mention) + mention.length]);
    const readings: MentionReadingMap = {
      t2: { model: 'small', version: 1, textHash: narrationHash(now), reading: { mentions: [], quotes: [] }, clusters: [spans], clusterEntities: [null] },
    };
    const names = readingNamesFor(true, readings, [], {});
    const turns = (prior: string) => [rawTurn({ turnId: 't1', narration: prior, entities: [] }), rawTurn({ turnId: 't2', narration: now, entities: [] })];
    expect(dueDiscoveries(turns(before), [], names).map((due) => due.name)).toEqual(['Zorvak']);
    expect(dueDiscoveries(turns('The market was quiet.'), [], names)).toEqual([]);
    expect(dueDiscoveries(turns(before), ['Zorvak'], names)).toEqual([]);
  });

  it('names a misspelling an earlier turn pooled as that turn\'s character', () => {
    const first = 'You met the Zorvak at noon, and later the Zorvak again. You saw the Zorvac paused. She listened. '
      + '"Rain soon," she says.';
    // The name rule finds the misspelling on this turn, from "nodded".
    const second = 'Rain fell while the Zorvac nodded. You watched the Zorvac. She listened. "Rain soon," she says.';
    const spansOf = (text: string, mentions: string[]) => {
      let from = 0;
      return mentions.map((mention): [number, number] => {
        const start = text.indexOf(mention, from);
        from = start + mention.length;
        return [start, from];
      });
    };
    const entry = (text: string, mentions: string[]) => ({
      model: 'small' as const, version: 1, textHash: narrationHash(text), reading: { mentions: [], quotes: [] },
      clusters: [spansOf(text, mentions)], clusterEntities: [null],
    });
    const readings: MentionReadingMap = {
      t1: entry(first, ['the Zorvak', 'the Zorvak', 'the Zorvac', 'She', 'she']),
      t2: entry(second, ['the Zorvac', 'the Zorvac', 'She', 'she']),
    };
    const storedNames = extractCharacterCandidates(stripQuotedSpeech(second), {}, collectCandidateEvidence(first));
    expect(storedNames).toEqual(['Zorvac']);
    const history = [
      rawTurn({ turnId: 't1', narration: first, entities: [] }),
      rawTurn({ turnId: 't2', narration: second, entities: storedNames }),
    ];
    expect(dueDiscoveries(history, [], readingNamesFor(true, readings, [], {})).map((due) => [due.turnId, due.name]))
      .toEqual([['t1', 'Zorvak'], ['t2', 'Zorvak']]);
    expect(dueDiscoveries(history, [], readingNamesFor(true, {}, [], {})).map((due) => [due.turnId, due.name]))
      .toEqual([['t2', 'Zorvac']]);
    // Once discovered or deleted, the pooled name blocks the misspelling the name rule stored.
    expect(dueDiscoveries(history, ['Zorvak'], readingNamesFor(true, readings, [], {}))).toEqual([]);
  });

  it('discovers both people of a cluster the model merged (Q76)', () => {
    const text = 'You saw the Zorvak at the gate, and later the Zorvak paused. '
      + 'You saw the Tessaly at the well, and the Tessaly nodded. "Rain soon," she says.';
    let from = 0;
    const spans = ['the Zorvak', 'the Zorvak', 'the Tessaly', 'the Tessaly', 'she'].map((mention): [number, number] => {
      const start = text.indexOf(mention, from);
      from = start + mention.length;
      return [start, from];
    });
    const readings: MentionReadingMap = {
      t1: { model: 'small', version: 1, textHash: narrationHash(text), reading: { mentions: [], quotes: [] }, clusters: [spans], clusterEntities: [null] },
    };
    // The name rule finds the Tessaly alone, from "nodded".
    const stored = extractCharacterCandidates(stripQuotedSpeech(text), {});
    expect(stored).toEqual(['Tessaly']);
    const history = [rawTurn({ turnId: 't1', narration: text, entities: stored })];
    expect(dueDiscoveries(history, [], readingNamesFor(true, readings, [], {})).map((due) => due.name).sort())
      .toEqual(['Tessaly', 'Zorvak']);
    // A link to a different name never takes a stored name's place.
    const crossLinked = Object.assign(() => [], { spellings: () => new Map([['Tessaly', 'Zorvak']]) });
    expect(dueDiscoveries(history, [], crossLinked).map((due) => due.name)).toEqual(['Tessaly']);
    // Nor does a known name linked to it block it.
    const knownLinked = Object.assign(() => [], { spellings: () => new Map([['Zorvak', 'Tessaly']]) });
    expect(dueDiscoveries(history, ['Zorvak'], knownLinked).map((due) => due.name)).toEqual(['Tessaly']);
  });

  it('adds nobody for a pool that holds a discovered character', () => {
    // "Zorvak" was discovered earlier; this turn uses a misspelling more often than the name.
    const text = 'You met the Zorvak at dawn. You met the Zorvac at noon, and you met the Zorvac at dusk. '
      + '"Rain soon," she says.';
    let from = 0;
    const spans = ['the Zorvak', 'the Zorvac', 'the Zorvac', 'she'].map((mention): [number, number] => {
      const start = text.indexOf(mention, from);
      from = start + mention.length;
      return [start, from];
    });
    const readings: MentionReadingMap = {
      t1: { model: 'small', version: 1, textHash: narrationHash(text), reading: { mentions: [], quotes: [] }, clusters: [spans], clusterEntities: [null] },
    };
    const history = [rawTurn({ turnId: 't1', narration: text, entities: [] })];
    const names = readingNamesFor(true, readings, [], {});
    expect(dueDiscoveries(history, [], names).map((due) => due.name)).toEqual(['Zorvac']);
    expect(dueDiscoveries(history, ['Zorvak'], names)).toEqual([]);
  });

  it('lists a diary for every participant missing an entry, oldest turn first', () => {
    const history = [
      rawTurn({ turnId: 't1', narration: 'One.', entities: ['Mira'], diaries: { Mira: 'I waved.' } }),
      rawTurn({ turnId: 't2', narration: 'Two.', entities: ['Kael', 'Mira'], diaries: { Kael: 'I watched.' } }),
      rawTurn({ turnId: 't3', narration: 'Three.', entities: ['Kael'] }),
    ];
    expect(dueDiaries(history)).toEqual([
      { turnId: 't2', name: 'Mira', narration: 'Two.' },
      { turnId: 't3', name: 'Kael', narration: 'Three.' },
    ]);
  });

  it('never writes again an entry the player deleted, after a narration edit cleared it', () => {
    const history = [rawTurn({ turnId: 't1', narration: 'One.', entities: ['Kael', 'Mira'] })];
    const textEdits: TurnTextEdits = { t1: { diaries: { mira: { source: 'player', deleted: true } } } };
    expect(dueDiaries(history, undefined, textEdits)).toEqual([{ turnId: 't1', name: 'Kael', narration: 'One.' }]);
  });

  it("sends a diary regenerate the pass's bracketed narration, and scrubs its reply", () => {
    const history = [rawTurn({ turnId: 't1', narration: 'She waved.', entities: ['Mira'] })];
    const view = (_turnId: string, narration: string) => ({ text: `[Mira] ${narration}`, scrub: (r: string) => r.replace('[Mira]', 'Mira') });
    const input = diaryPassInput(history, 't1', 'Mira', view);
    expect(input?.target).toEqual({ turnId: 't1', name: 'Mira', narration: '[Mira] She waved.' });
    expect(input?.scrub('[Mira] waved back.')).toBe('Mira waved back.');
    expect(diaryPassInput(history, 'gone', 'Mira')).toBeNull();
  });
});

const FERRY_HAND = 'A ferry hand with a limp.';
const cast = { describeCharacters: true, characterDiaries: true, memoryDigests: false };

describe('diary after discover', () => {
  it('writes a new name\'s diary only after its discover, and the diary carries the description', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), cast);
    h.render();
    expect(h.names()).toEqual(['discoverEntity:t1:Mira']);
    await h.sent[0].answer(FERRY_HAND);
    expect(h.discovered).toEqual([{ name: 'Mira', turnId: 't1', description: FERRY_HAND, locationId: undefined }]);
    expect(h.names()).toEqual(['discoverEntity:t1:Mira', 'diary:t1:Mira']);
    expect(h.sent[1].request.messages[0].content).toBe(`Mira | ${FERRY_HAND}`);
    await h.sent[1].answer('I met the ferry hand.');
    expect(h.diaryOf('t1', 'Mira')).toBe('I met the ferry hand.');
  });

  it('writes a known entity\'s diary at once', () => {
    const h = host(historyOf({ id: 't1', entities: ['Odette'] }), { ...cast, entityNames: ['Odette'] });
    h.render();
    expect(h.names()).toEqual(['diary:t1:Odette']);
  });

  it('writes no diary for a suppressed name, and no discover', () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), { ...cast, suppressedNames: ['Mira'] });
    h.render();
    expect(h.sent).toHaveLength(0);
  });

  it('writes no diary for a name with Describe New Characters off', () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira', 'Odette'] }), { ...cast, describeCharacters: false, entityNames: ['Odette'] });
    h.render();
    expect(h.names()).toEqual(['diary:t1:Odette']);
  });

  it('defers the diary of a name whose discover was set aside and lets the other names proceed', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira', 'Odette'] }), { ...cast, entityNames: ['Odette'] });
    h.render();
    await h.sent[0].fail();
    expect(h.names()).toEqual(['discoverEntity:t1:Mira', 'diary:t1:Odette']);
    await h.sent[1].answer('I watched the ferry.');
    expect(h.names()).toHaveLength(2);
  });

  it('retries a discover set aside after a history change the queue did not make', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), cast);
    h.render();
    await h.sent[0].fail();
    h.replaceHistory([...h.history(), ...turn({ id: 't2' })]);
    expect(h.names()).toEqual(['discoverEntity:t1:Mira', 'discoverEntity:t1:Mira']);
  });

  it('sets aside a discover whose description is unusable, and writes no diary for the name', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), cast);
    h.render();
    await h.sent[0].answer('   ');
    expect(h.discovered).toEqual([]);
    expect(h.names()).toEqual(['discoverEntity:t1:Mira']);
  });

  it('writes no diary with Character Diaries off', () => {
    const h = host(historyOf({ id: 't1', entities: ['Odette'] }), { ...cast, characterDiaries: false, entityNames: ['Odette'] });
    h.render();
    expect(h.sent).toHaveLength(0);
  });

  it('stores an empty diary, so the participant is not asked again', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Odette'] }), { ...cast, entityNames: ['Odette'] });
    h.render();
    await h.sent[0].answer('  ');
    expect(h.diaryOf('t1', 'Odette')).toBe('');
    expect(h.sent).toHaveLength(1);
  });

  it('does not write a diary for a turn whose narration is blank', () => {
    const h = host(historyOf({ id: 't1', narration: ' ', entities: ['Odette', 'Mira'] }), { ...cast, entityNames: ['Odette'] });
    h.render();
    expect(h.sent).toHaveLength(0);
  });

  it('asks for each pair on its own, oldest turn first, so one stuck pair hides none behind it', async () => {
    const h = host(
      historyOf({ id: 't1', entities: ['Odette', 'Ines'] }, { id: 't2', entities: ['Odette'] }),
      { ...cast, entityNames: ['Odette', 'Ines'] },
    );
    h.render();
    await h.sent[0].fail();
    await h.sent[1].answer('Ines.');
    await h.sent[2].answer('Odette again.');
    expect(h.names()).toEqual(['diary:t1:Odette', 'diary:t1:Ines', 'diary:t2:Odette']);
    expect(h.diaryOf('t1', 'Odette')).toBeUndefined();
  });

  it('holds the diary until the new entity shows in a render, so the request reads the description', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), { ...cast, concurrent: true });
    h.render();
    await h.sent[0].answerQuietly(FERRY_HAND);
    expect(h.names()).toEqual(['discoverEntity:t1:Mira']);
    await h.settle();
    expect(h.names()).toEqual(['discoverEntity:t1:Mira', 'diary:t1:Mira']);
    expect(h.sent[1].request.messages[0].content).toBe(`Mira | ${FERRY_HAND}`);
  });

  it('describes a name again in a new session, whatever the old save applied', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), cast);
    h.render();
    await h.sent[0].answerQuietly(FERRY_HAND);
    h.newSession();
    h.queue.abort();
    h.replaceHistory(historyOf({ id: 't1', entities: ['Mira'] }));
    expect(h.names().filter((n) => n.startsWith('discoverEntity'))).toHaveLength(2);
  });

  it('reports a running discover and a running diary', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), cast);
    const seen: string[][] = [];
    h.queue.subscribe(() => seen.push([...h.queue.running()]));
    h.render();
    await h.sent[0].answer(FERRY_HAND);
    await h.sent[1].answer('Noted.');
    expect(seen).toEqual([['discover'], [], ['diary'], []]);
  });
});

describe('one discover per name', () => {
  it('describes the name from its oldest turn and writes nothing for the newer ones', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }, { id: 't2', entities: ['Mira'] }), { ...cast, concurrent: true });
    h.render();
    expect(h.names()).toEqual(['discoverEntity:t1:Mira']);
    await h.sent[0].answerQuietly(FERRY_HAND);
    expect(h.names().filter((n) => n.startsWith('discoverEntity'))).toEqual(['discoverEntity:t1:Mira']);
    await h.settle();
    expect(h.discovered).toHaveLength(1);
  });

  it('lets the next turn\'s pair for the same name try after one is set aside', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }, { id: 't2', entities: ['Mira'] }), cast);
    h.render();
    await h.sent[0].fail();
    expect(h.names()).toEqual(['discoverEntity:t1:Mira', 'discoverEntity:t2:Mira']);
  });

  it('treats a variant of a name as the same character', () => {
    const h = host(historyOf({ id: 't1', entities: ['Sergeant Aldric', 'Aldric'] }), { ...cast, concurrent: true });
    h.render();
    expect(h.names()).toEqual(['discoverEntity:t1:Sergeant Aldric']);
  });

  it('hands the turn\'s location to the new entity', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'], locationId: 'dock' }), cast);
    h.render();
    await h.sent[0].answer(FERRY_HAND);
    expect(h.discovered[0].locationId).toBe('dock');
  });
});

describe('describe item (Q148)', () => {
  const gain = (item: string): InventoryPassOp => ({ op: 'gain', item, quantity: 1, owner: '', to: 'you', state: '' });
  const stone: RuntimeItem = { id: 'r1', name: 'Odd Stone' };
  const found = historyOf(
    { id: 't1', narration: 'You find a smooth black pebble.', inventoryOps: [gain('odd stone')] },
    { id: 't2', inventoryOps: [gain('Odd Stone')] },
  );

  it('describes a runtime item from the oldest turn that named it, writes it, and asks no more', async () => {
    const h = host(found, { memoryDigests: false, runtimeItems: [stone] });
    h.render();
    expect(h.names()).toEqual(['inventory:t1:Odd Stone']);
    expect(h.sent[0].request.messages[0].content).toContain('smooth black pebble');
    await h.sent[0].answer('A smooth black pebble.');
    expect(h.gate.runtimeItems).toEqual([{ ...stone, description: 'A smooth black pebble.' }]);
    expect(h.sent).toHaveLength(1);
  });

  it('leaves a described runtime item alone, and one no stored turn names', () => {
    const h = host(found, { memoryDigests: false, runtimeItems: [{ ...stone, description: 'A rock.' }, { id: 'r2', name: 'Lost Coin' }] });
    h.render();
    expect(h.sent).toHaveLength(0);
  });

  it('sets aside an unusable reply and writes nothing', async () => {
    const h = host(found, { memoryDigests: false, runtimeItems: [stone] });
    h.render();
    await h.sent[0].answer('None.');
    expect(h.gate.runtimeItems).toEqual([stone]);
    expect(h.sent).toHaveLength(1);
  });

  it('writes nothing when the turn it read was rolled back while it ran', async () => {
    const h = host(found, { memoryDigests: false, runtimeItems: [stone] });
    h.render();
    h.replaceHistory(historyOf({ id: 't1', narration: 'Rewritten.', inventoryOps: [gain('Odd Stone')] }));
    await h.sent[0].answer('A smooth black pebble.');
    expect(h.gate.runtimeItems[0].description).not.toBe('A smooth black pebble.');
  });

  it('reports a running item description', async () => {
    const h = host(found, { memoryDigests: false, runtimeItems: [stone] });
    const seen: string[][] = [];
    h.queue.subscribe(() => seen.push([...h.queue.running()]));
    h.render();
    await h.sent[0].answer('A smooth black pebble.');
    expect(seen).toEqual([['describeItem'], []]);
  });
});

describe('priority across the kinds', () => {
  it('describes an item after the discover and before the digest', async () => {
    const h = host(
      historyOf({ id: 't1', entities: ['Mira'], inventoryOps: [{ op: 'gain', item: 'Odd Stone', quantity: 1, owner: '', to: 'you', state: '' }] }),
      { ...cast, memoryDigests: true, runtimeItems: [{ id: 'r1', name: 'Odd Stone' }] },
    );
    h.render();
    await h.sent[0].answer(FERRY_HAND);
    await h.sent[1].answer('A smooth black pebble.');
    expect(h.sent.map((s) => s.request.type)).toEqual(['discoverEntity', 'inventory', 'summary']);
  });

  it('runs discover, digest, diary, then milestone, one at a time', async () => {
    const h = host(
      historyOf({ id: 't1', entities: ['Mira', 'Odette'] }),
      { ...cast, memoryDigests: true, entityNames: ['Odette'] },
    );
    h.render();
    await h.sent[0].answer(FERRY_HAND);
    await h.sent[1].answer('Summary.');
    await h.sent[2].answer('Mira diary.');
    await h.sent[3].answer('Odette diary.');
    await h.sent[4].answer('Keep: 1');
    expect(h.sent.map((s) => s.request.type)).toEqual(['discoverEntity', 'summary', 'diary', 'diary', 'milestoneSelect']);
    expect(h.names().slice(2, 4)).toEqual(['diary:t1:Mira', 'diary:t1:Odette']);
  });

  it('starts every ready pass together in concurrent mode, holding a new name\'s diary for its discover', () => {
    const h = host(
      historyOf({ id: 't1', entities: ['Mira', 'Odette'] }),
      { ...cast, memoryDigests: true, concurrent: true, entityNames: ['Odette'] },
    );
    h.render();
    expect(h.sent.map((s) => s.request.type)).toEqual(['discoverEntity', 'summary', 'diary']);
    expect(h.sent[2].request.messages[0].content).toContain('Odette');
  });
});

describe('the session guard on discover and diary', () => {
  it('writes no entity for a discover whose session changed', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), cast);
    h.render();
    h.newSession();
    await h.sent[0].answer(FERRY_HAND);
    expect(h.discovered).toEqual([]);
  });

  it('writes no entity for a discover whose turn narration changed, and redoes it', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), cast);
    h.render();
    h.gate.busy = true;
    h.replaceHistory(historyOf({ id: 't1', narration: 'Edited narration.', entities: ['Mira'] }));
    await h.sent[0].answer(FERRY_HAND);
    expect(h.discovered).toEqual([]);
    h.gate.busy = false;
    h.render();
    expect(h.sent[1].request.messages[0].content).toContain('Edited narration.');
  });

  it('writes no entity for a discover whose turn was rolled back', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), cast);
    h.render();
    h.gate.busy = true;
    h.replaceHistory([]);
    await h.sent[0].answer(FERRY_HAND);
    expect(h.discovered).toEqual([]);
  });

  it('drops a diary whose narration changed', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Odette'] }), { ...cast, entityNames: ['Odette'] });
    h.render();
    h.gate.busy = true;
    h.replaceHistory(historyOf({ id: 't1', narration: 'Edited narration.', entities: ['Odette'] }));
    await h.sent[0].answer('Old text diary.');
    expect(h.diaryOf('t1', 'Odette')).toBeUndefined();
  });
});

describe('cancel for discover and diary', () => {
  it('writes no entity for a canceled discover and does not set it aside', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), cast);
    h.render();
    h.queue.abort();
    expect(h.sent[0].signal.aborted).toBe(true);
    await h.sent[0].answer(FERRY_HAND);
    expect(h.discovered).toEqual([]);
    expect(h.names()).toEqual(['discoverEntity:t1:Mira', 'discoverEntity:t1:Mira']);
  });

  it('applies nothing for a canceled diary', async () => {
    const h = host(historyOf({ id: 't1', entities: ['Odette'] }), { ...cast, entityNames: ['Odette'] });
    h.render();
    h.queue.abort();
    await h.sent[0].answer('Late diary.');
    expect(h.diaryOf('t1', 'Odette')).toBeUndefined();
  });

  it('waits while a turn runs, then starts the discover', () => {
    const h = host(historyOf({ id: 't1', entities: ['Mira'] }), { ...cast, busy: true });
    h.render();
    expect(h.sent).toHaveLength(0);
    h.gate.busy = false;
    h.render();
    expect(h.names()).toEqual(['discoverEntity:t1:Mira']);
  });
});

describe('foreground jobs', () => {
  /** A foreground job the test settles by hand. */
  function job() {
    const state = { started: 0, signal: undefined as AbortSignal | undefined, finish: (_value: string) => {} };
    const run = (signal: AbortSignal) => new Promise<string>((resolve) => {
      state.started += 1;
      state.signal = signal;
      state.finish = resolve;
    });
    return { state, run };
  }

  it('runs at once when nothing holds the model', async () => {
    const h = host([], { memoryDigests: false });
    h.render();
    const { state, run } = job();
    const result = h.queue.runForeground(run);
    expect(state.started).toBe(1);
    state.finish('done');
    expect(await result).toEqual({ value: 'done' });
  });

  it('tells a job that returns null from a canceled one', async () => {
    const h = host([], { memoryDigests: false });
    h.render();
    expect(await h.queue.runForeground(async () => null)).toEqual({ value: null });
    h.queue.dispose();
    expect(await h.queue.runForeground(async () => null)).toBeNull();
  });

  it('waits behind a running pass, then runs', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    const { state, run } = job();
    const result = h.queue.runForeground(run);
    expect(state.started).toBe(0);
    expect(h.queue.waiting()).toBe(true);
    await h.sent[0].answer('First.');
    expect(state.started).toBe(1);
    expect(h.queue.waiting()).toBe(false);
    state.finish('done');
    expect(await result).toEqual({ value: 'done' });
  });

  it('waits behind every running pass in concurrent mode', async () => {
    const h = host(historyOf({ id: 't1' }, { id: 't2' }), { concurrent: true });
    h.render();
    const { state, run } = job();
    void h.queue.runForeground(run);
    await h.sent[0].answer('First.');
    expect(state.started).toBe(0);
    await h.sent[1].answer('Second.');
    expect(state.started).toBe(1);
  });

  it('waits while a turn runs', () => {
    const h = host([], { busy: true });
    h.render();
    const { state, run } = job();
    void h.queue.runForeground(run);
    expect(state.started).toBe(0);
    h.gate.busy = false;
    h.render();
    expect(state.started).toBe(1);
  });

  it('holds the queue while it runs, then lets the passes go', async () => {
    const h = host(historyOf({ id: 't1' }), { memoryDigests: false });
    h.render();
    const { state, run } = job();
    void h.queue.runForeground(run);
    h.gate.memoryDigests = true;
    h.render();
    expect(h.sent).toHaveLength(0);
    state.finish('done');
    await h.settle();
    expect(h.targets()).toEqual(['summary:t1']);
  });

  it('keeps new passes out while a job waits', async () => {
    const h = host(historyOf({ id: 't1' }), { concurrent: true });
    h.render();
    const { run } = job();
    void h.queue.runForeground(run);
    h.replaceHistory(historyOf({ id: 't1' }, { id: 't2' }));
    expect(h.targets()).toEqual(['summary:t1']);
  });

  it('removes a job canceled while waiting, and the passes behind it go on', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    const { state, run } = job();
    const cancel = new AbortController();
    const result = h.queue.runForeground(run, cancel.signal);
    cancel.abort();
    expect(await result).toBeNull();
    expect(h.queue.waiting()).toBe(false);
    await h.sent[0].answer('First.');
    expect(state.started).toBe(0);
    expect(h.targets()).toEqual(['summary:t1', 'milestoneSelect:t1']);
  });

  it('aborts a job canceled while running and frees the queue', async () => {
    const h = host(historyOf({ id: 't1' }), { memoryDigests: false });
    h.render();
    const { state, run } = job();
    const cancel = new AbortController();
    const result = h.queue.runForeground(run, cancel.signal);
    h.gate.memoryDigests = true;
    h.render();
    cancel.abort();
    expect(state.signal!.aborted).toBe(true);
    state.finish('late');
    expect(await result).toBeNull();
    await h.settle();
    expect(h.targets()).toEqual(['summary:t1']);
  });

  it('runs the oldest waiting job first, one at a time', async () => {
    const h = host([], { busy: true });
    h.render();
    const first = job();
    const second = job();
    void h.queue.runForeground(first.run);
    void h.queue.runForeground(second.run);
    h.gate.busy = false;
    h.render();
    expect([first.state.started, second.state.started]).toEqual([1, 0]);
    first.state.finish('a');
    await flush();
    expect(second.state.started).toBe(1);
  });

  it('cancels a waiting job and aborts a running one on abort', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    const running = job();
    const waiting = job();
    const first = h.queue.runForeground(running.run);
    const second = h.queue.runForeground(waiting.run);
    await h.sent[0].answer('First.');
    expect(running.state.started).toBe(1);
    h.queue.abort();
    expect(running.state.signal!.aborted).toBe(true);
    running.state.finish('late');
    expect(await first).toBeNull();
    expect(await second).toBeNull();
    expect(waiting.state.started).toBe(0);
  });

  it('aborts a running job on dispose', async () => {
    const h = host([], { memoryDigests: false });
    h.render();
    const { state, run } = job();
    const result = h.queue.runForeground(run);
    h.queue.dispose();
    expect(state.signal!.aborted).toBe(true);
    state.finish('late');
    expect(await result).toBeNull();
  });

  it('resolves null for a job sent after dispose or with a canceled signal', async () => {
    const h = host([], { memoryDigests: false });
    h.render();
    const cancel = new AbortController();
    cancel.abort();
    const { state, run } = job();
    expect(await h.queue.runForeground(run, cancel.signal)).toBeNull();
    h.queue.dispose();
    expect(await h.queue.runForeground(run)).toBeNull();
    expect(state.started).toBe(0);
  });

  it('rejects when the job fails and frees the queue', async () => {
    const h = host(historyOf({ id: 't1' }), { memoryDigests: false });
    h.render();
    const result = h.queue.runForeground(() => Promise.reject(new Error('boom')));
    await expect(result).rejects.toThrow('boom');
    h.gate.memoryDigests = true;
    h.render();
    expect(h.targets()).toEqual(['summary:t1']);
  });

  it('rejects and frees the queue when the job throws before it returns a promise', async () => {
    const h = host(historyOf({ id: 't1' }), { memoryDigests: false });
    h.render();
    const result = h.queue.runForeground<string>(() => { throw new Error('sync'); });
    await expect(result).rejects.toThrow('sync');
    h.gate.memoryDigests = true;
    h.render();
    expect(h.targets()).toEqual(['summary:t1']);
  });

  it('tells its listeners when a job starts waiting and stops', async () => {
    const h = host(historyOf({ id: 't1' }));
    h.render();
    const seen: boolean[] = [];
    h.queue.subscribe(() => seen.push(h.queue.waiting()));
    const { run } = job();
    void h.queue.runForeground(run);
    await h.sent[0].answer('First.');
    expect(seen[0]).toBe(true);
    expect(seen[seen.length - 1]).toBe(false);
  });
});

describe('Character Mentions', () => {
  // A passage written for these tests: Odile by name and pronoun, an unmet stranger by description.
  const NARRATION = 'Odile sets the sack down. She wipes her hands while the hooded woman watches her, and she smiles.';
  const ODILE: Entity = { id: 'odile', name: 'Odile' };
  const HOODED: Entity = { id: 'hooded', name: 'Sabine Thorne', strangerName: 'a hooded woman' };
  const CAST = [ODILE, HOODED];
  const at = (word: string, from = 0) => {
    const start = NARRATION.indexOf(word, from);
    return { start, end: start + word.length };
  };
  const reading: MentionReading = {
    mentions: [
      { ...at('Odile'), entityId: 'odile' },
      { ...at('She'), entityId: 'odile' },
      { ...at('her'), entityId: 'odile' },
      { ...at('the hooded woman'), entityId: 'hooded' },
      { ...at('her', NARRATION.indexOf('watches')), entityId: 'odile' },
      { ...at('she', NARRATION.indexOf('and')), entityId: 'hooded' },
    ],
    quotes: [],
  };
  const readings: MentionReadingMap = { t1: { model: 'small', version: 1, textHash: narrationHash(NARRATION), reading } };
  const isMet = metCheck([], null, [], new Set());
  const mentions = {
    readingNames: readingNamesFor(true, readings, CAST),
    memoryNarration: memoryNarrationFor(true, readings, knownNameFor(CAST, isMet, strangersInPlay(CAST, isMet, {}).labels)),
  };
  // The unmet stranger's bracket holds her label, never her true name (Q54).
  const BRACKETED = 'Odile sets the sack down. She [Odile] wipes her [Odile] hands while the hooded woman watches her [Odile], and she [a hooded woman] smiles.';
  const memory = { memoryDigests: true, characterDiaries: true, entityNames: ['Odile', 'Sabine Thorne'] };

  it('gives an entity the reading alone shows a diary pass', () => {
    const history = historyOf({ id: 't1', narration: NARRATION, entities: [] });
    const off = host(history, { ...memory, memoryDigests: false });
    off.render();
    expect(off.sent).toHaveLength(0);

    const on = host(history, { ...memory, memoryDigests: false, ...mentions });
    on.render();
    expect(on.names()).toEqual(['diary:t1:Odile']);
  });

  it('feeds the digest and diary the bracketed narration and stores their replies without the tags', async () => {
    const h = host(historyOf({ id: 't1', narration: NARRATION, entities: ['Odile'] }), { ...memory, ...mentions });
    h.render();
    expect(h.names()).toEqual(['summary:t1:Action for t1']);
    expect(String(h.sent[0].request.messages[0].content)).toBe(`Action for t1 | ${BRACKETED}`);
    await h.sent[0].answer('She [Odile] put down the sack.');
    expect(h.summaryOf('t1')).toBe('She put down the sack.');

    const diary = h.sent.find((s) => s.request.type === 'diary')!;
    expect(diary.request.messages[1].content).toBe(BRACKETED);
    await diary.answer('I [Odile] wiped my hands.');
    expect(h.diaryOf('t1', 'Odile')).toBe('I wiped my hands.');
  });

  it('reads the plain text with no reading, or with the feature off', async () => {
    const other = host(historyOf({ id: 't2', narration: NARRATION, entities: ['Odile'] }), { ...memory, ...mentions });
    other.render();
    expect(String(other.sent[0].request.messages[0].content)).toBe(`Action for t2 | ${NARRATION}`);

    expect(memoryNarrationFor(false, readings, () => 'Odile')).toBeUndefined();
    const off = host(historyOf({ id: 't1', narration: NARRATION, entities: ['Odile'] }), memory);
    off.render();
    expect(String(off.sent[0].request.messages[0].content)).toBe(`Action for t1 | ${NARRATION}`);
    await off.sent[0].answer('Odile [sighs] and sets the sack down.');
    expect(off.summaryOf('t1')).toBe('Odile [sighs] and sets the sack down.');
  });

  it('leaves no bracket in the history and never names the unmet stranger', async () => {
    const h = host(historyOf({ id: 't1', narration: NARRATION, entities: ['Odile'] }), { ...memory, ...mentions });
    h.render();
    for (let i = 0; i < 4 && h.sent[i]; i++) {
      const reply = h.sent[i].request.type === 'milestoneSelect' ? '1' : 'She [Odile] left; she [a hooded woman] smiled.';
      await h.sent[i].answer(reply);
    }
    expect(h.sent.map((s) => s.request.type)).toEqual(expect.arrayContaining(['summary', 'diary']));
    // The narration each pass reads; a diary's subject line carries the true name, as a name-based one does.
    const narrationRead = (s: { request: TransportRequest }) =>
      String(s.request.messages[s.request.type === 'diary' ? 1 : 0].content);
    const read = h.sent.filter((s) => s.request.type !== 'milestoneSelect').map(narrationRead).join('\n');
    expect(read).toContain('[a hooded woman]');
    expect(read).not.toContain('Sabine');
    // Display, read-aloud, choices, exports and the Narration Stream read the stored turn.
    for (const message of h.history()) {
      if (message.role !== 'assistant') continue;
      const turn = parseTurnContent(message.content)!;
      expect(turn.narration).toBe(NARRATION);
      for (const text of [turn.summary, ...Object.values(turn.diaries ?? {})]) expect(text).not.toMatch(/\[/);
    }
    // The narration prompt's history: the digest band, and the verbatim history.
    const turns = parseTurns(h.history());
    const band = buildBandedHistory({
      turns, contextWindow: 100_000, promptTokens: 0, maxTokens: 0, verbatimFloor: 0, keywords: [], actionEntities: [],
      rehydrateCap: 0, recapPrompt: 'What happened so far?',
    });
    expect(band.bandTurnIds).toEqual(['t1']);
    const verbatim = buildVerbatimHistory(turns, 100_000, 0, 0);
    for (const message of [...band.messages, ...verbatim.messages]) expect(String(message.content)).not.toMatch(/\[/);
  });
});
