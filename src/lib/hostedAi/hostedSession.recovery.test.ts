import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostedSession } from './hostedSession';
import { HOSTED_STATE_URL } from './hostedUrls';

const RESET_AT = '2026-11-08T00:00:00.000Z';

const stateBody = (state: string) => ({
  success: true,
  data: {
    tier: 'supporter', state, window: 20000, maxTokens: 800, tokenMargin: 500,
    model: { id: 'entry-1', capabilities: { tools: true, reasoning: null } },
    percentUsed: state === 'exhausted' ? 100 : 10, turnsLeft: 90, resetAt: RESET_AT, acknowledged: [], warnThresholds: [75, 90],
  },
});

/** A session on a state route the test steers; `reads` counts the reads it answered. */
async function sessionOn(initial: string) {
  const route = { state: initial, reads: 0 };
  const fetchImpl = vi.fn(async (url: string) => {
    expect(url).toBe(HOSTED_STATE_URL);
    route.reads += 1;
    return new Response(JSON.stringify(stateBody(route.state)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  const account = { token: 'token-a' as string | null };
  const session = new HostedSession({ credential: () => account.token, fetchImpl });
  await session.refresh();
  return { session, route, account };
}

describe('the recovery timer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-11-05T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('reads the state when the reset passes, so the ring updates with no send', async () => {
    const { session, route } = await sessionOn('exhausted');
    const stop = session.watchRecovery();
    expect(session.getSnapshot().presetState).toBe('exhausted');

    route.state = 'ready';
    await vi.advanceTimersByTimeAsync(Date.parse(RESET_AT) - Date.now());

    expect(session.getSnapshot().presetState).toBe('ready');
    stop();
  });

  it('reads once at midnight UTC for a pause', async () => {
    const { session, route } = await sessionOn('paused');
    const stop = session.watchRecovery();
    const readsBefore = route.reads;

    route.state = 'ready';
    await vi.advanceTimersByTimeAsync(11 * 3600_000 + 1000);

    expect(route.reads).toBe(readsBefore);
    await vi.advanceTimersByTimeAsync(3600_000);
    expect(route.reads).toBe(readsBefore + 1);
    expect(session.getSnapshot().presetState).toBe('ready');
    stop();
  });

  it('does not loop when the state is still blocked after the reset', async () => {
    const { session, route } = await sessionOn('exhausted');
    const stop = session.watchRecovery();
    const readsBefore = route.reads;

    await vi.advanceTimersByTimeAsync(Date.parse(RESET_AT) - Date.now() + 1000);
    await vi.advanceTimersByTimeAsync(3600_000);

    expect(route.reads).toBe(readsBefore + 1);
    stop();
  });

  it('waits out the rest of the delay when the timer fires early', async () => {
    const { session, route } = await sessionOn('exhausted');
    const stop = session.watchRecovery();
    const readsBefore = route.reads;
    const wait = Date.parse(RESET_AT) - Date.now();

    // The first timer ends 5 s short, as a clamped delay does.
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() - 5000);
    await vi.advanceTimersByTimeAsync(wait);
    expect(route.reads).toBe(readsBefore);

    vi.mocked(Date.now).mockImplementation(realNow);
    route.state = 'ready';
    await vi.advanceTimersByTimeAsync(5000);
    expect(route.reads).toBe(readsBefore + 1);
    expect(session.getSnapshot().presetState).toBe('ready');
    stop();
  });

  it('reads at once for a new account that meets a block inside the throttle', async () => {
    const { session, account, route } = await sessionOn('exhausted');
    account.token = 'token-b';
    session.accountChanged();
    const readsBefore = route.reads;

    await session.rereadBlocked();

    expect(route.reads).toBe(readsBefore + 1);
  });

  it('arms no timer for a state that ends on no date', async () => {
    const { session, route } = await sessionOn('unconfirmed');
    const stop = session.watchRecovery();
    const readsBefore = route.reads;

    await vi.advanceTimersByTimeAsync(8 * 24 * 3600_000);

    expect(route.reads).toBe(readsBefore);
    stop();
  });

  it('leaks no timer after stop or sign-out', async () => {
    const stopped = await sessionOn('exhausted');
    stopped.session.watchRecovery()();
    expect(vi.getTimerCount()).toBe(0);

    const { session, account } = await sessionOn('exhausted');
    const stop = session.watchRecovery();
    expect(vi.getTimerCount()).toBe(1);
    account.token = null;
    session.accountChanged();
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });
});
