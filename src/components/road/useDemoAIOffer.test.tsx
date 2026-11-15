import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import type { CharacterMentionsState } from '@/lib/coref/characterMentions';
import type { Contributor } from '@/lib/coref/correctionContribution';
import {
  demoAITurnCount, engineTurnCount, isContributeAsked, isDemoAICardSeen, markContributeAsked, isEngineCardSeen, isMentionsCardSeen, isMentionsOfferAccepted, markDemoAICardSeen,
  markEngineCardSeen, markMentionsCardSeen, mentionsTurnCount,
} from '@/lib/firstTimeFlowStore';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';
import { BUILTIN_ENGINE_PRESET_ID, DEFAULT_TEXT_PRESET_ID } from '@/lib/textEndpointPresets';
import type { VramClass } from '@/lib/vramClass';
import AuthService from '@/services/AuthService';
import { funnelPosts } from '@/test/funnelPosts';
import {
  useCardTurnCounts, useDemoAIOfferAvailable, useDemoAIStoryCard, useEngineStoryCard, useMentionsStoryCard, useStoryCards,
  type CommittedTurn,
} from './useDemoAIOffer';

// The hosted build: the Default preset is the Demo AI.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

// The desktop shell's VRAM answer for the built-in engine's device.
const vram = vi.hoisted(() => ({ vramClass: 'low' as VramClass }));
vi.mock('@/lib/vramClass', async (orig) => ({
  ...(await orig<typeof import('@/lib/vramClass')>()),
  useVramClass: () => vram.vramClass,
}));

// The Character Mentions controller's state; the download itself is `characterMentions.test.ts`'s concern.
const mentions = vi.hoisted(() => ({ state: null as CharacterMentionsState | null }));
vi.mock('@/lib/coref/characterMentionsApp', () => ({
  useCharacterMentionsState: () => mentions.state ?? { status: 'off', progress: null, error: null, model: null, version: null },
}));

