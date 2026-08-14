import { describe, it, expect } from 'vitest';
import { planTurn } from './planTurn';
import { runTurn, type TurnPassOutcome, type TurnRequestAdapter, type TurnResult } from './turnRunner';
import { TEST_PROMPTS, testInput } from './turnTestInputs';
import type { TurnMaterial, TurnPassId, TurnPassSubject, TurnPlanInput, TurnSettings } from './turnPlan';
import type { AiStreamEvent } from '@/lib/aiRequest/aiStream';
import type { ParsedDirector } from '@/lib/stagedPlanning';
import { UNPARSEABLE_MESSAGE } from './turnErrors';

/**
 * The runner through its own interface: a fake request adapter stands in for the model, and the real pass
 * records do the building and parsing. Nothing here reaches past the seam.
 */

const DIRECTOR_ANSWER = 'Scene: the dock at dusk\nCast:\n- Maela — watching the water\n- Bram — coiling rope';

/** Canned answers by request type; anything unlisted answers with its own type name. */
const ANSWERS: Partial<Record<string, string>> = {
  locationChange: 'The Long Pier',
  director: DIRECTOR_ANSWER,
  character: 'I want to be left alone.',
  storyboard: 'Maela turns away.',
  narration: 'The gulls scatter as you step onto the boards.',
  choices: 'Wave at Maela\nWalk on',
  statUpdates: 'Stamina: -5',
  summary: 'The player reached the pier.',
  timePassed: '30m',
  openingTime: 'evening',
  diary: 'I watched him arrive.',
  discoverEntity: 'A weathered dockhand.',
};

const material = (over: Partial<TurnMaterial> = {}): TurnMaterial => ({
  action: 'I read the notices.',
  effectiveAction: 'I read the notices.',
  turnId: 'turn-1',
  ctx: { '<WORLD DESCRIPTION>': 'Sedge Landing' },
  baseCtx: { '<WORLD DESCRIPTION>': 'Sedge Landing' },
  sceneEntityTokens: {},
  destinations: ['The Long Pier'],
  narrationSystemPrompt: 'NARRATION SYSTEM',
  trimmedHistory: [{ role: 'assistant', content: 'Previously…' }],
  narration: '',
  lastStory: 'Previously…',
  plannerRecap: '',
  turnPlan: '',
  activeCharacterGuidance: 'up to 3',
  directorScene: '',
  npcCastSize: 0,
  intents: [],
  overflow: [],
  ...over,
});

/** One dispatched request, as the fake adapter saw it. */
interface Seen {
  id: string;
  type: string;
  subject?: string;
  /** How many requests were in flight (this one included) when it was dispatched. */
  inFlight: number;
}

interface FakeOptions {
  /** Answer overrides by request type. A function may throw to simulate a failure. */
  answers?: Partial<Record<string, string | (() => string)>>;
  /** Called with each request type before it answers — where a test stops the turn mid-flight. */
  onDispatch?: (type: string) => void;
  events?: AiStreamEvent[];
}

const makeFake = (options: FakeOptions = {}) => {
  const seen: Seen[] = [];
  let inFlight = 0;
  let peak = 0;
  const adapter: TurnRequestAdapter = async (request, context) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    seen.push({ id: request.type, type: request.type, inFlight });
    try {
      options.onDispatch?.(request.type);
      // Give every in-flight sibling a chance to start before the first answer lands, so a batched stage
      // genuinely overlaps rather than resolving in dispatch order by accident.
      await Promise.resolve();
      await Promise.resolve();
      // Every request streams, so a runner that wired the sink to more than the narration would be visible.
      for (const event of options.events ?? []) context.onEvent?.(event);
      context.onEvent?.({ type: 'delta', delta: request.type, content: request.type });
      const override = options.answers?.[request.type];
      if (typeof override === 'function') return override();
      return override ?? ANSWERS[request.type] ?? request.type;
    } finally {
      inFlight -= 1;
    }
  };
  return { adapter, seen, peakInFlight: () => peak };
};

