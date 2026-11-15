import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import {
  cardDue, countsAsCardTurn, engineCardDue, engineOfferAvailable, mentionsCardDue, mentionsOfferAvailable, offerAvailable,
} from '@/lib/firstTimeFlow';
import {
  demoAITurnCount, engineTurnCount, isDemoAICardSeen, isEngineCardSeen, isMentionsCardSeen, markDemoAICardSeen, markEngineCardSeen,
  markMentionsCardSeen, markMentionsOfferAccepted, mentionsTurnCount, recordDemoAITurn, recordEngineTurn, recordMentionsTurn,
} from '@/lib/firstTimeFlowStore';
import { sendFunnelStep, type FunnelStep } from '@/lib/funnel';
import type { HostedSnapshot } from '@/lib/hostedAi/hostedSession';
import { HOSTED_AI_AVAILABLE } from '@/lib/hostedAi/hostedUrls';
import { useCharacterMentionsState } from '@/lib/coref/characterMentionsApp';
import { useContributeAsk } from '@/lib/coref/useContributeAsk';
import { useContributeAccess } from '@/lib/coref/useContributeAccess';
import { isEnglishLanguage } from '@/lib/languages';
import { flairTier } from '@/lib/supporterFlair';
import { useVramClass } from '@/lib/vramClass';

/** A known tier or a preset state that holds a pledge. Anything else, an unread state included, counts as no pledge. */
export function isPledged({ hosted, presetState }: HostedSnapshot): boolean {
  return flairTier(hosted?.tier ? { tier: hosted.tier } : null) !== null
    || presetState === 'ready' || presetState === 'warned' || presetState === 'exhausted' || presetState === 'unconfirmed';
}

function useOfferFacts() {
  const { narrationIsDemoAI, hostedAi } = useSettings();
  return { onCardAI: narrationIsDemoAI, pledged: isPledged(hostedAi), hostedAvailable: HOSTED_AI_AVAILABLE };
}

export function useDemoAIOfferAvailable(): boolean {
  return offerAvailable(useOfferFacts());
}

export interface CommittedTurn {
  narrationIsDemoAI: boolean;
  narrationIsBuiltInEngine: boolean;
  isOpeningTurn: boolean;
  isNewTurn: boolean;
}

/** Every card's turn count, and one call that adds a committed turn to each card it counts for. */
export function useCardTurnCounts() {
  const [demoAI, setDemoAI] = useState(demoAITurnCount);
  const [engine, setEngine] = useState(engineTurnCount);
  const [mentions, setMentions] = useState(mentionsTurnCount);
  const countTurn = useCallback(({ narrationIsDemoAI, narrationIsBuiltInEngine, isOpeningTurn, isNewTurn }: CommittedTurn) => {
    const turn = { isOpeningTurn, isNewTurn };
    if (countsAsCardTurn({ ...turn, onCardAI: narrationIsDemoAI, cardSeen: isDemoAICardSeen() })) setDemoAI(recordDemoAITurn());
    if (countsAsCardTurn({ ...turn, onCardAI: narrationIsBuiltInEngine, cardSeen: isEngineCardSeen() })) setEngine(recordEngineTurn());
    // Character Mentions counts turns on any AI.
    if (countsAsCardTurn({ ...turn, onCardAI: true, cardSeen: isMentionsCardSeen() })) setMentions(recordMentionsTurn());
  }, []);
  return { demoAI, engine, mentions, countTurn };
}

interface CardTurn {
  turnCount: number;
  settled: boolean;
  /** Another card holds the one card slot; this card waits for a settled turn after it lets go. */
  yieldTo?: boolean;
}

interface EarnedCardInputs extends CardTurn {
  due: boolean;
  available: boolean;
  markSeen: () => void;
  /** The funnel step of the first show; none for a card outside the Formamorph AI funnel. */
  step?: FunnelStep;
}

/**
 * Shows the card once `due` holds on a settled turn, writing its seen record and funnel step on that first show.
 * A card that yields waits for a later turn than the last one it yielded on. `claimed` holds from the settled
 * turn the card is due while it shows, so another card can yield to it.
 */
