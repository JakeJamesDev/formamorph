import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { isDemoAICardSeen } from '@/lib/firstTimeFlowStore';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';
import { DEFAULT_TEXT_PRESET_ID } from '@/lib/textEndpointPresets';
import AuthService from '@/services/AuthService';
import { useDemoAIOfferAvailable, useStoryCard } from './useDemoAIOffer';

// The hosted build: the Default preset is the Demo AI.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

const STATE = {
  state: 'ready', window: 24000, maxTokens: 600, tokenMargin: 800,
  model: { id: 'entry-7', capabilities: {} },
  percentUsed: 32, turnsLeft: 41, resetAt: '2026-11-09T00:00:00.000Z', acknowledged: [], warnThresholds: [75, 90],
};

let settings: ReturnType<typeof useSettings>;
function Offer({ turnCount, settled }: { turnCount: number; settled: boolean }) {
  settings = useSettings();
  const available = useDemoAIOfferAvailable();
  const card = useStoryCard({ turnCount, settled });
  return (
    <>
      <span data-testid="available">{String(available)}</span>
      <span data-testid="showing">{String(card.showing)}</span>
      <button onClick={card.dismiss}>Dismiss</button>
    </>
  );
}

const mount = (turnCount = 5, settled = true) => {
  const tree = (count: number, done: boolean) => <SettingsProvider><Offer turnCount={count} settled={done} /></SettingsProvider>;
  const view = render(tree(turnCount, settled));
  return { ...view, update: (count: number, done: boolean) => view.rerender(tree(count, done)) };
};
const available = () => screen.getByTestId('available').textContent === 'true';
const showing = () => screen.getByTestId('showing').textContent === 'true';

/** Signs in, with the server answering `state` as the hosted state. */
async function readState(state: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => input === HOSTED_STATE_URL
    ? new Response(JSON.stringify({ success: true, data: state }))
    : new Response('{}', { status: 404 })));
  AuthService.token = 'token-a';
  hostedSession.reset();
  await hostedSession.refresh();
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline (test)'))));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  AuthService.token = null;
  hostedSession.reset();
});

describe('who counts as pledged', () => {
  it.each([
    ['a known tier in the ready state', { ...STATE, tier: 'supporter', state: 'ready' }],
    ['a known tier past its warning', { ...STATE, tier: 'supporter_plus', state: 'warned' }],
    ['a known tier out of allowance', { ...STATE, tier: 'supporter_top', state: 'exhausted' }],
    ['a known tier in a paused service', { ...STATE, tier: 'supporter', state: 'paused' }],
  ])('offers nothing to %s: no card, no seen record, and See Levels off', async (_, state) => {
    await readState(state);
    mount();
    expect(available()).toBe(false);
    expect(showing()).toBe(false);
    expect(isDemoAICardSeen()).toBe(false);
  });

  it('offers to a signed-in player with no pledge', async () => {
    await readState({ ...STATE, tier: null, state: 'locked' });
    mount();
    expect(available()).toBe(true);
    expect(showing()).toBe(true);
  });

  it('offers to a signed-out player', () => {
    mount();
    expect(available()).toBe(true);
    expect(showing()).toBe(true);
  });

  it('offers while the state is unread', () => {
    AuthService.token = 'token-a';
    hostedSession.reset();
    mount();
    expect(available()).toBe(true);
  });
});

describe('useStoryCard', () => {
  it('waits for the turn to settle, then writes the seen record', () => {
    const view = mount(5, false);
    expect(showing()).toBe(false);
    expect(isDemoAICardSeen()).toBe(false);
    view.update(5, true);
    expect(showing()).toBe(true);
    expect(isDemoAICardSeen()).toBe(true);
  });

  it('rises with the turn count while settled', () => {
    const view = mount(4, true);
    expect(showing()).toBe(false);
    view.update(5, true);
    expect(showing()).toBe(true);
  });

  it('stays through a later unsettled turn', () => {
    const view = mount();
    view.update(5, false);
    expect(showing()).toBe(true);
  });

  it('hides on a switch away from the Demo AI, and returns on a switch back in this view', () => {
    mount();
    let userId = '';
    act(() => { userId = settings.addTextEndpointPreset('My Server'); });
    act(() => settings.selectTextEndpointPreset(userId));
    expect(showing()).toBe(false);
    act(() => settings.selectTextEndpointPreset(DEFAULT_TEXT_PRESET_ID));
    expect(showing()).toBe(true);
  });

  it('stays dismissed for good', () => {
    const view = mount();
    act(() => screen.getByRole('button', { name: 'Dismiss' }).click());
    expect(showing()).toBe(false);
    view.update(6, true);
    expect(showing()).toBe(false);
    view.unmount();
    mount();
    expect(showing()).toBe(false);
  });
});
