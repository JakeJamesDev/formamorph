import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { cardDue, offerAvailable } from '@/lib/firstTimeFlow';
import { isDemoAICardSeen, markDemoAICardSeen } from '@/lib/firstTimeFlowStore';
import type { HostedSnapshot } from '@/lib/hostedAi/hostedSession';
import { HOSTED_AI_AVAILABLE } from '@/lib/hostedAi/hostedUrls';
import { flairTier } from '@/lib/supporterFlair';

/** A known tier or a usable preset state. Anything else, an unread state included, counts as no pledge. */
function isPledged({ hosted, presetState }: HostedSnapshot): boolean {
  return flairTier(hosted?.tier ? { tier: hosted.tier } : null) !== null
    || presetState === 'ready' || presetState === 'warned' || presetState === 'exhausted';
}

function useOfferFacts() {
  const { narrationIsDemoAI, hostedAi } = useSettings();
  return { narrationIsDemoAI, pledged: isPledged(hostedAi), hostedAvailable: HOSTED_AI_AVAILABLE };
}

export function useDemoAIOfferAvailable(): boolean {
  return offerAvailable(useOfferFacts());
}

/**
 * Whether the card shows in this game view. The first show writes the seen record, so a reload or a later game
 * never brings it back. `settled` holds the card until the turn on screen has finished.
 */
export function useStoryCard({ turnCount, settled }: { turnCount: number; settled: boolean }) {
  const facts = useOfferFacts();
  const { narrationIsDemoAI, pledged, hostedAvailable } = facts;
  const [earned, setEarned] = useState(false);

  useEffect(() => {
    if (!settled) return;
    if (cardDue({ narrationIsDemoAI, pledged, hostedAvailable, demoAITurnCount: turnCount, cardSeen: isDemoAICardSeen() })) {
      markDemoAICardSeen();
      setEarned(true);
    }
  }, [settled, turnCount, narrationIsDemoAI, pledged, hostedAvailable]);

  const dismiss = useCallback(() => setEarned(false), []);
  return { showing: earned && offerAvailable(facts), dismiss };
}