/** The caller's derivations, as GameViewer supplies them: cast from the director, diarists after narration. */
const advanceLikeTheView = (subjects: Partial<Record<TurnPassId, TurnPassSubject[]>> = {}) => {
  const cast: TurnPassSubject[] = [];
  return (event: Parameters<NonNullable<Parameters<typeof runTurn>[0]['advance']>>[0]): Partial<TurnMaterial> | void => {
    if (event.at === 'stage' && event.stage === 'postNarration') {
      return {
        subjects: {
          diary: subjects.diary ?? cast.map((c) => ({ name: c.name })),
          discoverEntity: subjects.discoverEntity ?? [{ name: 'the dockhand' }],
        },
      };
    }
    if (event.at !== 'pass' || event.outcomes.length === 0) return;
    const id = event.outcomes[0].id;
    if (id === 'director' || id === 'thinking') {
      const parsed = event.outcomes[0].parsed as ParsedDirector;
      cast.push(...parsed.cast.map((member) => ({ name: member.name, stance: member.stance })));
      return {
        directorScene: parsed.scene,
        npcCastSize: cast.length,
        subjects: { character: subjects.character ?? cast },
      };
    }
    if (id === 'character') {
      return {
        intents: event.outcomes.map((outcome) => ({
          name: outcome.subject?.name ?? '',
          text: outcome.parsed as string,
        })),
      };
    }
    if (id === 'storyboard') return { turnPlan: event.outcomes[0].parsed as string };
  };
};

interface RunOptions extends FakeOptions {
  input?: Partial<TurnPlanInput>;
  settings?: Partial<TurnSettings>;
  material?: Partial<TurnMaterial>;
  subjects?: Partial<Record<TurnPassId, TurnPassSubject[]>>;
  signal?: AbortSignal;
  onNarrationEvent?: (event: AiStreamEvent) => void;
}

const run = async (options: RunOptions = {}) => {
  const fake = makeFake(options);
  const plan = planTurn(testInput(options.input, options.settings));
  // Each pass id in the order it settled, marked with whether it answered — how a caller waiting on one
  // pass inside a batch learns it can stop waiting.
  const settled: string[] = [];
  const result = await runTurn({
    plan,
    material: material(options.material),
    request: fake.adapter,
    signal: options.signal ?? new AbortController().signal,
    advance: advanceLikeTheView(options.subjects),
    onNarrationEvent: options.onNarrationEvent,
    onPassSettled: (id, outcome) => settled.push(`${id}:${outcome.ok ? 'ok' : 'failed'}`),
  });
  return { result, types: fake.seen.map((s) => s.type), peakInFlight: fake.peakInFlight(), seen: fake.seen, settled };
};

const ok = (result: TurnResult) => {
  expect(result.status, result.status === 'failed' ? `failed: ${result.kind}` : result.status).toBe('ok');
  return result.run;
};

const outcome = (run: { passes: TurnPassOutcome[] }, id: TurnPassId): TurnPassOutcome => {
  const found = run.passes.find((p) => p.id === id);
  if (!found) throw new Error(`no outcome for ${id}`);
  return found;
};

