import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

const info = vi.fn();
const warn = vi.fn();
vi.mock('react-toastify', () => ({ toast: { info: (...a: unknown[]) => info(...a), warn: (...a: unknown[]) => warn(...a) } }));
const openExternal = vi.fn();
vi.mock('@/lib/openExternal', () => ({ openExternal: (url: string) => openExternal(url) }));

import { HostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_STATE_URL, hostedAckUrl } from '@/lib/hostedAi/hostedUrls';
import { showHostedNotices } from './hostedNotices';

const BASE = {
  tier: 'supporter', state: 'ready', window: 32000, maxTokens: 900, tokenMargin: 1000,
  model: { id: 'm', capabilities: {} }, percentUsed: 10, turnsLeft: 50, resetAt: '2026-11-01T00:00:00.000Z', acknowledged: [] as number[],
};
const acks: string[] = [];

async function sessionAt() {
  const session = new HostedSession({
    credential: () => 't',
    fetchImpl: (async (url: string) => {
      if (url === HOSTED_STATE_URL) return new Response(JSON.stringify({ success: true, data: BASE }));
      acks.push(url);
      return new Response(JSON.stringify({ success: true, data: { acknowledged: [75] } }));
    }) as unknown as typeof fetch,
  });
  await session.refresh();
  return session;
}
const usage = (session: HostedSession, percentUsed: number) =>
  session.noteUsage({ percentUsed, turnsLeft: 5, resetAt: BASE.resetAt });
const body = (mock: typeof info): ReactNode => mock.mock.calls.at(-1)?.[0] as ReactNode;

beforeEach(() => { info.mockClear(); warn.mockClear(); openExternal.mockClear(); acks.length = 0; });

describe('the allowance notices after a turn commits', () => {
  it('shows the 75% notice once and acknowledges it on the server', async () => {
    const s = await sessionAt();
    usage(s, 76);
    showHostedNotices(() => {}, s);
    expect(info).toHaveBeenCalledTimes(1);
    expect(acks).toEqual([hostedAckUrl(75)]);
    // A later turn at the same level raises nothing.
    usage(s, 77);
    showHostedNotices(() => {}, s);
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('shows only the 90% notice when both lines were crossed in one turn', async () => {
    const s = await sessionAt();
    usage(s, 91);
    showHostedNotices(() => {}, s);
    expect(info).toHaveBeenCalledTimes(1);
    render(<>{body(info)}</>);
    expect(screen.getByText(/used 90%/)).toBeTruthy();
  });

  it('raises nothing below 75%', async () => {
    const s = await sessionAt();
    usage(s, 74);
    showHostedNotices(() => {}, s);
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('raises nothing for a turn that made no Formamorph AI call', async () => {
    const s = await sessionAt();
    usage(s, 95);
    showHostedNotices(() => {}, s);
    info.mockClear();
    showHostedNotices(() => {}, s);
    expect(info).not.toHaveBeenCalled();
  });

  it('shows the exhausted notice once, names the reset date, and switches back or upgrades on click', async () => {
    const s = await sessionAt();
    const switchBack = vi.fn();
    usage(s, 100);
    showHostedNotices(switchBack, s);
    expect(warn).toHaveBeenCalledTimes(1);
    render(<>{body(warn)}</>);
    expect(screen.getByText(/November 1/)).toBeTruthy();
    fireEvent.click(screen.getByText('Switch Back'));
    expect(switchBack).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Upgrade'));
    expect(openExternal).toHaveBeenCalledTimes(1);
    usage(s, 100);
    showHostedNotices(switchBack, s);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
