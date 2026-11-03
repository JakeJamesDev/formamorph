/**
 * What the First-Time Flow shows next, answered from plain facts. Callers read the facts and render the answer.
 */

/** Player actions on the Demo AI before the card is due. */
const DEMO_AI_CARD_TURNS = 5;

/** The largest reported VRAM total, in MB, that counts as 8 GB. */
const LOW_VRAM_LIMIT_MB = 8500;

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

export interface DemoAITurnFacts {
  narrationIsDemoAI: boolean;
  isOpeningTurn: boolean;
  /** The commit adds a turn; false for a regenerate, which replaces one, and a canned test turn. */
  isNewTurn: boolean;
  cardSeen: boolean;
}

/** Whether a committed turn adds to the Demo AI count: only one that follows a player action. */
export function countsAsDemoAITurn({ narrationIsDemoAI, isOpeningTurn, isNewTurn, cardSeen }: DemoAITurnFacts): boolean {
  return narrationIsDemoAI && !isOpeningTurn && isNewTurn && !cardSeen;
}

export interface OfferFacts {
  narrationIsDemoAI: boolean;
  /** The player's pledge already includes Formamorph AI. */
  pledged: boolean;
  /** This build has a hosted URL and community accounts. */
  hostedAvailable: boolean;
}

/** Whether this player can be offered the levels: the card, and See Levels in the longer Demo AI dialog. */
export function offerAvailable({ narrationIsDemoAI, pledged, hostedAvailable }: OfferFacts): boolean {
  return narrationIsDemoAI && hostedAvailable && !pledged;
}

export interface CardFacts extends OfferFacts {
  demoAITurnCount: number;
  cardSeen: boolean;
}

export function cardDue({ demoAITurnCount, cardSeen, ...offer }: CardFacts): boolean {
  return offerAvailable(offer) && !cardSeen && demoAITurnCount >= DEMO_AI_CARD_TURNS;
}

export interface AiSetupFacts {
  /** The reported total in MB; null when VRAM is unknown, as in a browser. */
  totalVramMb: number | null;
  hostedAvailable: boolean;
}

export function aiSetupLeadsWithHostedAi({ totalVramMb, hostedAvailable }: AiSetupFacts): boolean {
  return hostedAvailable && totalVramMb !== null && totalVramMb <= LOW_VRAM_LIMIT_MB;
}
