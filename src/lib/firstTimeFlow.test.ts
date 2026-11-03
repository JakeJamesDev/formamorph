import { describe, expect, it } from 'vitest';
import { aiSetupLeadsWithHostedAi, cardDue, countsAsDemoAITurn, entryLineDue, firstRunStepDue, offerAvailable, type CardFacts, type DemoAITurnFacts } from './firstTimeFlow';

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
  const counted: DemoAITurnFacts = { narrationIsDemoAI: true, isOpeningTurn: false, isNewTurn: true, cardSeen: false };

  it('counts a new turn after a player action on the Demo AI', () => {
    expect(countsAsDemoAITurn(counted)).toBe(true);
  });

  it.each<[string, Partial<DemoAITurnFacts>]>([
    ['narration on another endpoint', { narrationIsDemoAI: false }],
    ['the opening turn', { isOpeningTurn: true }],
    ['a regenerate', { isNewTurn: false }],
    ['a card that has shown', { cardSeen: true }],
  ])('skips %s', (_, change) => {
    expect(countsAsDemoAITurn({ ...counted, ...change })).toBe(false);
  });
});

describe('cardDue', () => {
  const due: CardFacts = { narrationIsDemoAI: true, demoAITurnCount: 5, cardSeen: false, pledged: false, hostedAvailable: true };

  it('is due on the fifth turn and not the fourth', () => {
    expect(cardDue(due)).toBe(true);
    expect(cardDue({ ...due, demoAITurnCount: 4 })).toBe(false);
  });

  it('stays due past the fifth turn until the card has shown', () => {
    expect(cardDue({ ...due, demoAITurnCount: 6 })).toBe(true);
  });

  it('is not due at a count of zero, where every player starts', () => {
    expect(cardDue({ ...due, demoAITurnCount: 0 })).toBe(false);
  });

  it.each<[string, Partial<CardFacts>]>([
    ['a card that has shown', { cardSeen: true }],
    ['a pledged player', { pledged: true }],
    ['a non-Demo endpoint', { narrationIsDemoAI: false }],
    ['a build without hosted AI', { hostedAvailable: false }],
  ])('is never due for %s', (_, change) => {
    expect(cardDue({ ...due, ...change })).toBe(false);
  });
});

describe('offerAvailable', () => {
  const offered = { narrationIsDemoAI: true, pledged: false, hostedAvailable: true };

  it('is available on the Demo AI, unpledged, in a build with hosted AI', () => {
    expect(offerAvailable(offered)).toBe(true);
  });

  it.each([
    ['a pledged player', { pledged: true }],
    ['a non-Demo endpoint', { narrationIsDemoAI: false }],
    ['a build without hosted AI', { hostedAvailable: false }],
  ])('is off for %s', (_, change) => {
    expect(offerAvailable({ ...offered, ...change })).toBe(false);
  });
});

describe('aiSetupLeadsWithHostedAi', () => {
  it.each([
    [8500, true],
    [8501, false],
    [6144, true],
    [14000, false],
    [null, false],
  ])('at a reported total of %s MB leads: %s', (totalVramMb, leads) => {
    expect(aiSetupLeadsWithHostedAi({ totalVramMb, hostedAvailable: true })).toBe(leads);
  });

  it('never leads in a build without hosted AI', () => {
    expect(aiSetupLeadsWithHostedAi({ totalVramMb: 8000, hostedAvailable: false })).toBe(false);
  });
});
