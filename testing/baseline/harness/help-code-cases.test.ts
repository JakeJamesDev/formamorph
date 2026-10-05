import { describe, expect, it } from 'vitest';
import { hasCodeWords, isCodeTurn } from '@/lib/formaquestion/helpCodeRider';
import { HELP_CODE_CASES } from './help-code-cases';

// The set against the real rider trigger: a trigger change that flips a case fails here, not as a silent arm swap.
describe('the help-code question set', () => {
  it('gives each question its own id', () => {
    const ids = HELP_CODE_CASES.map((c) => c.id);
    expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([]);
  });

  it('makes every code case a code turn and no prose case one', () => {
    const wrong = HELP_CODE_CASES.filter((c) => isCodeTurn(c.question, c.surface) !== (c.kind === 'code')).map((c) => c.id);
    expect(wrong).toEqual([]);
  });

  it('fires the rider on an open-Code-tab case through the tab alone', () => {
    const worded = HELP_CODE_CASES.filter((c) => c.surface && hasCodeWords(c.question)).map((c) => c.id);
    expect(worded).toEqual([]);
    expect(HELP_CODE_CASES.some((c) => c.kind === 'code' && c.surface)).toBe(true);
    expect(HELP_CODE_CASES.some((c) => c.kind === 'code' && !c.surface)).toBe(true);
  });
});
