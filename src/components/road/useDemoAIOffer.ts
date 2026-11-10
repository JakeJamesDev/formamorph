import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { cardDue, countsAsCardTurn, engineCardDue, engineOfferAvailable, offerAvailable } from '@/lib/firstTimeFlow';
import {
  demoAITurnCount, engineTurnCount, isDemoAICardSeen, isEngineCardSeen, markDemoAICardSeen, markEngineCardSeen, recordDemoAITurn,
  recordEngineTurn,
} from '@/lib/firstTimeFlowStore';
import { sendFunnelStep, type FunnelStep } from '@/lib/funnel';
import type { HostedSnapshot } from '@/lib/hostedAi/hostedSession';
import { HOSTED_AI_AVAILABLE } from '@/lib/hostedAi/hostedUrls';
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

/** Both cards' turn counts, and one call that adds a committed turn to each card it counts for. */
export function useCardTurnCounts() {
  const [demoAI, setDemoAI] = useState(demoAITurnCount);
  const [engine, setEngine] = useState(engineTurnCount);
  const countTurn = useCallback(({ narrationIsDemoAI, narrationIsBuiltInEngine, isOpeningTurn, isNewTurn }: CommittedTurn) => {
    const turn = { isOpeningTurn, isNewTurn };
    if (countsAsCardTurn({ ...turn, onCardAI: narrationIsDemoAI, cardSeen: isDemoAICardSeen() })) setDemoAI(recordDemoAITurn());
    if (countsAsCardTurn({ ...turn, onCardAI: narrationIsBuiltInEngine, cardSeen: isEngineCardSeen() })) setEngine(recordEngineTurn());
  }, []);
  return { demoAI, engine, countTurn };
}

interface EarnedCardInputs {
  due: boolean;
  available: boolean;
  settled: boolean;
  markSeen: () => void;
  step: FunnelStep;
}

/** Shows the card once `due` holds on a settled turn, writing its seen record and funnel step on that first show. */
function useEarnedCard({ due, available, settled, markSeen, step }: EarnedCardInputs) {
  const [earned, setEarned] = useState(false);
  useEffect(() => {
    if (!settled || !due) return;
    markSeen();
    sendFunnelStep(step);
    setEarned(true);
  }, [settled, due, markSeen, step]);

  const dismiss = useCallback(() => setEarned(false), []);
  return { showing: earned && available, dismiss };
}

/**
 * Whether the Demo AI card shows in this game view. The first show writes the seen record, so a reload or a later
 * game never brings it back. `settled` holds the card until the turn on screen has finished.
 */
export function useDemoAIStoryCard({ turnCount, settled }: { turnCount: number; settled: boolean }) {
  const facts = useOfferFacts();
  return useEarnedCard({
    due: cardDue({ ...facts, turnCount, cardSeen: isDemoAICardSeen() }),
    available: offerAvailable(facts),
    settled,
    markSeen: markDemoAICardSeen,
    step: 'offer_shown',
  });
}

function useEngineOfferFacts() {
  const { narrationIsBuiltInEngine, hostedAi } = useSettings();
  const vramClass = useVramClass({ enabled: narrationIsBuiltInEngine });
  return { onCardAI: narrationIsBuiltInEngine, vramClass, pledged: isPledged(hostedAi), hostedAvailable: HOSTED_AI_AVAILABLE };
}

/** The built-in engine card, on the same terms as `useDemoAIStoryCard` with its own count and records. */
export function useEngineStoryCard({ turnCount, settled }: { turnCount: number; settled: boolean }) {
  const facts = useEngineOfferFacts();
  return useEarnedCard({
    due: engineCardDue({ ...facts, turnCount, cardSeen: isEngineCardSeen() }),
    available: engineOfferAvailable(facts),
    settled,
    markSeen: markEngineCardSeen,
    step: 'engine_offer_shown',
  });
}
