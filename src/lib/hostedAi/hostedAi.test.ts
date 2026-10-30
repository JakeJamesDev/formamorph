import { describe, expect, it } from 'vitest';
import { HOSTED_REFUSALS, readHostedRefusal } from './refusals';
import { HostedSession } from './hostedSession';
import { hostedPromptWindow, hostedReasoningCapability, parseHostedState } from './hostedState';
import { HOSTED_STATE_URL } from './hostedUrls';

const STATE = {
  tier: 'supporter_plus', state: 'ready', window: 32000, maxTokens: 900, tokenMargin: 1000,
  model: { id: 'entry-2', capabilities: { tools: true, reasoning: 'openrouter', budget: true, efforts: ['low', 'high', 'bogus'] } },
  percentUsed: 20, turnsLeft: 50, resetAt: '2026-11-01T00:00:00.000Z', acknowledged: [75],
};

const sessionOn = (respond: () => Response, token: string | null = 't') =>
  new HostedSession({
    credential: () => token,
    fetchImpl: (async (url: string) => {
      if (url !== HOSTED_STATE_URL) throw new Error(`Unexpected request to ${url}`);
      return respond();
    }) as unknown as typeof fetch,
  });

const ok = (data: unknown) => () => new Response(JSON.stringify({ success: true, data }), { status: 200 });

describe('the refusal code list', () => {
  // Pinned against the server's REFUSALS table (FormamorphServer tests/hostedAiProxy.test.js).
  it('matches the server list code for code and status for status', () => {
    expect(HOSTED_REFUSALS).toEqual({
      invalid_request: 400,
      age_gate_required: 403,
      not_entitled: 403,
      service_paused: 503,
      rate_limited: 429,
      turn_expired: 409,
      budget_exhausted: 402,
      window_exceeded: 413,
      image_not_supported: 400,
      upstream_error: 502,
    });
  });

  it('carries the window and the reset time where the server sends them', () => {
    expect(readHostedRefusal(413, { code: 'window_exceeded', error: 'x', window: 9000 })).toMatchObject({ window: 9000, presetState: null });
    expect(readHostedRefusal(402, { code: 'budget_exhausted', error: 'x', resetAt: 'r' })).toMatchObject({ resetAt: 'r', presetState: 'exhausted' });
  });

  it('reads any 426 as an outdated build, with or without its code', () => {
    expect(readHostedRefusal(426, null).presetState).toBe('outdated');
  });

  it('leaves the rename refusal to the app, with no preset state', () => {
    expect(readHostedRefusal(403, { code: 'USERNAME_RENAME_REQUIRED', error: 'x' }).presetState).toBeNull();
  });
});

describe('the preset state from the hosted state', () => {
  it.each(['ready', 'warned', 'exhausted', 'paused', 'locked', 'age-gate'] as const)('reads %s as reported', async (state) => {
    const session = sessionOn(ok({ ...STATE, state }));
    await session.refresh();
    expect(session.getSnapshot().presetState).toBe(state);
  });

  it('is signed-out with no token, and reads nothing', async () => {
    let read = false;
    const session = sessionOn(() => { read = true; return ok(STATE)(); }, null);
    await session.refresh();
    expect(session.getSnapshot().presetState).toBe('signed-out');
    expect(read).toBe(false);
  });

  it('is unavailable until a read answers, and when a read fails, keeping the last state it read', async () => {
    let fail = false;
    const session = sessionOn(() => { if (fail) throw new TypeError('Failed to fetch'); return ok(STATE)(); });
    expect(session.getSnapshot().presetState).toBe('unavailable');
    await session.refresh();
    fail = true;
    await session.refresh();
    expect(session.getSnapshot().presetState).toBe('unavailable');
    expect(session.getSnapshot().hosted?.window).toBe(32000);
  });

  it('is signed-out after a 401 on the state route', async () => {
    const session = sessionOn(() => new Response(JSON.stringify({ success: false, error: 'Not authorized' }), { status: 401 }));
    await session.refresh();
    expect(session.getSnapshot().presetState).toBe('signed-out');
  });
});

describe('the window and capabilities from the hosted state', () => {
  it('budgets prompts to the window less the margin', () => {
    expect(hostedPromptWindow(parseHostedState(STATE))).toBe(31000);
    expect(hostedPromptWindow(parseHostedState({ ...STATE, window: null }))).toBeNull();
  });

  it('reads the capability record: Tools, dialect, budget and the known effort literals', () => {
    const record = hostedReasoningCapability(parseHostedState(STATE)?.model?.capabilities);
    expect(record).toMatchObject({ tools: true, dialect: 'openrouter', reasons: true, budget: true, levels: ['low', 'high'] });
  });

  it('reads the new model\'s record when the server switches models', async () => {
    let served: unknown = STATE;
    const session = sessionOn(() => ok(served)());
    await session.refresh();
    expect(session.getSnapshot().capability.tools).toBe(true);
    served = { ...STATE, model: { id: 'entry-3', capabilities: { tools: false, reasoning: null } } };
    await session.refresh();
    expect(session.getSnapshot().capability).toMatchObject({ tools: false, reasons: false });
  });

  it('reads a null dialect as a model that does not reason, and a missing field as unknown', () => {
    expect(hostedReasoningCapability({ tools: false, reasoning: null })).toMatchObject({ tools: false, reasons: false, levels: [], dialect: 'unknown' });
    expect(hostedReasoningCapability({})).toMatchObject({ tools: null, reasons: null, levels: null, budget: null });
  });
});
