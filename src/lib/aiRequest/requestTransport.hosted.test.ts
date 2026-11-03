import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { sseFrame, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { HostedSession } from '@/lib/hostedAi/hostedSession';
import { HostedTurn } from '@/lib/hostedAi/hostedTurn';
import { HOSTED_CHAT_URL, HOSTED_STATE_URL, PROMPT_TYPE_HEADER, TURN_HEADER } from '@/lib/hostedAi/hostedUrls';
import { HOSTED_REFUSALS } from '@/lib/hostedAi/refusals';
import { AiStreamError } from './aiStream';
import {
  transportRequest, type TransportContext, type TransportEvent, type TransportRequest, type TransportTarget,
} from './requestTransport';

// --- A fake proxy: the chat route answers from a script, the state route from a canned state -------------

const READY_STATE = {
  tier: 'supporter', state: 'ready', window: 20000, maxTokens: 800, tokenMargin: 500,
  model: { id: 'entry-1', capabilities: { tools: true, reasoning: null } },
  percentUsed: 10, turnsLeft: 90, resetAt: '2026-11-01T00:00:00.000Z', acknowledged: [], warnThresholds: [75, 90],
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const refusal = (code: string, extra: Record<string, unknown> = {}) =>
  json(HOSTED_REFUSALS[code as keyof typeof HOSTED_REFUSALS], { success: false, code, error: `Refused: ${code}`, ...extra });

/** A streamed reply carrying the turn id and the final usage event, as the proxy sends it. */
const proxyReply = (content: string, turnId: string, usage = { percentUsed: 12, turnsLeft: 88, resetAt: '2026-11-01T00:00:00.000Z' }) =>
  new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of [sseFrame({ content }), sseFrame({}, 'stop'), `event: usage\ndata: ${JSON.stringify(usage)}\n\n`, 'data: [DONE]\n\n']) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream', [TURN_HEADER]: turnId } });

interface Sent { url: string; headers: Record<string, string> }

/** A proxy whose chat route answers each call with the next script entry, recording what each call sent. */
function fakeProxy(chat: Array<() => Response | Promise<Response>>, state: () => Response = () => json(200, { success: true, data: READY_STATE })) {
  const sent: Sent[] = [];
  let next = 0;
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    sent.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
    if (url === HOSTED_STATE_URL) return state();
    const entry = chat[next++];
    if (!entry) throw new Error(`Unscripted chat call #${next}`);
    return entry();
  }) as unknown as typeof fetch;
  return { fetchImpl, sent, chatCalls: () => sent.filter((s) => s.url === HOSTED_CHAT_URL) };
}

/** A session on the fake proxy with a token the test can take away. */
async function signedIn(fetchImpl: typeof fetch) {
  const account = { token: 'token-a' as string | null };
  const session = new HostedSession({ credential: () => account.token, fetchImpl });
  await session.refresh();
  return { session, account };
}

const hostedTarget = (): TransportTarget => ({
  ...textTarget({
    endpointId: 'formamorph-ai', url: HOSTED_CHAT_URL, apiToken: '', model: 'entry-1', maxTokens: 800, hosted: true,
    reasoning: UNKNOWN_REASONING_CAPABILITY,
  }),
  presetId: null,
  presetName: 'Formamorph AI',
});

const context = (fetchImpl: typeof fetch, session: HostedSession, over: Partial<TransportContext> = {}): TransportContext => ({
  settings: textSnapshot(hostedTarget()),
  resolveEndpoint: () => hostedTarget(),
  tools: [],
  worldTools: [],
  enabledTools: {},
  toolsEnabled: false,
  toolSnapshot: () => { throw new Error('No request here builds its own Tool Snapshot'); },
  showSilentRequests: false,
  noteReasoningReply: () => {},
  noteSchemaRejected: () => {},
  fetchImpl,
  hostedSession: session,
  ...over,
});

