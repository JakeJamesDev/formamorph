import { describe, it, expect } from 'vitest';
import {
  observeReply, observationAnswer, observationMayCorrect, replyCarriedReasoning,
} from './reasoningObservation';
import type { ReasoningCapability, ReasoningCapabilitySource } from './reasoningEffort';

describe('replyCarriedReasoning', () => {
  it('sees the stream reasoning field', () => {
    expect(replyCarriedReasoning('The player asked for a door.', 'You open the door.')).toBe(true);
  });

  it('sees an inline think block', () => {
    expect(replyCarriedReasoning('', '<think>Pick a door.</think>You open the door.')).toBe(true);
  });

  it('sees the other inline tags a model may use', () => {
    expect(replyCarriedReasoning('', '<reasoning>Pick a door.</reasoning>Text.')).toBe(true);
    expect(replyCarriedReasoning('', '<thought>Pick a door.</thought>Text.')).toBe(true);
  });

  it('reads a bare reply as no reasoning', () => {
    expect(replyCarriedReasoning('', 'You open the door.')).toBe(false);
  });

  it('reads whitespace in the reasoning field as no reasoning', () => {
    expect(replyCarriedReasoning('   \n ', 'You open the door.')).toBe(false);
  });

  it('reads an unclosed think block as no reasoning, since nothing finished', () => {
    expect(replyCarriedReasoning('', '<think>Pick a')).toBe(false);
  });
});

describe('observeReply', () => {
  it('records what the reply showed and the effort in force', () => {
    expect(observeReply('Thinking.', 'Text.', 'high')).toEqual({ sawReasoning: true, effort: 'high' });
  });

  it('records a missing effort field as Model Default', () => {
    expect(observeReply('', 'Text.', undefined)).toEqual({ sawReasoning: false, effort: null });
  });
});

describe('observationAnswer', () => {
  it('marks a model that showed reasoning as reasoning', () => {
    expect(observationAnswer({ sawReasoning: true, effort: 'low' })).toBe(true);
  });

  it('marks a model that showed reasoning under Model Default as reasoning', () => {
    expect(observationAnswer({ sawReasoning: true, effort: null })).toBe(true);
  });

  it('marks a bare reply under a positive effort as not reasoning', () => {
    for (const effort of ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const) {
      expect(observationAnswer({ sawReasoning: false, effort })).toBe(false);
    }
  });

  it('leaves a bare reply under none unanswered, since nothing asked the model to think', () => {
    expect(observationAnswer({ sawReasoning: false, effort: 'none' })).toBeNull();
  });

  it('leaves a bare reply under Model Default unanswered, since the endpoint chose', () => {
    expect(observationAnswer({ sawReasoning: false, effort: null })).toBeNull();
  });

  it('leaves an absent observation unanswered', () => {
    expect(observationAnswer(null)).toBeNull();
    expect(observationAnswer(undefined)).toBeNull();
  });
});

describe('observationMayCorrect', () => {
  const answeredBy = (source: ReasoningCapabilitySource): ReasoningCapability =>
    ({ reasons: false, levels: [], budget: null, sources: { reasons: source } });

  it('opens a record nothing has answered', () => {
    expect(observationMayCorrect(null)).toBe(true);
    expect(observationMayCorrect({ reasons: null, levels: null, budget: null, sources: {} })).toBe(true);
  });

  it.each(['probe', 'cache', 'observed'] as const)('corrects an answer the %s source gave', (source) => {
    expect(observationMayCorrect(answeredBy(source))).toBe(true);
  });

  it.each(['native', 'catalog', 'engine'] as const)('leaves an answer the %s source gave alone', (source) => {
    expect(observationMayCorrect(answeredBy(source))).toBe(false);
  });
});
