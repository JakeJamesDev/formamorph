/**
 * What the First-Time Flow shows next, answered from plain facts. Callers read the facts and render the answer.
 */

import type { VramClass } from '@/lib/vramClass';

/** Player actions on the Demo AI before the card is due. */
const DEMO_AI_CARD_TURNS = 5;

export interface FirstRunFacts {
  /** The intro-seen record existed when the app launched, so a replay or the intro's own end can't change this. */
  introSeenAtLaunch: boolean;
  firstRunStepSeen: boolean;
}

export function firstRunStepDue({ introSeenAtLaunch, firstRunStepSeen }: FirstRunFacts): boolean {
  return !introSeenAtLaunch && !firstRunStepSeen;
}

export interface EntryLineFacts {
  narrationIsDemoAI: boolean;
  demoAISeen: boolean;
  /** The AI setup gate is due on this entry; null while reachability is unknown. */
  aiGateDue: boolean | null;
}

/** The line waits for the gate, and a gate that takes the entry leaves it for the next one. */
export function entryLineDue({ narrationIsDemoAI, demoAISeen, aiGateDue }: EntryLineFacts): boolean {
  return narrationIsDemoAI && !demoAISeen && aiGateDue === false;
}

/** Player actions on the built-in engine before its card is due. */
const ENGINE_CARD_TURNS = 10;

/** A committed turn as one card sees it. Each card has its own count and seen record. */
export interface CardTurnFacts {
  /** Narration runs on the AI this card offers an upgrade from: the Demo AI or the built-in engine. */
  onCardAI: boolean;
  isOpeningTurn: boolean;
  /** The commit adds a turn; false for a regenerate, which replaces one, and a canned test turn. */
  isNewTurn: boolean;
  cardSeen: boolean;
}

/** Whether a committed turn adds to a card's count: only one that follows a player action. The offer gates the card, not the count. */
export function countsAsCardTurn({ onCardAI, isOpeningTurn, isNewTurn, cardSeen }: CardTurnFacts): boolean {
  return onCardAI && !isOpeningTurn && isNewTurn && !cardSeen;
}

export interface OfferFacts {
  /** Narration runs on the AI this offer upgrades from: the Demo AI or the built-in engine. */
  onCardAI: boolean;
  /** The player's pledge already includes Formamorph AI. */
  pledged: boolean;
  /** This build has a hosted URL and community accounts. */
  hostedAvailable: boolean;
}

/** Whether this player can be offered the levels: a card, and on the Demo AI also See Levels in its longer dialog. */
export function offerAvailable({ onCardAI, pledged, hostedAvailable }: OfferFacts): boolean {
  return onCardAI && hostedAvailable && !pledged;
}

export interface EngineOfferFacts extends OfferFacts {
  vramClass: VramClass;
}

export function engineOfferAvailable({ vramClass, ...offer }: EngineOfferFacts): boolean {
  return offerAvailable(offer) && vramClass === 'low';
}

interface CardProgress {
  turnCount: number;
  cardSeen: boolean;
}

export type CardFacts = OfferFacts & CardProgress;
export type EngineCardFacts = EngineOfferFacts & CardProgress;

const earned = (available: boolean, { turnCount, cardSeen }: CardProgress, dueTurns: number): boolean =>
  available && !cardSeen && turnCount >= dueTurns;

export function cardDue(facts: CardFacts): boolean {
  return earned(offerAvailable(facts), facts, DEMO_AI_CARD_TURNS);
}

export function engineCardDue(facts: EngineCardFacts): boolean {
  return earned(engineOfferAvailable(facts), facts, ENGINE_CARD_TURNS);
}

export interface AiSetupFacts {
  vramClass: VramClass;
  hostedAvailable: boolean;
  /** The player's pledge already includes Formamorph AI. */
  pledged: boolean;
}

export function aiSetupLeadsWithHostedAi({ vramClass, hostedAvailable, pledged }: AiSetupFacts): boolean {
  return hostedAvailable && !pledged && vramClass === 'low';
}