const request = (over: Partial<TransportRequest> = {}): TransportRequest => ({
  systemPrompt: 'You narrate.',
  messages: [{ role: 'user', content: 'I walk to the dock.' }],
  type: 'narration',
  ...over,
});

/** Sends one request; resolves its text or its error, with every event its sink saw. */
const send = async (req: TransportRequest, ctx: TransportContext) => {
  const events: TransportEvent[] = [];
  const outcome = await transportRequest(req, ctx, (event) => events.push(event)).then(
    (text) => ({ text, error: null as unknown }),
    (error: unknown) => ({ text: null, error }),
  );
  return { ...outcome, events, failures: events.filter((e) => e.type === 'failure') };
};

afterEach(() => vi.restoreAllMocks());
const quietErrors = () => vi.spyOn(console, 'error').mockImplementation(() => {});

// --- Tests ------------------------------------------------------------------------------------------------

describe('Formamorph AI through the Request Transport', () => {
  it('sends the account token, and the server-issued turn id on every later call of the turn', async () => {
    const proxy = fakeProxy([() => proxyReply('One.', 'turn-1'), () => proxyReply('Two.', 'turn-1'), () => proxyReply('Three.', 'turn-1')]);
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });

    // Three passes start at once, as a turn's passes do.
    const results = await Promise.all([send(request(), ctx), send(request({ type: 'choices' }), ctx), send(request({ type: 'statUpdates', silent: true }), ctx)]);

    expect(results.map((r) => r.error)).toEqual([null, null, null]);
    const calls = proxy.chatCalls();
    expect(calls.map((c) => c.headers.Authorization)).toEqual(['Bearer token-a', 'Bearer token-a', 'Bearer token-a']);
    expect(calls.map((c) => c.headers[TURN_HEADER])).toEqual([undefined, 'turn-1', 'turn-1']);
  });

  it('names each pass\'s prompt type on every call', async () => {
    const proxy = fakeProxy([() => proxyReply('One.', 'turn-1'), () => proxyReply('Two.', 'turn-1'), () => proxyReply('Three.', 'turn-1'), () => proxyReply('Four.', 'turn-1')]);
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });

    await send(request(), ctx);
    await Promise.all([
      send(request({ type: 'choices' }), ctx), send(request({ type: 'statUpdates', silent: true }), ctx), send(request({ type: 'help' }), ctx),
    ]);

    expect(proxy.chatCalls().map((c) => c.headers[PROMPT_TYPE_HEADER])).toEqual(['narration', 'choices', 'statUpdates', 'help']);
  });

  it('sends no prompt type to another endpoint', async () => {
    const other: TransportTarget = {
      ...textTarget({ endpointId: 'own', url: 'http://localhost:1234/v1/chat/completions', apiToken: 'k', model: 'm', maxTokens: 800, reasoning: UNKNOWN_REASONING_CAPABILITY }),
      presetId: null,
      presetName: 'Own',
    };
    const sent: Record<string, string>[] = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      sent.push({ ...(init?.headers as Record<string, string>) });
      return sseResponse([sseFrame({ content: 'Hi.' }), sseFrame({}, 'stop'), 'data: [DONE]\n\n']);
    }) as unknown as typeof fetch;
    const { session } = await signedIn(fakeProxy([]).fetchImpl);

    await send(request(), context(fetchImpl, session, { settings: textSnapshot(other), resolveEndpoint: () => other }));

    expect(sent).toHaveLength(1);
    expect(Object.keys(sent[0])).not.toContain(PROMPT_TYPE_HEADER);
  });

  it('hands the turn to the next call when the first is refused, so the turn still opens once', async () => {
    quietErrors();
    const proxy = fakeProxy([() => refusal('rate_limited'), () => proxyReply('Two.', 'turn-2'), () => proxyReply('Three.', 'turn-2')]);
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });

    await Promise.all([send(request(), ctx), send(request({ type: 'choices' }), ctx), send(request({ type: 'statUpdates' }), ctx)]);

    expect(proxy.chatCalls().map((c) => c.headers[TURN_HEADER])).toEqual([undefined, undefined, 'turn-2']);
  });

  it('reads the token at send time, so a sign-out mid-turn never sends the old one', async () => {
    quietErrors();
    const proxy = fakeProxy([() => proxyReply('One.', 'turn-1')]);
    const { session, account } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });

    await send(request(), ctx);
    account.token = null;
    const second = await send(request({ type: 'choices' }), ctx);

    expect(proxy.chatCalls()).toHaveLength(1);
    expect(second.error).toBeInstanceOf(AiStreamError);
    expect((second.error as AiStreamError).hosted?.presetState).toBe('signed-out');
  });

  it('never sends the old token from a call that waited behind the first while the player signed out', async () => {
    quietErrors();
    let openFirst = (_r: Response) => {};
    const proxy = fakeProxy([() => new Promise<Response>((resolve) => { openFirst = resolve; })]);
    const { session, account } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });

    const first = send(request(), ctx);
    const waiting = send(request({ type: 'choices' }), ctx);
    // The second call is queued on the turn gate; the player signs out before the first call's headers arrive.
    await vi.waitFor(() => expect(proxy.chatCalls()).toHaveLength(1));
    account.token = null;
    openFirst(proxyReply('One.', 'turn-1'));

    const [, second] = await Promise.all([first, waiting]);
    expect(proxy.chatCalls()).toHaveLength(1);
    expect((second.error as AiStreamError).hosted?.presetState).toBe('signed-out');
  });

  it('stops waiting on the turn gate when the call is stopped', async () => {
    let openFirst = (_r: Response) => {};
    const proxy = fakeProxy([() => new Promise<Response>((resolve) => { openFirst = resolve; })]);
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });
    const controller = new AbortController();

    const first = send(request(), ctx);
    const waiting = send(request({ type: 'choices', signal: controller.signal }), ctx);
    await vi.waitFor(() => expect(proxy.chatCalls()).toHaveLength(1));
    controller.abort();

    expect((await waiting).text).toBe('');
    openFirst(proxyReply('One.', 'turn-1'));
    await first;
    expect(proxy.chatCalls()).toHaveLength(1);
  });

  it('keeps the turn message for a visible pass when a background pass fails first', async () => {
    quietErrors();
    const proxy = fakeProxy([() => refusal('upstream_error'), () => refusal('upstream_error')]);
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });

    const background = await send(request({ type: 'summary', silent: true, attachTurnId: 't' }), ctx);
    const visible = await send(request({ type: 'choices' }), ctx);

    expect(background.failures).toHaveLength(0);
    expect(visible.failures).toHaveLength(1);
  });

  it('lays the final usage event onto the hosted state', async () => {
    const proxy = fakeProxy([() => proxyReply('One.', 'turn-1', { percentUsed: 41, turnsLeft: 7, resetAt: '2026-11-01T00:00:00.000Z' })]);
    const { session } = await signedIn(proxy.fetchImpl);

    const { text } = await send(request(), context(proxy.fetchImpl, session));

    expect(text).toBe('One.');
    expect(session.getSnapshot().hosted).toMatchObject({ percentUsed: 41, turnsLeft: 7 });
  });

  it.each([
    ['not_entitled', 'locked'],
    ['pledge_unconfirmed', 'unconfirmed'],
    ['age_gate_required', 'age-gate'],
    ['service_paused', 'paused'],
    ['budget_exhausted', 'exhausted'],
  ] as const)('maps %s to the %s preset state and its message', async (code, state) => {
    quietErrors();
    const proxy = fakeProxy([() => refusal(code)]);
    const { session } = await signedIn(proxy.fetchImpl);

    const { error, failures } = await send(request(), context(proxy.fetchImpl, session));

    expect((error as AiStreamError).hosted).toMatchObject({ code, presetState: state });
    expect((error as AiStreamError).message).toBe(`Refused: ${code}`);
    expect(failures).toHaveLength(1);
    expect(session.getSnapshot().presetState).toBe(state);
  });

  it.each(['rate_limited', 'turn_expired', 'invalid_request', 'image_not_supported', 'upstream_error'] as const)(
    'fails the turn on %s and keeps the preset ready',
    async (code) => {
      quietErrors();
      const proxy = fakeProxy([() => refusal(code)]);
      const { session } = await signedIn(proxy.fetchImpl);

      const { error } = await send(request(), context(proxy.fetchImpl, session));

      expect((error as AiStreamError).hosted).toMatchObject({ code, presetState: null });
      expect(session.getSnapshot().presetState).toBe('ready');
    },
  );

  it.each([
    ['an expired token', () => json(401, { success: false, error: 'Not authorized to access this route' }), 'signed-out'],
    ['the privacy refusal', () => json(403, { success: false, code: 'PRIVACY_REQUIRED', error: 'Formamorph needs updating to continue.' }), 'privacy-required'],
    ['the suspended refusal', () => json(403, { success: false, error: 'Your account has been suspended', suspendedUntil: null }), 'suspended'],
    ['an outdated build', () => json(426, { success: false, code: 'CLIENT_UPDATE_REQUIRED', minVersion: '9.0.0', feature: 'Formamorph AI', error: 'x' }), 'outdated'],
  ] as const)('maps %s to its preset state', async (_name, respond, state) => {
    quietErrors();
    const proxy = fakeProxy([respond]);
    const { session } = await signedIn(proxy.fetchImpl);

    await send(request(), context(proxy.fetchImpl, session));

    expect(session.getSnapshot().presetState).toBe(state);
  });

  it('takes the window a window_exceeded refusal names, and reads the hosted state again', async () => {
    quietErrors();
    const proxy = fakeProxy([() => refusal('window_exceeded', { window: 12000 })]);
    const { session } = await signedIn(proxy.fetchImpl);
    const stateReads = () => proxy.sent.filter((s) => s.url === HOSTED_STATE_URL).length;
    const before = stateReads();

    await send(request(), context(proxy.fetchImpl, session));

    expect(stateReads()).toBe(before + 1);
  });

  it('ends a reply on a mid-stream error event as an upstream_error', async () => {
    quietErrors();
    const midStream = () => sseResponse([
      sseFrame({ content: 'The gulls ' }),
      'event: error\ndata: {"success":false,"code":"upstream_error","error":"The AI provider did not answer. Try again."}\n\n',
    ]);
    const proxy = fakeProxy([midStream]);
    const { session } = await signedIn(proxy.fetchImpl);

    const { error } = await send(request(), context(proxy.fetchImpl, session));

    expect((error as AiStreamError).hosted).toMatchObject({ code: 'upstream_error' });
    expect((error as AiStreamError).message).toBe('The AI provider did not answer. Try again.');
  });

  it('refuses a call in a blocking state without sending it, and shows the message once per turn', async () => {
    quietErrors();
    const locked = () => json(200, { success: true, data: { ...READY_STATE, state: 'locked' } });
    const proxy = fakeProxy([], locked);
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });

    const results = await Promise.all([send(request(), ctx), send(request({ type: 'choices' }), ctx), send(request({ type: 'statUpdates' }), ctx)]);

    expect(proxy.chatCalls()).toHaveLength(0);
    expect(results.flatMap((r) => r.failures)).toHaveLength(1);
    expect((results[0].error as AiStreamError).hosted?.presetState).toBe('locked');
  });

  it('finishes a started turn after the commit spends the allowance, and blocks the next turn', async () => {
    quietErrors();
    const proxy = fakeProxy([() => proxyReply('One.', 'turn-1', { percentUsed: 100, turnsLeft: 0, resetAt: '2026-11-01T00:00:00.000Z' }), () => proxyReply('Two.', 'turn-1')]);
    const { session } = await signedIn(proxy.fetchImpl);
    const turn = new HostedTurn();
    await send(request(), context(proxy.fetchImpl, session, { hostedTurn: turn }));
    session.settleTurn();
    expect(session.getSnapshot().presetState).toBe('exhausted');

    // A pass after the commit joins the admitted turn; a new turn has no id and the client refuses it.
    const later = await send(request({ type: 'statUpdates', silent: true }), context(proxy.fetchImpl, session, { hostedTurn: turn }));
    const next = await send(request(), context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() }));

    expect(later.error).toBeNull();
    expect(proxy.chatCalls().map((c) => c.headers[TURN_HEADER])).toEqual([undefined, 'turn-1']);
    expect((next.error as AiStreamError).hosted?.presetState).toBe('exhausted');
  });

  it('stops a started turn and the next turn when the day pauses', async () => {
    quietErrors();
    const proxy = fakeProxy([() => proxyReply('One.', 'turn-1'), () => refusal('service_paused'), () => proxyReply('Two.', 'turn-1')]);
    const { session } = await signedIn(proxy.fetchImpl);
    const turn = new HostedTurn();
    await send(request(), context(proxy.fetchImpl, session, { hostedTurn: turn }));
    // Another turn's first call meets the pause.
    await send(request(), context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() }));
    expect(session.getSnapshot().presetState).toBe('paused');

    const later = await send(request({ type: 'statUpdates', silent: true }), context(proxy.fetchImpl, session, { hostedTurn: turn }));
    const next = await send(request(), context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() }));

    expect((later.error as AiStreamError).hosted?.presetState).toBe('paused');
    expect(proxy.chatCalls().map((c) => c.headers[TURN_HEADER])).toEqual([undefined, undefined]);
    expect((next.error as AiStreamError).hosted?.presetState).toBe('paused');
  });

  it('still sends while the hosted state is unavailable', async () => {
    const proxy = fakeProxy([() => proxyReply('One.', 'turn-1')], () => { throw new TypeError('Failed to fetch'); });
    const { session } = await signedIn(proxy.fetchImpl);
    expect(session.getSnapshot().presetState).toBe('unavailable');

    const { text } = await send(request(), context(proxy.fetchImpl, session));

    expect(text).toBe('One.');
  });

  it('sends no call while the pledge is unconfirmed, and says why', async () => {
    quietErrors();
    const proxy = fakeProxy([], () => json(200, { success: true, data: { ...READY_STATE, state: 'unconfirmed' } }));
    const { session } = await signedIn(proxy.fetchImpl);

    const { error, failures } = await send(request(), context(proxy.fetchImpl, session));

    expect(proxy.chatCalls()).toHaveLength(0);
    expect(failures).toHaveLength(1);
    expect((error as AiStreamError).hosted?.presetState).toBe('unconfirmed');
  });

  describe('a blocked send re-reads the state', () => {
    const THROTTLE_PASSED = 31_000;
    const clockAfter = (ms: number) => {
      const start = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(start + ms);
    };

    it.each(['unconfirmed', 'exhausted', 'paused'])('sends once the state returns from %s', async (blocked) => {
      quietErrors();
      let state = blocked;
      const proxy = fakeProxy([() => proxyReply('Back.', 'turn-1')], () => json(200, { success: true, data: { ...READY_STATE, state } }));
      const { session } = await signedIn(proxy.fetchImpl);
      expect(session.getSnapshot().presetState).toBe(blocked);

      state = 'ready';
      clockAfter(THROTTLE_PASSED);
      const { text } = await send(request(), context(proxy.fetchImpl, session));

      expect(text).toBe('Back.');
      expect(session.getSnapshot().presetState).toBe('ready');
    });

    it('re-reads a started turn that the unconfirmed state blocks', async () => {
      quietErrors();
      let state = 'ready';
      const proxy = fakeProxy([() => proxyReply('One.', 'turn-1'), () => proxyReply('Two.', 'turn-1')], () => json(200, { success: true, data: { ...READY_STATE, state } }));
      const { session } = await signedIn(proxy.fetchImpl);
      const turn = new HostedTurn();
      await send(request(), context(proxy.fetchImpl, session, { hostedTurn: turn }));

      state = 'unconfirmed';
      await session.refresh();
      state = 'ready';
      clockAfter(THROTTLE_PASSED);
      const later = await send(request({ type: 'statUpdates', silent: true }), context(proxy.fetchImpl, session, { hostedTurn: turn }));

      expect(later.error).toBeNull();
    });

    it('makes one read for blocked sends inside the throttle', async () => {
      quietErrors();
      const proxy = fakeProxy([], () => json(200, { success: true, data: { ...READY_STATE, state: 'unconfirmed' } }));
      const { session } = await signedIn(proxy.fetchImpl);
      const stateReads = () => proxy.sent.filter((s) => s.url === HOSTED_STATE_URL).length;
      expect(stateReads()).toBe(1);

      const sendBackground = (turn: string) =>
        send(request({ type: 'summary', silent: true, attachTurnId: turn }), context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() }));
      // Inside the throttle of the first read, a blocked send reads nothing.
      await sendBackground('t1');
      expect(stateReads()).toBe(1);

      clockAfter(THROTTLE_PASSED);
      const results = await Promise.all([sendBackground('t2'), sendBackground('t3'), sendBackground('t4')]);
      expect(stateReads()).toBe(2);
      expect(results.every((r) => (r.error as AiStreamError).hosted?.presetState === 'unconfirmed')).toBe(true);
    });

    it('refuses with one notice when the read still shows the blocked state', async () => {
      quietErrors();
      const proxy = fakeProxy([], () => json(200, { success: true, data: { ...READY_STATE, state: 'exhausted' } }));
      const { session } = await signedIn(proxy.fetchImpl);

      clockAfter(THROTTLE_PASSED);
      const ctx = context(proxy.fetchImpl, session);
      const first = await send(request(), ctx);

      expect(proxy.chatCalls()).toHaveLength(0);
      expect(first.failures).toHaveLength(1);
      expect((first.error as AiStreamError).hosted?.presetState).toBe('exhausted');
    });
  });

  it.each(['locked', 'unconfirmed'])('tells the player once per state change when a background pass is blocked by %s', async (blockedState) => {
    quietErrors();
    let state = blockedState;
    const proxy = fakeProxy([], () => json(200, { success: true, data: { ...READY_STATE, state } }));
    const { session } = await signedIn(proxy.fetchImpl);
    const background = (turn: string) =>
      send(request({ type: 'summary', silent: true, attachTurnId: turn }), context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() }));

    const shownPerTurn = [];
    for (const turn of ['t1', 't2', 't3']) shownPerTurn.push((await background(turn)).failures.length);
    // The preset sends again, then locks again: that is a new state change.
    state = 'ready';
    await session.refresh();
    state = blockedState;
    await session.refresh();
    shownPerTurn.push((await background('t4')).failures.length);

    expect(shownPerTurn).toEqual([1, 0, 0, 1]);
  });

  it('shows a blocked state once when a visible pass already said it this turn', async () => {
    quietErrors();
    const locked = () => json(200, { success: true, data: { ...READY_STATE, state: 'locked' } });
    const proxy = fakeProxy([], locked);
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });

    const visible = await send(request(), ctx);
    const background = await send(request({ type: 'summary', silent: true, attachTurnId: 't' }), ctx);

    expect([visible.failures.length, background.failures.length]).toEqual([1, 0]);
  });

  it('counts a visible pass\'s message as the announcement for later background passes', async () => {
    quietErrors();
    const locked = () => json(200, { success: true, data: { ...READY_STATE, state: 'locked' } });
    const proxy = fakeProxy([], locked);
    const { session } = await signedIn(proxy.fetchImpl);

    const visible = await send(request(), context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() }));
    const nextTurn = await send(request({ type: 'summary', silent: true, attachTurnId: 'u' }), context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() }));

    expect([visible.failures.length, nextTurn.failures.length]).toEqual([1, 0]);
  });

  it('raises no failure for a background pass refused by the server', async () => {
    quietErrors();
    const proxy = fakeProxy([() => refusal('turn_expired')]);
    const { session } = await signedIn(proxy.fetchImpl);

    const { error, failures } = await send(request({ type: 'summary', silent: true, attachTurnId: 'old' }), context(proxy.fetchImpl, session));

    expect(error).toBeInstanceOf(AiStreamError);
    expect(failures).toHaveLength(0);
  });
});