// Who may contribute corrections at this device.
const viewer = vi.hoisted(() => ({ contributor: { access: 'signedOut', accountId: null } as Contributor }));
vi.mock('@/lib/coref/useContributeAccess', () => ({ useContributeAccess: () => viewer.contributor }));

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
  mentions.state = null;
  viewer.contributor = { access: 'signedOut', accountId: null };
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
  it('waits for the turn to settle, then writes the seen record and sends demo_offer_shown once', () => {
    const view = mount(5, false);
    expect(showing()).toBe(false);
    expect(isDemoAICardSeen()).toBe(false);
    view.update(5, true);
    expect(showing()).toBe(true);
    expect(isDemoAICardSeen()).toBe(true);
    view.update(6, true);
    expect(funnelPosts()).toEqual(['demo_offer_shown']);
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

  it("stops the engine card's count at its own seen record and leaves the Demo AI card counting", () => {
    markEngineCardSeen();
    render(<Counts />);
    act(() => counts.countTurn({ ...turn, narrationIsBuiltInEngine: true }));
    expect([counts.demoAI, counts.engine]).toEqual([1, 0]);
  });

  it.each<[string, Partial<CommittedTurn>]>([
    ['the opening turn', { isOpeningTurn: true }],
    ['a regenerate', { isNewTurn: false }],
  ])('counts nothing for %s', (_, change) => {
    render(<Counts />);
    act(() => counts.countTurn({ ...turn, narrationIsBuiltInEngine: true, ...change }));
    expect([counts.demoAI, counts.engine, counts.mentions]).toEqual([0, 0, 0]);
  });

  it('counts every new turn for the Character Mentions card, on any AI, until its card is seen', () => {
    render(<Counts />);
    act(() => counts.countTurn({ ...turn, narrationIsDemoAI: false }));
    act(() => counts.countTurn(turn));
    expect([counts.mentions, mentionsTurnCount()]).toEqual([2, 2]);
    markMentionsCardSeen();
    act(() => counts.countTurn(turn));
    expect(counts.mentions).toBe(2);
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
    expect(funnelPosts()).toEqual(['engine_offer_shown']);
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

describe('useMentionsStoryCard', () => {
  let card: ReturnType<typeof useMentionsStoryCard>;
  function MentionsOffer({ turnCount, settled, yieldTo }: { turnCount: number; settled: boolean; yieldTo: boolean }) {
    settings = useSettings();
    card = useMentionsStoryCard({ turnCount, settled, yieldTo });
    return <span data-testid="showing">{String(card.showing)}</span>;
  }
  const mountMentions = (turnCount = 3, settled = true, yieldTo = false) => {
    const tree = (count: number, done: boolean, other: boolean) => (
      <SettingsProvider><MentionsOffer turnCount={count} settled={done} yieldTo={other} /></SettingsProvider>
    );
    const view = render(tree(turnCount, settled, yieldTo));
    return { ...view, update: (count: number, done: boolean, other = false) => view.rerender(tree(count, done, other)) };
  };
  const download = (status: CharacterMentionsState['status']) => {
    mentions.state = { status, progress: null, error: null, model: null, version: null };
  };

  it('shows once at 3 settled turns, writes its seen record, and sends no funnel step', () => {
    const view = mountMentions(2, true);
    expect(showing()).toBe(false);
    view.update(3, false);
    expect(showing()).toBe(false);
    view.update(3, true);
    expect(showing()).toBe(true);
    expect(isMentionsCardSeen()).toBe(true);
    expect(funnelPosts()).toEqual([]);
  });

  it('never shows again after Not Now, in this view or a later one', () => {
    const view = mountMentions();
    act(() => card.dismiss());
    expect(showing()).toBe(false);
    view.update(4, true);
    expect(showing()).toBe(false);
    view.unmount();
    mountMentions(9, true);
    expect(showing()).toBe(false);
  });

  it('never shows for an AI Language other than English', () => {
    const view = mountMentions(2, true);
    act(() => settings.setLanguage('French'));
    view.update(5, true);
    expect(showing()).toBe(false);
    expect(isMentionsCardSeen()).toBe(false);
  });

  it('never shows when Character Mentions is already on', () => {
    const view = mountMentions(2, true);
    act(() => settings.setCharacterMentions(true));
    view.update(5, true);
    expect(showing()).toBe(false);
    expect(isMentionsCardSeen()).toBe(false);
  });

  it('yields to a Formamorph AI card on its turn and shows on the next settled turn', () => {
    const view = mountMentions(3, true, true);
    expect(showing()).toBe(false);
    expect(isMentionsCardSeen()).toBe(false);
    // The other card's Not Now leaves this turn to it.
    view.update(3, true, false);
    expect(showing()).toBe(false);
    view.update(4, true, false);
    expect(showing()).toBe(true);
  });

  it('Turn On turns the setting on, records the accept, shows the download, and closes once the model is ready', () => {
    const view = mountMentions();
    act(() => card.accept());
    expect(settings.characterMentions).toBe(true);
    expect(isMentionsOfferAccepted()).toBe(true);
    expect([showing(), card.accepted]).toEqual([true, true]);
    download('downloading');
    view.update(3, true);
    expect(showing()).toBe(true);
    download('ready');
    view.update(3, true);
    expect(showing()).toBe(false);
    expect(funnelPosts()).toEqual([]);
  });

  it('closes after Turn On when Character Mentions is turned off again in Settings', () => {
    mountMentions();
    act(() => card.accept());
    download('downloading');
    act(() => settings.setCharacterMentions(false));
    expect(showing()).toBe(false);
  });

  describe('the ask-once question (Q64)', () => {
    const readyAfterTurnOn = () => {
      const view = mountMentions();
      expect(card.asking).toBe(false);
      act(() => card.accept());
      download('ready');
      view.update(3, true);
      return view;
    };

    it('asks a signed-in, attested player after Turn On and stays open past ready until a yes opts in', () => {
      viewer.contributor = { access: 'ready', accountId: 'acct-a' };
      readyAfterTurnOn();
      expect([card.asking, showing()]).toEqual([true, true]);
      expect(settings.contributeCorrections).toBeNull();
      act(() => { card.answer(true); });
      expect(settings.contributeCorrections).toBe('acct-a');
      expect(isContributeAsked('acct-a')).toBe(true);
      expect([card.asking, showing()]).toEqual([false, false]);
      expect(funnelPosts()).toEqual([]);
    });

    it('a no records the answer and leaves the opt-in off', () => {
      viewer.contributor = { access: 'ready', accountId: 'acct-a' };
      readyAfterTurnOn();
      act(() => { card.answer(false); });
      expect(settings.contributeCorrections).toBeNull();
      expect(isContributeAsked('acct-a')).toBe(true);
      expect(showing()).toBe(false);
    });

    it('never asks an account that already answered', () => {
      viewer.contributor = { access: 'ready', accountId: 'acct-a' };
      markContributeAsked('acct-a');
      readyAfterTurnOn();
      expect([card.asking, showing()]).toEqual([false, false]);
    });

    it('never asks a player who is signed out or not attested, and closes at ready', () => {
      for (const contributor of [{ access: 'signedOut', accountId: null }, { access: 'unattested', accountId: 'acct-a' }] as Contributor[]) {
        localStorage.clear();
        viewer.contributor = contributor;
        const view = readyAfterTurnOn();
        expect([card.asking, showing()]).toEqual([false, false]);
        expect(isContributeAsked('acct-a')).toBe(false);
        view.unmount();
      }
    });
  });
});

describe('useStoryCards', () => {
  let cards: ReturnType<typeof useStoryCards>;
  function Cards({ demoAI, mentions, settled }: { demoAI: number; mentions: number; settled: boolean }) {
    settings = useSettings();
    cards = useStoryCards({ turns: { demoAI, engine: 0, mentions }, settled });
    return null;
  }
  const mountCards = (demoAI: number, mentionsTurns: number) => {
    const tree = (d: number, m: number) => <SettingsProvider><Cards demoAI={d} mentions={m} settled /></SettingsProvider>;
    const view = render(tree(demoAI, mentionsTurns));
    return { update: (d: number, m: number) => view.rerender(tree(d, m)) };
  };
  const onScreen = () => [cards.demo.showing, cards.mentions.showing];

  it('gives a turn both cards are due on to the Formamorph AI card, and the mentions card the next turn after it', () => {
    const view = mountCards(5, 5);
    expect(onScreen()).toEqual([true, false]);
    expect(isMentionsCardSeen()).toBe(false);
    act(() => cards.demo.dismiss());
    expect(onScreen()).toEqual([false, false]);
    view.update(6, 6);
    expect(onScreen()).toEqual([false, true]);
  });

  it('keeps the slot for an open mentions card: a Formamorph AI card due later waits for the turn after it closes', () => {
    const view = mountCards(3, 3);
    expect(onScreen()).toEqual([false, true]);
    view.update(5, 5);
    expect(onScreen()).toEqual([false, true]);
    expect(isDemoAICardSeen()).toBe(false);
    expect(funnelPosts()).toEqual([]);
    act(() => cards.mentions.dismiss());
    expect(onScreen()).toEqual([false, false]);
    view.update(6, 6);
    expect(onScreen()).toEqual([true, false]);
    expect(funnelPosts()).toEqual(['demo_offer_shown']);
  });
});
