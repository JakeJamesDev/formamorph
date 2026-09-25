import { describe, it, expect } from 'vitest';
import {
  observeReply, observationAnswer, observationMayCorrect, replyCarriedReasoning, replySeparatedReasoning,
  type ReasoningObservation,
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

describe('replySeparatedReasoning', () => {
  it('sees a reasoning field beside the content', () => {
    expect(replySeparatedReasoning('The player asked for a door.')).toBe(true);
  });

  it('reads an empty field as no separation', () => {
    expect(replySeparatedReasoning('')).toBe(false);
    expect(replySeparatedReasoning('  \n ')).toBe(false);
  });
});

describe('observeReply', () => {
  it('records what the reply showed and the effort in force', () => {
    expect(observeReply('Thinking.', 'Text.', 'high'))
      .toEqual({ sawReasoning: true, sawSeparateReasoning: true, effort: 'high' });
  });

  it('records a missing effort field as Model Default', () => {
    expect(observeReply('', 'Text.', undefined))
      .toEqual({ sawReasoning: false, sawSeparateReasoning: false, effort: null });
  });

  // The two answers part company here, and a dialect that waits for proof turns on the difference: the model
  // thought, but the server handed the thinking back inside the prose rather than in a field of its own.
  it('reads an inline think block as reasoning, but not as separated reasoning', () => {
    expect(observeReply('', '<think>Pick a door.</think>Text.', 'high'))
      .toEqual({ sawReasoning: true, sawSeparateReasoning: false, effort: 'high' });
  });
});

describe('observationAnswer', () => {
  // The reasons question turns on `sawReasoning` alone, so these cases pin separation to the inline shape.
  const reply = (sawReasoning: boolean, effort: ReasoningObservation['effort']): ReasoningObservation =>
    ({ sawReasoning, sawSeparateReasoning: false, effort });

  it('marks a model that showed reasoning as reasoning', () => {
    expect(observationAnswer(reply(true, 'low'))).toBe(true);
  });

  it('marks a model that showed reasoning under Model Default as reasoning', () => {
    expect(observationAnswer(reply(true, null))).toBe(true);
  });

  it('marks a bare reply under a positive effort as not reasoning', () => {
    for (const effort of ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const) {
      expect(observationAnswer(reply(false, effort))).toBe(false);
    }
  });

  it('leaves a bare reply under none unanswered, since nothing asked the model to think', () => {
    expect(observationAnswer(reply(false, 'none'))).toBeNull();
  });

  it('leaves a bare reply under Model Default unanswered, since the endpoint chose', () => {
    expect(observationAnswer(reply(false, null))).toBeNull();
  });

  it('leaves an absent observation unanswered', () => {
    expect(observationAnswer(null)).toBeNull();
    expect(observationAnswer(undefined)).toBeNull();
  });
});

describe('observationMayCorrect', () => {
  const answeredBy = (source: ReasoningCapabilitySource): ReasoningCapability =>
    ({ reasons: false, levels: [], budget: null, dialect: 'unknown', offAllowed: null, tools: null, sources: { reasons: source } });

  it('opens a record nothing has answered', () => {
    expect(observationMayCorrect(null)).toBe(true);
    expect(observationMayCorrect({ reasons: null, levels: null, budget: null, dialect: 'unknown', offAllowed: null, tools: null, sources: {} })).toBe(true);
  });

  it.each(['probe', 'cache', 'observed'] as const)('corrects an answer the %s source gave', (source) => {
    expect(observationMayCorrect(answeredBy(source))).toBe(true);
  });

  it.each(['native', 'catalog', 'engine'] as const)('leaves an answer the %s source gave alone', (source) => {
    expect(observationMayCorrect(answeredBy(source))).toBe(false);
  });
});
