import { describe, it, expect } from 'vitest';
import { reasoningIdentityAnswer as identity } from './reasoningIdentity';

const ANTHROPIC = 'https://api.anthropic.com/v1/chat/completions';
const GOOGLE = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

describe('hosts the table does not claim', () => {
  it('answers nothing for an endpoint no row names', () => {
    expect(identity('https://api.openai.com/v1/chat/completions', 'gpt-5')).toBeNull();
    expect(identity('http://localhost:1234/v1/chat/completions', 'claude-opus-5')).toBeNull();
  });

  it('answers nothing for an unparseable endpoint', () => {
    expect(identity('not a url', 'claude-opus-5')).toBeNull();
  });

  // A subdomain is a different host, and a host that merely ends in the same letters is a different company.
  it('answers nothing for a host that only looks like a claimed one', () => {
    expect(identity('https://api.anthropic.com.evil.test/v1/chat/completions', 'claude-opus-5')).toBeNull();
    expect(identity('https://notapi.anthropic.com/v1/chat/completions', 'claude-opus-5')).toBeNull();
  });

  it('reads the host case-insensitively, as hostnames are', () => {
    expect(identity('https://API.Anthropic.COM/v1/chat/completions', 'claude-opus-5')?.dialect)
      .toBe('anthropic-adaptive');
  });
});

describe('Anthropic by model generation', () => {
  const dialectOf = (model: string) => identity(ANTHROPIC, model)?.dialect;

  // Claude 4.7 and later reject `thinking.type: enabled` with a 400, so they take the adaptive row.
  it.each([
    'claude-opus-4-7', 'claude-opus-4-8', 'claude-opus-5', 'claude-sonnet-5',
    'claude-fable-5-1', 'claude-mythos-5-1',
  ])('names anthropic-adaptive for %s', (model) => {
    expect(dialectOf(model)).toBe('anthropic-adaptive');
  });

  // Claude 4.6 and earlier take a manual `budget_tokens`, which is the only thinking mode they have.
  it.each([
    'claude-sonnet-4-6', 'claude-opus-4-6', 'claude-opus-4-5', 'claude-sonnet-4-5',
    'claude-haiku-4-5-20251001', 'claude-opus-4-20250514', 'claude-3-7-sonnet-20250219',
  ])('names anthropic-budget for %s', (model) => {
    expect(dialectOf(model)).toBe('anthropic-budget');
  });

  // Before 3.7 no thinking parameter exists, so the controls are hidden rather than sent a field that fails.
  it.each(['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'])(
    'rules %s out as a non-reasoning model',
    (model) => {
      expect(identity(ANTHROPIC, model)).toMatchObject({ reasons: false, levels: [], budget: false });
    },
  );

  it('reads an unrecognized Claude id as adaptive, the shape current models take', () => {
    expect(dialectOf('claude-next')).toBe('anthropic-adaptive');
  });

  // Fable and Mythos reject `thinking.type: disabled`, so their switch locks on rather than sending it.
  it.each(['claude-fable-5-1', 'claude-fable-5', 'claude-mythos-5-1', 'claude-mythos-5'])(
    'refuses off on %s',
    (model) => expect(identity(ANTHROPIC, model)?.offAllowed).toBe(false),
  );

  // Every other current model accepts it, so the row says nothing and the dialect's own answer stands.
  it.each(['claude-opus-5', 'claude-sonnet-5', 'claude-opus-4-8'])(
    'leaves the off answer to the dialect row on %s',
    (model) => expect(identity(ANTHROPIC, model)?.offAllowed).toBeUndefined(),
  );

  // The line is a whole name segment. An id that is the bare line still refuses off; one that merely starts
  // with those letters is a different model and must not inherit the lock.
  it('reads the always-thinking line as a whole name segment', () => {
    expect(identity(ANTHROPIC, 'claude-fable')?.offAllowed).toBe(false);
    expect(identity(ANTHROPIC, 'claude-fabletastic-5')?.offAllowed).toBeUndefined();
  });

  it('answers nothing for a model id that is not a Claude one', () => {
    expect(identity(ANTHROPIC, 'gpt-5')).toBeNull();
  });

  // The endpoint documents `reasoning_effort` as ignored, so no strength is ever offered on either row.
  it('offers no strength on either Anthropic row', () => {
    expect(identity(ANTHROPIC, 'claude-opus-5')?.levels).toEqual([]);
    expect(identity(ANTHROPIC, 'claude-sonnet-4-6')?.levels).toEqual([]);
  });

  it('takes a budget on the budget row and none on the adaptive row', () => {
    expect(identity(ANTHROPIC, 'claude-sonnet-4-6')).toMatchObject({ reasons: true, budget: true });
    expect(identity(ANTHROPIC, 'claude-opus-5')).toMatchObject({ reasons: true, budget: false });
  });
});