describe('runTurn dispatch order', () => {
  it('sends every due pass in plan order, fan-outs expanded', async () => {
    const { result, types } = await run();
    ok(result);
    expect(types).toEqual([
      'locationChange',
      'director',
      'character',
      'character',
      'storyboard',
      'narration',
      'choices',
      'statUpdates',
      'summary',
      'timePassed',
      'diary',
      'diary',
      'discoverEntity',
    ]);
  });

  it('sends the opening turn its own passes', async () => {
    // No move to resolve before the game has started, and the clock's opening reading runs here only.
    const { result, types } = await run({ input: { isGameStarted: false } });
    ok(result);
    expect(types).not.toContain('locationChange');
    expect(types).toContain('openingTime');
    expect(types.indexOf('openingTime')).toBeGreaterThan(types.indexOf('narration'));
  });

  it('skips a pass whose second gate says it has nothing to ask about', async () => {
    // An empty cast: the director named nobody, so there are no intents for the storyboard to reconcile.
    const { result, types } = await run({
      answers: { director: 'Scene: an empty room\nCast:\n- none' },
      subjects: { character: [], diary: [] },
    });
    ok(result);
    expect(types).not.toContain('storyboard');
    expect(types).not.toContain('character');
    expect(types).toContain('narration');
  });

  it('sends nothing for a due fan-out pass with no subjects', async () => {
    const { result, types } = await run({ subjects: { diary: [], discoverEntity: [] } });
    ok(result);
    expect(types.filter((t) => t === 'diary' || t === 'discoverEntity')).toEqual([]);
  });

  it('sends nothing for a due fan-out pass the caller named no subjects for', async () => {
    // No entry at all, rather than an empty one — the runner must not invent a subject to ask about.
    const fake = makeFake();
    const result = await runTurn({
      plan: planTurn(testInput()),
      material: material(),
      request: fake.adapter,
      signal: new AbortController().signal,
    });
    ok(result);
    expect(fake.seen.map((s) => s.type)).toEqual([
      'locationChange',
      'director',
      'narration',
      'choices',
      'statUpdates',
      'summary',
      'timePassed',
    ]);
  });
});

describe('the concurrency knob', () => {
  it('dispatches the post-narration passes together when parallel', async () => {
    const { result, peakInFlight, seen } = await run();
    ok(result);
    const postNarration = seen.slice(seen.findIndex((s) => s.type === 'narration') + 1);
    // Each joins the ones already in flight: nothing in the batch waits for a sibling to answer.
    expect(postNarration.map((s) => s.inFlight)).toEqual(postNarration.map((_, i) => i + 1));
    expect(peakInFlight).toBe(postNarration.length);
  });

  it('dispatches one request at a time when serial, in the same order', async () => {
    const { result, types, peakInFlight } = await run({ settings: { concurrentTurnRequests: false } });
    ok(result);
    expect(peakInFlight).toBe(1);
    // The digest, diaries and discoveries are the drainers' job outside the batch, so they are not due here.
    expect(types).toEqual([
      'locationChange',
      'director',
      'character',
      'character',
      'storyboard',
      'narration',
      'choices',
      'statUpdates',
      'timePassed',
    ]);
  });

  it('runs a fan-out pass one subject at a time when serial', async () => {
    const { result, seen } = await run({ settings: { concurrentTurnRequests: false } });
    ok(result);
    expect(seen.filter((s) => s.type === 'character').map((s) => s.inFlight)).toEqual([1, 1]);
  });

  it('runs a fan-out pass together when parallel', async () => {
    const { result, seen } = await run();
    ok(result);
    expect(seen.filter((s) => s.type === 'character').map((s) => s.inFlight)).toEqual([1, 2]);
  });
});

describe('the material each pass renders against', () => {
  it('carries the narration into the passes that depend on it', async () => {
    const { result } = await run();
    const finished = ok(result);
    const choices = outcome(finished, 'choices');
    expect(choices.request.messages[0].content).toContain(ANSWERS.narration);
    expect(finished.material.narration).toBe(ANSWERS.narration);
  });

  it("carries the caller's derivations into the passes that follow them", async () => {
    const { result } = await run();
    const finished = ok(result);
    // The storyboarder is fed the intents the character passes produced, in cast order.
    expect(outcome(finished, 'storyboard').request.messages[0].content).toContain('- Maela: I want to be left alone.');
    // Each fan-out request is about its own subject.
    expect(finished.passes.filter((p) => p.id === 'character').map((p) => p.subject?.name)).toEqual(['Maela', 'Bram']);
  });

  it('parses each answer through the pass that asked for it', async () => {
    const { result } = await run();
    const finished = ok(result);
    expect(outcome(finished, 'choices').parsed).toEqual(['Wave at Maela', 'Walk on']);
    expect(outcome(finished, 'locationAuto').parsed).toBe('The Long Pier');
  });
});

