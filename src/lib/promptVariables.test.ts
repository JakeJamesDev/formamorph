import { describe, it, expect } from 'vitest';
import {
  baseToken, tokenVariant, withVariant, variantLabelForToken,
  variableForToken, labelForToken, colorForToken,
  PROMPT_KIND_VARIABLES,
} from './promptVariables';

describe('variant token helpers', () => {
  it('extracts the variant id (or null for the default form)', () => {
    expect(tokenVariant('<LOCATION>')).toBeNull();
    expect(tokenVariant('<LOCATION|summary>')).toBe('summary');
    expect(tokenVariant('<LOCATION|list>')).toBe('list');
    expect(tokenVariant('<NOTES>')).toBeNull();
  });

  it('strips any variant back to the base token', () => {
    expect(baseToken('<LOCATION|summary>')).toBe('<LOCATION>');
    expect(baseToken('<LOCATION|list>')).toBe('<LOCATION>');
    expect(baseToken('<LOCATION>')).toBe('<LOCATION>');
  });

  it('re-applies a variant (null leaves the base unchanged)', () => {
    expect(withVariant('<LOCATION>', 'list')).toBe('<LOCATION|list>');
    expect(withVariant('<LOCATION>', 'summary')).toBe('<LOCATION|summary>');
    expect(withVariant('<LOCATION>', null)).toBe('<LOCATION>');
  });
});

describe('variable lookup by token (base or variant)', () => {
  it('resolves any variant token to its base variable', () => {
    expect(variableForToken('<LOCATION|list>')?.label).toBe('Location');
    expect(variableForToken('<LOCATION|summary>')?.variants?.length).toBe(3);
  });

  it('exposes the variant label for the chip (null for the full form)', () => {
    expect(variantLabelForToken('<LOCATION|list>')).toBe('List');
    expect(variantLabelForToken('<LOCATION|summary>')).toBe('Summary');
    expect(variantLabelForToken('<LOCATION>')).toBeNull();
  });

  it('shares label/color across all forms', () => {
    expect(labelForToken('<LOCATION|list>')).toBe('Location');
    expect(colorForToken('<LOCATION|list>')).toBe(colorForToken('<LOCATION>'));
  });

  it('marks variables without variants', () => {
    expect(variableForToken('<NOTES>')?.variants).toBeUndefined();
    expect(variableForToken('<UNKNOWN>')).toBeUndefined();
  });
});

describe('every prompt kind offers the six shared context chips', () => {
  const CONTEXT = ['<WORLD DESCRIPTION>', '<STATS DESCRIPTION>', '<TRAITS DESCRIPTION>', '<LOCATION>', '<ENTITIES>', '<NOTES>'];
  for (const [kind, vars] of Object.entries(PROMPT_KIND_VARIABLES)) {
    it(kind, () => {
      const tokens = vars.map((v) => v.token);
      for (const t of CONTEXT) expect(tokens).toContain(t);
    });
  }
});