function useEarnedCard({ due, available, turnCount, settled, yieldTo = false, markSeen, step }: EarnedCardInputs) {
  const [earned, setEarned] = useState(false);
  const [yieldedAt, setYieldedAt] = useState<number | null>(null);
  useEffect(() => {
    if (yieldTo) setYieldedAt(turnCount);
  }, [yieldTo, turnCount]);
  const dueNow = due && !yieldTo && yieldedAt !== turnCount;
  useEffect(() => {
    if (!settled || !dueNow) return;
    markSeen();
    if (step) sendFunnelStep(step);
    setEarned(true);
  }, [settled, dueNow, markSeen, step]);

  const dismiss = useCallback(() => setEarned(false), []);
  const showing = earned && available;
  return { showing, claimed: showing || (settled && dueNow), dismiss };
}

/**
 * Whether the Demo AI card shows in this game view. The first show writes the seen record, so a reload or a later
 * game never brings it back. `settled` holds the card until the turn on screen has finished.
 */
export function useDemoAIStoryCard(turn: CardTurn) {
  const facts = useOfferFacts();
  return useEarnedCard({
    ...turn,
    due: cardDue({ ...facts, turnCount: turn.turnCount, cardSeen: isDemoAICardSeen() }),
    available: offerAvailable(facts),
    markSeen: markDemoAICardSeen,
    step: 'demo_offer_shown',
  });
}

function useEngineOfferFacts() {
  const { narrationIsBuiltInEngine, hostedAi } = useSettings();
  const vramClass = useVramClass({ enabled: narrationIsBuiltInEngine });
  return { onCardAI: narrationIsBuiltInEngine, vramClass, pledged: isPledged(hostedAi), hostedAvailable: HOSTED_AI_AVAILABLE };
}

/** The built-in engine card, on the same terms as `useDemoAIStoryCard` with its own count and records. */
export function useEngineStoryCard(turn: CardTurn) {
  const facts = useEngineOfferFacts();
  return useEarnedCard({
    ...turn,
    due: engineCardDue({ ...facts, turnCount: turn.turnCount, cardSeen: isEngineCardSeen() }),
    available: engineOfferAvailable(facts),
    markSeen: markEngineCardSeen,
    step: 'engine_offer_shown',
  });
}

/** The Character Mentions card (Q52). After Turn On it stays to show the download until the model is ready. */
export function useMentionsStoryCard(turn: CardTurn) {
  const { characterMentions: enabled, setCharacterMentions, language, contributeCorrections, setContributeCorrections } = useSettings();
  const english = isEnglishLanguage(language);
  const { status } = useCharacterMentionsState();
  const [accepted, setAccepted] = useState(false);

  const card = useEarnedCard({
    ...turn,
    due: mentionsCardDue({ english, enabled, turnCount: turn.turnCount, cardSeen: isMentionsCardSeen() }),
    available: mentionsOfferAvailable({ english, enabled }) || accepted,
    markSeen: markMentionsCardSeen,
  });

  const accept = useCallback(() => {
    markMentionsOfferAccepted();
    setAccepted(true);
    setCharacterMentions(true);
  }, [setCharacterMentions]);

  // After Turn On, a signed-in, attested player is asked Contribute Corrections once (Q64).
  const ask = useContributeAsk(contributeCorrections, setContributeCorrections, useContributeAccess());
  const asking = accepted && ask.asks;
  const { answer } = ask;

  // Ready once answered, or turned off again in Settings, ends the download view.
  const finished = accepted && ((status === 'ready' && !asking) || !enabled || !english);
  return { showing: card.showing && !finished, accepted, accept, dismiss: card.dismiss, asking, answer };
}

/**
 * The game view's story cards, one on screen at a time. A Formamorph AI card due on the same turn as the Character
 * Mentions card wins it (Q52); otherwise the card on screen keeps the slot (Q55).
 */
export function useStoryCards({ turns, settled }: { turns: { demoAI: number; engine: number; mentions: number }; settled: boolean }) {
  // The mentions card's slot as of the last commit; it shows only on a turn neither other card claims.
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const demo = useDemoAIStoryCard({ turnCount: turns.demoAI, settled, yieldTo: mentionsOpen });
  const engine = useEngineStoryCard({ turnCount: turns.engine, settled, yieldTo: mentionsOpen });
  const mentions = useMentionsStoryCard({ turnCount: turns.mentions, settled, yieldTo: demo.claimed || engine.claimed });
  useEffect(() => setMentionsOpen(mentions.showing), [mentions.showing]);
  return { demo, engine, mentions };
}