describe('what the caller is asked to derive from', () => {
  /** Every advance event the runner raised, as a readable label. */
  const traceOf = async (settings: Partial<TurnSettings>) => {
    const trace: string[] = [];
    const fake = makeFake();
    const result = await runTurn({
      plan: planTurn(testInput({}, settings)),
      material: material(),
      request: fake.adapter,
      signal: new AbortController().signal,
      advance: (event) => {
        trace.push(event.at === 'stage' ? `stage:${event.stage}` : `pass:${event.outcomes[0].id}`);
      },
    });
    ok(result);
    return trace;
  };

  it('raises the same events in both concurrency modes', async () => {
    // A pass that sent nothing has nothing to advance from — the knob decides dispatch, not what the
    // caller is asked. (Here the character and both fan-outs send nothing: no advance supplies subjects.)
    const parallel = await traceOf({ concurrentTurnRequests: true });
    const serial = await traceOf({ concurrentTurnRequests: false });
    expect(parallel.filter((e) => e.startsWith('pass:'))).toEqual(
      ['pass:locationAuto', 'pass:director', 'pass:narration', 'pass:choices', 'pass:statUpdates', 'pass:summary', 'pass:timePassed'],
    );
    expect(serial).toEqual(parallel.filter((e) => e !== 'pass:summary'));
  });

  it('waits for a derivation that holds the turn', async () => {
    // The read-aloud pass has to finish before the post-narration batch competes with it for the card.
    const order: string[] = [];
    const fake = makeFake({ onDispatch: (type) => order.push(`send:${type}`) });
    const result = await runTurn({
      plan: planTurn(testInput()),
      material: material(),
      request: fake.adapter,
      signal: new AbortController().signal,
      advance: async (event) => {
        if (event.at !== 'stage' || event.stage !== 'postNarration') return;
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('held');
      },
    });
    ok(result);
    expect(order.indexOf('held')).toBeGreaterThan(order.indexOf('send:narration'));
    expect(order.indexOf('held')).toBeLessThan(order.indexOf('send:choices'));
  });
});

describe('narration event forwarding', () => {
  it('forwards exactly what the stream emitted, in order', async () => {
    const events: AiStreamEvent[] = [
      { type: 'debug', debug: { kind: 'response', status: 200, openedAt: 0 } },
      { type: 'reasoning', text: 'thinking' },
      { type: 'delta', delta: 'The ', content: 'The ' },
      { type: 'delta', delta: 'gulls', content: 'The gulls' },
    ];
    const forwarded: AiStreamEvent[] = [];
    const { result } = await run({ events, onNarrationEvent: (event) => forwarded.push(event) });
    ok(result);
    // The fake closes every stream with a delta naming its type, so the narration's is the tail here.
    expect(forwarded).toEqual([...events, { type: 'delta', delta: 'narration', content: 'narration' }]);
  });

  it('forwards nothing for the passes that are not the narration', async () => {
    // The fake streams from every request (each ends with a delta naming its own type), so a runner that
    // wired the sink to more than the narration would show it here.
    const forwarded: AiStreamEvent[] = [];
    const { result } = await run({ onNarrationEvent: (event) => forwarded.push(event) });
    ok(result);
    expect(forwarded).toEqual([{ type: 'delta', delta: 'narration', content: 'narration' }]);
  });
});

