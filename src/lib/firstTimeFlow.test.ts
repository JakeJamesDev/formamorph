import { describe, expect, it } from 'vitest';
import {
  aiSetupLeadsWithHostedAi, cardDue, countsAsCardTurn, engineCardDue, engineOfferAvailable, entryLineDue,
  firstRunStepDue, offerAvailable, type CardFacts, type CardTurnFacts, type EngineCardFacts, type EngineOfferFacts,
} from './firstTimeFlow';

// Each card runs the one count rule with its own facts.
const countsAsDemoAITurn = countsAsCardTurn;
const countsAsEngineTurn = countsAsCardTurn;
type DemoAITurnFacts = CardTurnFacts;
type EngineTurnFacts = CardTurnFacts;

describe('firstRunStepDue', () => {
  it.each([
    ['a new player', { introSeenAtLaunch: false, firstRunStepSeen: false }, true],
    ['a new player who has closed the step', { introSeenAtLaunch: false, firstRunStepSeen: true }, false],
    ['a player who had the intro record at launch', { introSeenAtLaunch: true, firstRunStepSeen: false }, false],
    ['a returning player', { introSeenAtLaunch: true, firstRunStepSeen: true }, false],
  ])('%s', (_, facts, due) => {
    expect(firstRunStepDue(facts)).toBe(due);
  });
});

describe('entryLineDue', () => {
  const due = { narrationIsDemoAI: true, demoAISeen: false, aiGateDue: false };

  it('shows on the Demo AI with the seen key unset and no gate due', () => {
    expect(entryLineDue(due)).toBe(true);
  });

  it.each([
    ['narration on another endpoint', { narrationIsDemoAI: false }],
    ['the seen key set', { demoAISeen: true }],
    ['the gate due', { aiGateDue: true }],
    ['reachability unknown', { aiGateDue: null }],
  ])('stays hidden with %s', (_, change) => {
    expect(entryLineDue({ ...due, ...change })).toBe(false);
  });
});

describe('countsAsDemoAITurn', () => {
  const counted: DemoAITurnFacts = { onCardAI: true, isOpeningTurn: false, isNewTurn: true, cardSeen: false };

  it('counts a new turn after a player action on the Demo AI', () => {
    expect(countsAsDemoAITurn(counted)).toBe(true);
  });

  it.each<[string, Partial<DemoAITurnFacts>]>([
    ['narration on another endpoint', { onCardAI: false }],
    ['the opening turn', { isOpeningTurn: true }],
    ['a regenerate', { isNewTurn: false }],
    ['a card that has shown', { cardSeen: true }],
  ])('skips %s', (_, change) => {
    expect(countsAsDemoAITurn({ ...counted, ...change })).toBe(false);
  });
});

describe('cardDue', () => {
  const due: CardFacts = { onCardAI: true, turnCount: 5, cardSeen: false, pledged: false, hostedAvailable: true };

  it('is due on the fifth turn and not the fourth', () => {
    expect(cardDue(due)).toBe(true);
    expect(cardDue({ ...due, turnCount: 4 })).toBe(false);
  });

  it('stays due past the fifth turn until the card has shown', () => {
    expect(cardDue({ ...due, turnCount: 6 })).toBe(true);
  });

  it('is not due at a count of zero, where every player starts', () => {
    expect(cardDue({ ...due, turnCount: 0 })).toBe(false);
  });

  it.each<[string, Partial<CardFacts>]>([
    ['a card that has shown', { cardSeen: true }],
    ['a pledged player', { pledged: true }],
    ['a non-Demo endpoint', { onCardAI: false }],
    ['a build without hosted AI', { hostedAvailable: false }],
  ])('is never due for %s', (_, change) => {
    expect(cardDue({ ...due, ...change })).toBe(false);
  });
});

