// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostedSession } from './hostedSession';
import { hostedAckUrl, HOSTED_STATE_URL } from './hostedUrls';
import {
  formatResetDate, HOSTED_DEVICE_KEY, pendingWarning, readHostedDevice, shouldSwitchOnce, writeHostedDevice,
} from './hostedAllowance';
import { hostedStateCopy, hostedUsageCopy, hostedWarningText } from './hostedCopy';
import { parseHostedState, type HostedState } from './hostedState';

const BASE = {
  tier: 'supporter_plus', state: 'ready', window: 32000, maxTokens: 900, tokenMargin: 1000,
  model: { id: 'entry-2', capabilities: {} },
  percentUsed: 20, turnsLeft: 50, resetAt: '2026-11-01T00:00:00.000Z', acknowledged: [] as number[],
};
const hosted = (patch: Partial<typeof BASE> = {}): HostedState => parseHostedState({ ...BASE, ...patch }) as HostedState;

describe('pendingWarning', () => {
  it('names nothing below the first threshold', () => {
    expect(pendingWarning(hosted({ percentUsed: 74 }))).toBeNull();
  });

  it('names the highest crossed threshold, so one notice shows when both are crossed', () => {
    expect(pendingWarning(hosted({ percentUsed: 76 }))).toBe(75);
    expect(pendingWarning(hosted({ percentUsed: 93 }))).toBe(90);
  });

  it('skips a threshold the account acknowledged, and shows the next one up', () => {
    expect(pendingWarning(hosted({ percentUsed: 80, acknowledged: [75] }))).toBeNull();
    expect(pendingWarning(hosted({ percentUsed: 92, acknowledged: [75] }))).toBe(90);
  });

  it('skips a threshold already shown in this session', () => {
    expect(pendingWarning(hosted({ percentUsed: 80 }), new Set([75]))).toBeNull();
  });

  it('leaves the cap to the exhausted notice', () => {
    expect(pendingWarning(hosted({ percentUsed: 100 }))).toBeNull();
  });
});

describe('the one-time switch rule', () => {
  const fresh = { switched: false, previousPresetId: null };

  it('fires for a ready or warned account with a tier on a device that never switched', () => {
    expect(shouldSwitchOnce(hosted(), fresh)).toBe(true);
    expect(shouldSwitchOnce(hosted({ state: 'warned' }), fresh)).toBe(true);
  });

  it('waits while the allowance is spent, and stays unset', () => {
    expect(shouldSwitchOnce(hosted({ state: 'exhausted' }), fresh)).toBe(false);
  });

  it('never fires without a tier or in a state that cannot run', () => {
    expect(shouldSwitchOnce(hosted({ tier: null as never }), fresh)).toBe(false);
    expect(shouldSwitchOnce(hosted({ state: 'locked' }), fresh)).toBe(false);
    expect(shouldSwitchOnce(hosted({ state: 'paused' }), fresh)).toBe(false);
  });

  it('never fires twice on a device', () => {
    expect(shouldSwitchOnce(hosted(), { switched: true, previousPresetId: 'mine' })).toBe(false);
  });
});

describe('the device record', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips through storage', () => {
    writeHostedDevice({ switched: true, previousPresetId: 'mine' });
    expect(readHostedDevice()).toEqual({ switched: true, previousPresetId: 'mine' });
  });

  it('reads a corrupt record as never switched', () => {
    localStorage.setItem(HOSTED_DEVICE_KEY, '{nope');
    expect(readHostedDevice()).toEqual({ switched: false, previousPresetId: null });
  });
});

describe('allowance copy', () => {
  it('names the reset date in UTC', () => {
    expect(formatResetDate('2026-11-01T00:00:00.000Z')).toBe('November 1');
    expect(formatResetDate('garbage')).toBeNull();
  });

  it('labels turns left as "about" and shows the tier, percent and date', () => {
    const copy = hostedUsageCopy(hosted({ percentUsed: 32.4, turnsLeft: 41.9 }), 'Supporter+');
    expect(copy).toEqual({ tier: 'Supporter+', used: '32% used', turnsLeft: 'About 41 turns left', resets: 'Resets November 1' });
  });

  it('shows nothing before usage is known', () => {
    expect(hostedUsageCopy(hosted({ percentUsed: null as never }), 'Supporter')).toBeNull();
  });

  it('puts the reset date in the exhausted reason, with a switch back and an upgrade', () => {
    const copy = hostedStateCopy('exhausted', '2026-11-01T00:00:00.000Z');
    expect(copy?.reason).toContain('November 1');
    expect(copy?.action?.kind).toBe('switchBack');
    expect(copy?.extra?.kind).toBe('patreon');
  });

  it('writes the threshold notice with the reset date', () => {
    expect(hostedWarningText(75, hosted())).toBe("You've used 75% of this month's Formamorph AI allowance. It resets on November 1.");
  });
});

describe('acknowledging a warning', () => {
  const acks: string[] = [];
  let serverAcked: number[];
  let ackStatus = 200;

  const session = () => new HostedSession({
    credential: () => 't',
    fetchImpl: (async (url: string, init?: RequestInit) => {
      if (url === HOSTED_STATE_URL) return new Response(JSON.stringify({ success: true, data: { ...BASE, percentUsed: 92, acknowledged: serverAcked } }));
      acks.push(`${init?.method} ${url}`);
      if (ackStatus !== 200) return new Response(JSON.stringify({ success: false }), { status: ackStatus });
      const threshold = Number(url.split('/').at(-2));
      serverAcked = [...serverAcked, threshold];
      return new Response(JSON.stringify({ success: true, data: { acknowledged: serverAcked } }));
    }) as unknown as typeof fetch,
  });

  beforeEach(() => { acks.length = 0; serverAcked = []; ackStatus = 200; });
  afterEach(() => vi.restoreAllMocks());

  it('posts the shown threshold and every lower one, then holds the server list', async () => {
    const s = session();
    await s.refresh();
    await s.acknowledgeWarning(90);
    expect(acks).toEqual([`POST ${hostedAckUrl(75)}`, `POST ${hostedAckUrl(90)}`]);
    expect(s.getSnapshot().hosted?.acknowledged).toEqual([75, 90]);
    expect(pendingWarning(s.getSnapshot().hosted)).toBeNull();
  });

  it('keeps the warning hidden for the session when the server refuses the ack', async () => {
    const s = session();
    await s.refresh();
    ackStatus = 400;
    await s.acknowledgeWarning(90);
    expect(pendingWarning(s.getSnapshot().hosted, s.shownWarnings())).toBeNull();
  });

  it('shows a notice again to the next account on the same session', async () => {
    const account = { token: 'a' as string | null };
    const s = new HostedSession({
      credential: () => account.token,
      fetchImpl: (async () => new Response(JSON.stringify({ success: true, data: { ...BASE, percentUsed: 80, acknowledged: [] } }))) as unknown as typeof fetch,
    });
    await s.refresh();
    await s.acknowledgeWarning(75);
    expect(s.shownWarnings().has(75)).toBe(true);
    account.token = 'b';
    s.getSnapshot();
    expect(s.shownWarnings().has(75)).toBe(false);
    expect(s.claimExhaustedNotice()).toBe(true);
  });

  it('moves a spent meter to exhausted only when the turn settles, not on the usage event', async () => {
    const s = session();
    await s.refresh();
    s.noteUsage({ percentUsed: 100, turnsLeft: 0, resetAt: BASE.resetAt });
    expect(s.getSnapshot().presetState).toBe('ready');
    s.settleTurn();
    expect(s.getSnapshot().presetState).toBe('exhausted');
  });
});