describe('stopping the turn', () => {
  const abortOn = (type: string) => {
    const controller = new AbortController();
    return {
      signal: controller.signal,
      onDispatch: (dispatched: string) => {
        if (dispatched === type) controller.abort();
      },
    };
  };

  it('reports aborted when the player stops mid-narration', async () => {
    const { result, types } = await run({ ...abortOn('narration'), answers: { narration: '' } });
    expect(result.status).toBe('aborted');
    // Nothing after the narration was dispatched.
    expect(types[types.length - 1]).toBe('narration');
  });

  it('reports aborted rather than an empty narration when the player stops', async () => {
    // The stream ends gracefully carrying nothing, which must not read as the model answering with nothing.
    const { result } = await run({ ...abortOn('narration'), answers: { narration: '' } });
    expect(result.status).toBe('aborted');
  });

  it('reports aborted when the player stops mid-pass, and asks nothing further', async () => {
    const { result, types } = await run({ ...abortOn('choices'), settings: { concurrentTurnRequests: false } });
    expect(result.status).toBe('aborted');
    // The passes that would have followed choices are never sent.
    expect(types[types.length - 1]).toBe('choices');
    expect(types).not.toContain('statUpdates');
  });

  it('reports aborted when the player stops during the batch, and keeps none of its answers', async () => {
    // The batch is already in flight, so it still settles — but a stopped turn commits nothing, so nothing
    // it answered with is read.
    const { result } = await run(abortOn('summary'));
    expect(result.status).toBe('aborted');
    expect(result.run.passes.map((p) => p.id)).toEqual([
      'locationAuto',
      'director',
      'character',
      'character',
      'storyboard',
      'narration',
    ]);
  });

  it('reports aborted when the adapter raises the stop rather than returning', async () => {
    // An adapter that rejects on abort (rather than ending its stream gracefully) is still the player
    // stopping, not a failure to explain.
    const controller = new AbortController();
    const { result } = await run({
      signal: controller.signal,
      answers: {
        narration: () => {
          controller.abort();
          throw new DOMException('aborted', 'AbortError');
        },
      },
    });
    expect(result.status).toBe('aborted');
  });

  it('reports aborted before dispatching anything when the turn is already stopped', async () => {
    const controller = new AbortController();
    controller.abort();
    const { result, types } = await run({ signal: controller.signal });
    expect(result.status).toBe('aborted');
    expect(types).toEqual([]);
  });
});

describe('failure kinds', () => {
  const failing = (error: unknown) => () => {
    throw error;
  };

  const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

  it.each([
    ['connection', new TypeError('Failed to fetch')],
    ['notFound', httpError(404)],
    ['badRequest', httpError(400)],
    ['parse', new Error(UNPARSEABLE_MESSAGE)],
    ['unknown', new Error('something else')],
  ])('names a %s failure', async (kind, error) => {
    const { result } = await run({ answers: { narration: failing(error) } });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.kind).toBe(kind);
    expect(result.error).toBe(error);
  });

  it('names an empty narration', async () => {
    const { result, types } = await run({ answers: { narration: '' } });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.kind).toBe('emptyNarration');
    // The turn cannot advance, so nothing that depends on the narration was asked.
    expect(types[types.length - 1]).toBe('narration');
  });

  it('returns the partial run alongside the failure', async () => {
    const { result } = await run({ answers: { narration: failing(new Error('boom')) } });
    expect(result.status).toBe('failed');
    expect(result.run.passes.map((p) => p.id)).toEqual(['locationAuto', 'director', 'character', 'character', 'storyboard']);
  });
});