describe('offerAvailable', () => {
  const offered = { onCardAI: true, pledged: false, hostedAvailable: true };

  it('is available on the Demo AI, unpledged, in a build with hosted AI', () => {
    expect(offerAvailable(offered)).toBe(true);
  });

  it.each([
    ['a pledged player', { pledged: true }],
    ['a non-Demo endpoint', { onCardAI: false }],
    ['a build without hosted AI', { hostedAvailable: false }],
  ])('is off for %s', (_, change) => {
    expect(offerAvailable({ ...offered, ...change })).toBe(false);
  });
});

describe('countsAsEngineTurn', () => {
  const counted: EngineTurnFacts = { onCardAI: true, isOpeningTurn: false, isNewTurn: true, cardSeen: false };

  it('counts a new turn after a player action on the built-in engine', () => {
    expect(countsAsEngineTurn(counted)).toBe(true);
  });

  it.each<[string, Partial<EngineTurnFacts>]>([
    ['narration on another endpoint, the Demo AI included', { onCardAI: false }],
    ['the opening turn', { isOpeningTurn: true }],
    ['a regenerate', { isNewTurn: false }],
    ['a card that has shown', { cardSeen: true }],
  ])('skips %s', (_, change) => {
    expect(countsAsEngineTurn({ ...counted, ...change })).toBe(false);
  });
});

describe('engineCardDue', () => {
  const due: EngineCardFacts = {
    onCardAI: true, vramClass: 'low', pledged: false, hostedAvailable: true, turnCount: 10, cardSeen: false,
  };

  it('is due at a count of 10 and not at 9', () => {
    expect(engineCardDue(due)).toBe(true);
    expect(engineCardDue({ ...due, turnCount: 9 })).toBe(false);
  });

  it('stays due past 10 until the card has shown, so a player who becomes eligible later still gets it', () => {
    expect(engineCardDue({ ...due, turnCount: 25 })).toBe(true);
  });

  it.each<[string, Partial<EngineCardFacts>]>([
    ['a card that has shown', { cardSeen: true }],
    ['a pledged player', { pledged: true }],
    ['narration off the built-in engine', { onCardAI: false }],
    ['a build without hosted AI', { hostedAvailable: false }],
    ['the ok VRAM class', { vramClass: 'ok' }],
    ['the unknown VRAM class', { vramClass: 'unknown' }],
  ])('is never due for %s', (_, change) => {
    expect(engineCardDue({ ...due, ...change })).toBe(false);
  });
});

describe('engineOfferAvailable', () => {
  const offered: EngineOfferFacts = { onCardAI: true, vramClass: 'low', pledged: false, hostedAvailable: true };

  it('is available on the built-in engine with low VRAM, unpledged, in a build with hosted AI', () => {
    expect(engineOfferAvailable(offered)).toBe(true);
  });

  it.each<[string, Partial<EngineOfferFacts>]>([
    ['narration off the built-in engine', { onCardAI: false }],
    ['the ok VRAM class', { vramClass: 'ok' }],
    ['the unknown VRAM class', { vramClass: 'unknown' }],
    ['a pledged player', { pledged: true }],
    ['a build without hosted AI', { hostedAvailable: false }],
  ])('is off for %s', (_, change) => {
    expect(engineOfferAvailable({ ...offered, ...change })).toBe(false);
  });
});

describe('aiSetupLeadsWithHostedAi', () => {
  it.each([
    ['low', true],
    ['ok', false],
    ['unknown', false],
  ] as const)('on a %s VRAM class leads: %s', (vramClass, leads) => {
    expect(aiSetupLeadsWithHostedAi({ vramClass, hostedAvailable: true, pledged: false })).toBe(leads);
  });

  it('never leads in a build without hosted AI', () => {
    expect(aiSetupLeadsWithHostedAi({ vramClass: 'low', hostedAvailable: false, pledged: false })).toBe(false);
  });

  it('never leads for a pledged player', () => {
    expect(aiSetupLeadsWithHostedAi({ vramClass: 'low', hostedAvailable: true, pledged: true })).toBe(false);
  });
});
