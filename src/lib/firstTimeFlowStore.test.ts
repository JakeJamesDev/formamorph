// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_AI_SEEN_KEY } from '@/components/game/demoAISeen';
import {
  demoAITurnCount, engineTurnCount, isDemoAICardSeen, isEngineCardSeen, isFirstRunStepSeen, markDemoAICardSeen,
  markEngineCardSeen, markFirstRunStepSeen, recordDemoAITurn, recordEngineTurn,
} from './firstTimeFlowStore';

beforeEach(() => localStorage.clear());

describe('the First-Time Flow records', () => {
  it('start unset, and each mark sets only its own record', () => {
    expect(isFirstRunStepSeen()).toBe(false);
    expect(isDemoAICardSeen()).toBe(false);
    markFirstRunStepSeen();
    expect(isFirstRunStepSeen()).toBe(true);
    expect(isDemoAICardSeen()).toBe(false);
    markDemoAICardSeen();
    expect(isDemoAICardSeen()).toBe(true);
  });

  it('count from zero and keep the count across reads', () => {
    expect(demoAITurnCount()).toBe(0);
    recordDemoAITurn();
    recordDemoAITurn();
    expect(demoAITurnCount()).toBe(2);
  });

  it('start an existing player with the Demo AI seen key at zero', () => {
    localStorage.setItem(DEMO_AI_SEEN_KEY, '1');
    expect(demoAITurnCount()).toBe(0);
    expect(isDemoAICardSeen()).toBe(false);
  });

  it('keep the built-in engine records apart from the Demo AI records', () => {
    markDemoAICardSeen();
    recordDemoAITurn();
    expect(isEngineCardSeen()).toBe(false);
    expect(engineTurnCount()).toBe(0);
    recordEngineTurn();
    markEngineCardSeen();
    expect(engineTurnCount()).toBe(1);
    expect(demoAITurnCount()).toBe(1);
    localStorage.removeItem('FORMAMORPH_demoAICardSeen');
    expect(isEngineCardSeen()).toBe(true);
    expect(isDemoAICardSeen()).toBe(false);
  });

  it('read a damaged count as zero and count on from there', () => {
    localStorage.setItem('FORMAMORPH_demoAITurnCount', 'not a number');
    expect(demoAITurnCount()).toBe(0);
    recordDemoAITurn();
    expect(demoAITurnCount()).toBe(1);
  });
});