describe('what a failing post-narration pass costs', () => {
  it('absorbs one failure in the batch and keeps the rest of the turn', async () => {
    const { result } = await run({
      answers: {
        summary: () => {
          throw new Error('digest failed');
        },
      },
    });
    const finished = ok(result);
    expect(outcome(finished, 'summary').error).toBeInstanceOf(Error);
    expect(outcome(finished, 'summary').raw).toBe('');
    // Its siblings answered normally.
    expect(outcome(finished, 'choices').parsed).toEqual(['Wave at Maela', 'Walk on']);
  });

  it('ends the turn when a pass fails outside the batch', async () => {
    // Dispatched one at a time, an aux failure has always taken the turn down with it.
    const { result } = await run({
      settings: { concurrentTurnRequests: false },
      answers: {
        choices: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.kind).toBe('connection');
  });
});

describe('onPassSettled', () => {
  it('reports a batched pass the moment it answers, not when its stage finishes', async () => {
    // The choices pass unblocks the player's input. Batched, it must not wait on the diaries and the digest
    // beside it — so it has to be reported before the stage's own advance runs.
    const { result, settled } = await run({
      answers: {
        // Every sibling answers a tick later than choices, so a report tied to the stage would land after
        // all of them rather than first.
        summary: () => 'late',
        timePassed: () => 'late',
        diary: () => 'late',
        discoverEntity: () => 'late',
      },
    });
    ok(result);
    const batch = settled.slice(settled.indexOf('narration:ok') + 1);
    expect(batch[0]).toBe('choices:ok');
    expect(batch).toContain('summary:ok');
  });

  it('reports a pass that failed as failed', async () => {
    const { settled } = await run({
      answers: {
        diary: () => {
          throw new Error('nope');
        },
      },
    });
    expect(settled).toContain('diary:failed');
    expect(settled).toContain('choices:ok');
  });

  it('reports every dispatched request, fan-outs included', async () => {
    const { result, types, settled } = await run();
    ok(result);
    expect(settled).toHaveLength(types.length);
  });
});

describe('the request that ended the turn', () => {
  it('comes back with the failure, so nothing has to be read off the error', async () => {
    // The digest is silent — it shows nothing of its own when it fails, which is the difference the view
    // needs to know about and used to learn from a flag written onto the error object.
    const { result } = await run({
      settings: { concurrentTurnRequests: false, aiClock: true },
      answers: {
        timePassed: () => {
          throw new Error('nope');
        },
      },
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.request?.type).toBe('timePassed');
    expect(result.request?.silent).toBe(true);
  });

  it('is the foreground request when a foreground pass is what failed', async () => {
    const { result } = await run({
      settings: { concurrentTurnRequests: false },
      answers: {
        choices: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.request?.type).toBe('choices');
    expect(result.request?.silent).toBe(false);
  });

  it('is left unset when a batch absorbed the only failure', async () => {
    // A batched failure is backfilled by an idle drainer; the turn finished, so nothing ended it.
    const { result } = await run({
      answers: {
        diary: () => {
          throw new Error('nope');
        },
      },
    });
    expect(result.status).toBe('ok');
  });

  it('is not a request the batch absorbed, when something after the batch is what threw', async () => {
    // The batch swallowed a diary failure and carried on; what actually ended the turn was the caller's own
    // derivation afterward. Naming the diary here would tell the view a silent pass failed when none did.
    const fake = makeFake({
      answers: {
        diary: () => {
          throw new Error('absorbed');
        },
      },
    });
    const inner = advanceLikeTheView();
    const result = await runTurn({
      plan: planTurn(testInput()),
      material: material(),
      request: fake.adapter,
      signal: new AbortController().signal,
      advance: (event) => {
        if (event.at === 'pass' && event.outcomes[0]?.id === 'choices') throw new Error('the view blew up');
        return inner(event);
      },
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.request).toBeUndefined();
  });
});

describe('the request each pass sends', () => {
  it("sends the pass record's own payload, unshaped by the runner", async () => {
    const { result } = await run();
    const finished = ok(result);
    const digest = outcome(finished, 'summary');
    expect(digest.request.silent).toBe(true);
    expect(digest.request.attachTurnId).toBe('turn-1');
    expect(outcome(finished, 'choices').request.systemPrompt).toContain(TEST_PROMPTS.choices.split(' ')[0]);
    expect(outcome(finished, 'narration').request.systemPrompt).toBe('NARRATION SYSTEM');
  });
});