describe('Google by model generation', () => {
  const dialectOf = (model: string) => identity(GOOGLE, model)?.dialect;

  it.each(['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'])(
    'names google-2.5 for %s',
    (model) => expect(dialectOf(model)).toBe('google-2.5'),
  );

  it.each([
    'gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview',
    'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash',
  ])('names google-3 for %s', (model) => expect(dialectOf(model)).toBe('google-3'));

  it('reads an unrecognized Gemini id as google-3, the current generation', () => {
    expect(dialectOf('gemini-4-pro')).toBe('google-3');
    expect(dialectOf('gemini-preview')).toBe('google-3');
  });

  // Each generation is a range, not one number. A later 2.x still spells strength as a budget, so reading it
  // as 3.x would send a thinking level to a model that takes none.
  it.each(['gemini-2.6-flash', 'gemini-2.9-pro'])('keeps %s on the 2.5 budget spelling', (model) => {
    expect(identity(GOOGLE, model)).toMatchObject({ dialect: 'google-2.5', budget: true });
  });

  // Gemini 2.0 and 1.x carry no thinking config at all, so the controls hide rather than send one.
  it.each(['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'])(
    'rules %s out as a non-reasoning model',
    (model) => expect(identity(GOOGLE, model)).toMatchObject({ reasons: false, levels: [], budget: false }),
  );

  it('answers nothing for a model on the host that is not a Gemini one', () => {
    expect(identity(GOOGLE, 'gemma-3-27b-it')).toBeNull();
    expect(identity(GOOGLE, 'text-embedding-004')).toBeNull();
  });

  // The documented budget mapping stops at high, so a player never lands on a rung with no budget to send.
  it('lists the four levels the 2.5 budget mapping documents, and no rung above them', () => {
    expect(identity(GOOGLE, 'gemini-2.5-flash')?.levels).toEqual(['minimal', 'low', 'medium', 'high']);
  });

  it('lists the three thinking levels every Gemini 3 model accepts', () => {
    expect(identity(GOOGLE, 'gemini-3-pro-preview')?.levels).toEqual(['low', 'medium', 'high']);
  });

  it('takes a budget on 2.5 and a level on 3.x', () => {
    expect(identity(GOOGLE, 'gemini-2.5-flash')).toMatchObject({ reasons: true, budget: true });
    expect(identity(GOOGLE, 'gemini-3-pro-preview')).toMatchObject({ reasons: true, budget: false });
  });
});

describe('the model id a row reads', () => {
  it('ignores surrounding space and letter case', () => {
    expect(identity(ANTHROPIC, '  Claude-Sonnet-4-6 ')?.dialect).toBe('anthropic-budget');
    expect(identity(GOOGLE, 'Gemini-2.5-Flash')?.dialect).toBe('google-2.5');
  });

  it('answers nothing for an empty model id', () => {
    expect(identity(ANTHROPIC, '')).toBeNull();
    expect(identity(GOOGLE, '   ')).toBeNull();
  });
});
