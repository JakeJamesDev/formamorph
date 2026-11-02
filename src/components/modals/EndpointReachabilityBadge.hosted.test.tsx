import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { HostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_CHAT_URL, HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';
import { EndpointReachabilityBadge, HostedReachabilityBadge } from './EndpointReachabilityBadge';

const live = vi.hoisted(() => ({ session: null as unknown }));

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => {
    const session = live.session as HostedSession;
    const hostedAi = useSyncExternalStore(session.subscribe, session.getSnapshot);
    return { hostedAi, refreshHostedState: () => session.refresh() };
  },
}));

const READY = { success: true, data: { tier: 'supporter', state: 'ready', window: 32000, percentUsed: 10 } };
const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** A session whose reads answer from `reply`, with every requested URL in `urls`. */
function sessionWith(reply: () => Response | Promise<Response>, token: string | null = 't') {
  const urls: string[] = [];
  const session = new HostedSession({
    credential: () => token,
    fetchImpl: (async (url: string) => { urls.push(url); return reply(); }) as unknown as typeof fetch,
  });
  live.session = session;
  return { session, urls };
}

afterEach(() => { live.session = null; });

describe('HostedReachabilityBadge', () => {
  it('reads the hosted state once and shows Checking, then Reachable', async () => {
    const { urls } = sessionWith(() => answer(200, READY));
    render(<HostedReachabilityBadge />);
    expect(screen.getByText('Checking…')).toBeInTheDocument();
    expect(await screen.findByText('Reachable')).toBeInTheDocument();
    expect(urls).toEqual([HOSTED_STATE_URL]);
  });

  it('reads as Reachable when the server refuses, since the server answered', async () => {
    sessionWith(() => answer(403, { code: 'not_entitled', error: 'No' }));
    render(<HostedReachabilityBadge />);
    expect(await screen.findByText('Reachable')).toBeInTheDocument();
  });

  it("shows Didn't answer on a failed read, and Recheck reads again", async () => {
    let up = false;
    const { urls } = sessionWith(() => {
      if (!up) throw new TypeError('Failed to fetch');
      return answer(200, READY);
    });
    render(<HostedReachabilityBadge />);
    expect(await screen.findByText("Didn't answer")).toBeInTheDocument();

    up = true;
    fireEvent.click(screen.getByRole('button', { name: 'Recheck' }));
    expect(await screen.findByText('Reachable')).toBeInTheDocument();
    expect(urls).toEqual([HOSTED_STATE_URL, HOSTED_STATE_URL]);
  });

  it('sends nothing while signed out', async () => {
    const { urls } = sessionWith(() => answer(200, READY), null);
    render(<HostedReachabilityBadge />);
    expect(await screen.findByText('Not checked')).toBeInTheDocument();
    expect(urls).toEqual([]);
  });

  it('reuses a read this session already made', async () => {
    const { session, urls } = sessionWith(() => answer(200, READY));
    await session.refresh();
    render(<HostedReachabilityBadge />);
    expect(screen.getByText('Reachable')).toBeInTheDocument();
    expect(urls).toHaveLength(1);
  });

  it('draws an overriding state without a read', () => {
    const { urls } = sessionWith(() => answer(200, READY));
    render(<HostedReachabilityBadge state="unavailable" />);
    expect(screen.getByText("Didn't answer")).toBeInTheDocument();
    expect(urls).toEqual([]);
  });
});

describe('EndpointReachabilityBadge on Formamorph AI', () => {
  const target = { url: HOSTED_CHAT_URL, apiToken: '', model: '', enabled: true };

  it('reads the hosted state and never lists models', async () => {
    const { urls } = sessionWith(() => answer(200, READY));
    render(<EndpointReachabilityBadge target={target} />);
    expect(await screen.findByText('Reachable')).toBeInTheDocument();
    expect(urls).toEqual([HOSTED_STATE_URL]);
  });

  it('draws nothing and reads nothing for a disabled target', () => {
    const { urls } = sessionWith(() => answer(200, READY));
    const { container } = render(<EndpointReachabilityBadge target={{ ...target, enabled: false }} />);
    expect(container).toBeEmptyDOMElement();
    expect(urls).toEqual([]);
  });
});