describe('Formamorph AI turn expiry', () => {
  // A 600 second limit less the 30 second margin: an id is good for 570 seconds from the opening send.
  const LIMITED_STATE = { ...READY_STATE, turnLimitSeconds: 600 };
  const EXPIRES_AT = 570_000;
  const stateOf = (data: Record<string, unknown>) => () => json(200, { success: true, data });
  const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
  afterEach(() => { vi.useRealTimers(); });

  /** A turn on a limited state whose opening call has finished, with the chat script's later replies queued. */
  async function openedTurn(replies: Array<() => Response | Promise<Response>>, state: Record<string, unknown> = LIMITED_STATE) {
    const proxy = fakeProxy([() => proxyReply('One.', 'turn-1'), ...replies], stateOf(state));
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: session.turnFor('old') });
    await send(request(), ctx);
    return { proxy, session, ctx };
  }
  const turnIds = (proxy: { chatCalls: () => Sent[] }) => proxy.chatCalls().map((c) => c.headers[TURN_HEADER]);

  it('sends the id just before the margin and opens a new turn at the margin', async () => {
    const { proxy, ctx } = await openedTurn([() => proxyReply('Two.', 'turn-1'), () => proxyReply('Three.', 'turn-2'), () => proxyReply('Four.', 'turn-2')]);

    later(EXPIRES_AT - 1);
    await send(request({ type: 'choices' }), ctx);
    later(1);
    await send(request({ type: 'choices' }), ctx);
    await send(request({ type: 'choices' }), ctx);

    expect(turnIds(proxy)).toEqual([undefined, 'turn-1', undefined, 'turn-2']);
  });

  it('runs the clock from the send of the opening call, not from its response', async () => {
    const slowOpen = () => { later(100_000); return proxyReply('One.', 'turn-1'); };
    const proxy = fakeProxy([slowOpen, () => proxyReply('Two.', 'turn-2')], stateOf(LIMITED_STATE));
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });
    await send(request(), ctx);

    later(EXPIRES_AT - 100_000);
    await send(request({ type: 'choices' }), ctx);

    expect(turnIds(proxy)).toEqual([undefined, undefined]);
  });

  it('shares one new turn among concurrent calls after expiry', async () => {
    const { proxy, ctx } = await openedTurn([() => proxyReply('Two.', 'turn-2'), () => proxyReply('Three.', 'turn-2'), () => proxyReply('Four.', 'turn-2')]);

    later(EXPIRES_AT);
    const results = await Promise.all([
      send(request({ type: 'statUpdates', silent: true }), ctx), send(request({ type: 'choices' }), ctx), send(request({ type: 'summary', silent: true }), ctx),
    ]);

    expect(results.map((r) => r.error)).toEqual([null, null, null]);
    expect(turnIds(proxy)).toEqual([undefined, undefined, 'turn-2', 'turn-2']);
  });

  it.each([
    ['a null limit', { ...READY_STATE, turnLimitSeconds: null }],
    ['no limit field', READY_STATE],
  ])('never expires the id with %s', async (_name, state) => {
    const { proxy, ctx } = await openedTurn([() => proxyReply('Two.', 'turn-1')], state);

    later(365 * 24 * 3600 * 1000);
    await send(request({ type: 'choices' }), ctx);

    expect(turnIds(proxy)).toEqual([undefined, 'turn-1']);
  });

  it('applies a spent week to the next call of an expired turn, and to no call before it expires', async () => {
    quietErrors();
    const spent = { percentUsed: 100, turnsLeft: 0, resetAt: '2026-11-01T00:00:00.000Z' };
    const proxy = fakeProxy([() => proxyReply('One.', 'turn-1', spent), () => proxyReply('Two.', 'turn-1')], stateOf(LIMITED_STATE));
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() });
    await send(request(), ctx);
    session.settleTurn();
    expect(session.getSnapshot().presetState).toBe('exhausted');

    later(EXPIRES_AT - 1);
    const live = await send(request({ type: 'statUpdates', silent: true }), ctx);
    later(1);
    const expired = await send(request({ type: 'statUpdates', silent: true }), ctx);

    expect(live.error).toBeNull();
    expect((expired.error as AiStreamError).hosted?.presetState).toBe('exhausted');
    expect(turnIds(proxy)).toEqual([undefined, 'turn-1']);
  });

  it('applies a paused day to the next call of an expired turn', async () => {
    quietErrors();
    let state: Record<string, unknown> = LIMITED_STATE;
    const proxy = fakeProxy([() => proxyReply('One.', 'turn-1'), () => refusal('service_paused')], () => stateOf(state)());
    const { session } = await signedIn(proxy.fetchImpl);
    const ctx = context(proxy.fetchImpl, session, { hostedTurn: session.turnFor('old') });
    await send(request(), ctx);
    await send(request(), context(proxy.fetchImpl, session, { hostedTurn: new HostedTurn() }));
    expect(session.getSnapshot().presetState).toBe('paused');

    // The re-read past the throttle reports the same pause the refusal did.
    state = { ...LIMITED_STATE, state: 'paused' };
    later(EXPIRES_AT);
    const expired = await send(request({ type: 'statUpdates', silent: true }), ctx);

    expect((expired.error as AiStreamError).hosted?.presetState).toBe('paused');
    expect(proxy.chatCalls()).toHaveLength(2);
  });

  it('lets a server refusal of the new turn stop the calls waiting on it', async () => {
    quietErrors();
    const { proxy, ctx } = await openedTurn([() => refusal('budget_exhausted')]);

    later(EXPIRES_AT);
    const results = await Promise.all([send(request({ type: 'statUpdates', silent: true }), ctx), send(request({ type: 'summary', silent: true }), ctx)]);

    expect(results.map((r) => (r.error as AiStreamError).hosted?.presetState)).toEqual(['exhausted', 'exhausted']);
    expect(turnIds(proxy)).toEqual([undefined, undefined]);
  });

  it.each(['summary', 'sceneTags'] as const)('finishes a late %s call on an old turn under budget', async (type) => {
    const { proxy, ctx } = await openedTurn([() => proxyReply('Late.', 'turn-2')]);

    later(EXPIRES_AT + 3600_000);
    const { text, error } = await send(request({ type, silent: true, attachTurnId: 'old' }), ctx);

    expect(error).toBeNull();
    expect(text).toBe('Late.');
    expect(turnIds(proxy)).toEqual([undefined, undefined]);
  });

  it('shortens the margin for a short limit, so the turn keeps most of its time', async () => {
    const { proxy, ctx } = await openedTurn(
      [() => proxyReply('Two.', 'turn-1'), () => proxyReply('Three.', 'turn-2')],
      { ...READY_STATE, turnLimitSeconds: 60 },
    );

    later(53_999);
    await send(request({ type: 'choices' }), ctx);
    later(1);
    await send(request({ type: 'choices' }), ctx);

    expect(turnIds(proxy)).toEqual([undefined, 'turn-1', undefined]);
  });
});
