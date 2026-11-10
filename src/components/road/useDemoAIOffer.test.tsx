import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { demoAITurnCount, engineTurnCount, isDemoAICardSeen, isEngineCardSeen, markDemoAICardSeen } from '@/lib/firstTimeFlowStore';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';
import { BUILTIN_ENGINE_PRESET_ID, DEFAULT_TEXT_PRESET_ID } from '@/lib/textEndpointPresets';
import type { VramClass } from '@/lib/vramClass';
import AuthService from '@/services/AuthService';
import { useCardTurnCounts, useDemoAIOfferAvailable, useDemoAIStoryCard, useEngineStoryCard, type CommittedTurn } from './useDemoAIOffer';

// The hosted build: the Default preset is the Demo AI.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

// The desktop shell's VRAM answer for the built-in engine's device.
const vram = vi.hoisted(() => ({ vramClass: 'low' as VramClass }));
vi.mock('@/lib/vramClass', async (orig) => ({
  ...(await orig<typeof import('@/lib/vramClass')>()),
  useVramClass: () => vram.vramClass,
}));

const STATE = {
  state: 'ready', window: 24000, maxTokens: 600, tokenMargin: 800,
  model: { id: 'entry-7', capabilities: {} },
  percentUsed: 32, turnsLeft: 41, resetAt: '2026-11-09T00:00:00.000Z', acknowledged: [], warnThresholds: [75, 90],
};

let settings: ReturnType<typeof useSettings>;
function Offer({ turnCount, settled }: { turnCount: number; settled: boolean }) {
  settings = useSettings();
  const available = useDemoAIOfferAvailable();
  const card = useDemoAIStoryCard({ turnCount, settled });
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

  it('offers nothing while the pledge is unconfirmed, even with no tier read', async () => {
    await readState({ ...STATE, tier: null, state: 'unconfirmed' });
    mount();
    expect(available()).toBe(false);
    expect(showing()).toBe(false);
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

describe('useDemoAIStoryCard', () => {
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

describe('useCardTurnCounts', () => {
  let counts: ReturnType<typeof useCardTurnCounts>;
  function Counts() {
    counts = useCardTurnCounts();
    return null;
  }
  const turn: CommittedTurn = { narrationIsDemoAI: true, narrationIsBuiltInEngine: false, isOpeningTurn: false, isNewTurn: true };

  it('counts a turn for the card whose AI narrated it, and only that card', () => {
    render(<Counts />);
    act(() => counts.countTurn(turn));
    act(() => counts.countTurn({ ...turn, narrationIsDemoAI: false, narrationIsBuiltInEngine: true }));
    act(() => counts.countTurn({ ...turn, narrationIsDemoAI: false, narrationIsBuiltInEngine: true }));
    expect([counts.demoAI, counts.engine]).toEqual([1, 2]);
    expect([demoAITurnCount(), engineTurnCount()]).toEqual([1, 2]);
  });

  it("stops one card's count at its own seen record and leaves the other counting", () => {
    markDemoAICardSeen();
    render(<Counts />);
    act(() => counts.countTurn({ ...turn, narrationIsBuiltInEngine: true }));
    expect([counts.demoAI, counts.engine]).toEqual([0, 1]);
  });

  it.each<[string, Partial<CommittedTurn>]>([
    ['the opening turn', { isOpeningTurn: true }],
    ['a regenerate', { isNewTurn: false }],
  ])('counts nothing for %s', (_, change) => {
    render(<Counts />);
    act(() => counts.countTurn({ ...turn, narrationIsBuiltInEngine: true, ...change }));
    expect([counts.demoAI, counts.engine]).toEqual([0, 0]);
  });
});

describe('useEngineStoryCard', () => {
  function EngineOffer({ turnCount, settled }: { turnCount: number; settled: boolean }) {
    settings = useSettings();
    const card = useEngineStoryCard({ turnCount, settled });
    const demo = useDemoAIStoryCard({ turnCount, settled });
    return (
      <>
        <span data-testid="showing">{String(card.showing)}</span>
        <span data-testid="demo-showing">{String(demo.showing)}</span>
        <button onClick={card.dismiss}>Dismiss</button>
      </>
    );
  }

  const mountEngine = (turnCount = 10, settled = true) => {
    const tree = (count: number, done: boolean) => <SettingsProvider><EngineOffer turnCount={count} settled={done} /></SettingsProvider>;
    const view = render(tree(turnCount, settled));
    act(() => settings.selectTextEndpointPreset(BUILTIN_ENGINE_PRESET_ID));
    return { ...view, update: (count: number, done: boolean) => view.rerender(tree(count, done)) };
  };
  const funnelPosts = (step: string) => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith(`/funnel/${step}`)).length;

  // The built-in engine preset exists only in the desktop build.
  beforeEach(() => {
    vram.vramClass = 'low';
    (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {};
  });
  afterEach(() => { delete (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop; });

  it('shows once at 10 settled turns, writes its own seen record and sends engine_offer_shown once', () => {
    const view = mountEngine(9, true);
    expect(settings.narrationIsBuiltInEngine).toBe(true);
    expect(showing()).toBe(false);
    view.update(10, false);
    expect(showing()).toBe(false);
    view.update(10, true);
    expect(showing()).toBe(true);
    expect(isEngineCardSeen()).toBe(true);
    expect(isDemoAICardSeen()).toBe(false);
    view.update(11, true);
    expect(funnelPosts('engine_offer_shown')).toBe(1);
    expect(funnelPosts('offer_shown')).toBe(0);
  });

  it.each(['ok', 'unknown'] as const)('never shows on the %s VRAM class', (vramClass) => {
    vram.vramClass = vramClass;
    mountEngine(30, true);
    expect(showing()).toBe(false);
    expect(isEngineCardSeen()).toBe(false);
  });

  it('is not blocked by the Demo AI card, and does not block it', () => {
    markDemoAICardSeen();
    mountEngine();
    expect(showing()).toBe(true);
    cleanup();
    localStorage.removeItem('FORMAMORPH_demoAICardSeen');
    render(<SettingsProvider><EngineOffer turnCount={5} settled /></SettingsProvider>);
    act(() => settings.selectTextEndpointPreset(DEFAULT_TEXT_PRESET_ID));
    expect(isEngineCardSeen()).toBe(true);
    expect(screen.getByTestId('demo-showing').textContent).toBe('true');
  });

  it('hides when narration moves off the built-in engine', () => {
    mountEngine();
    expect(showing()).toBe(true);
    act(() => settings.selectTextEndpointPreset(DEFAULT_TEXT_PRESET_ID));
    expect(settings.narrationIsBuiltInEngine).toBe(false);
    expect(showing()).toBe(false);
  });

  it('never comes back after a reload or in a later game', () => {
    const view = mountEngine();
    expect(showing()).toBe(true);
    view.unmount();
    mountEngine(20, true);
    expect(showing()).toBe(false);
  });
});
