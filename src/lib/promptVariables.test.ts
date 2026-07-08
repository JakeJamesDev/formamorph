import { describe, it, expect } from 'vitest';
import {
  baseToken, tokenVariant, withVariant, variantLabelForToken,
  variableForToken, labelForToken, colorForToken,
  variableAxes, decodeVariant, encodeVariant, ALL_VARIANT_IDS,
  PROMPT_KIND_VARIABLES,
  type PromptVariable,
} from './promptVariables';

describe('variant token helpers', () => {
  it('extracts the variant id (or null for the default form)', () => {
    expect(tokenVariant('<LOCATION>')).toBeNull();
    expect(tokenVariant('<LOCATION|summary>')).toBe('summary');
    expect(tokenVariant('<LOCATION|sublocations>')).toBe('sublocations');
    expect(tokenVariant('<NOTES>')).toBeNull();
  });

  it('strips any variant back to the base token', () => {
    expect(baseToken('<LOCATION|summary>')).toBe('<LOCATION>');
    expect(baseToken('<LOCATION|reachable.summary>')).toBe('<LOCATION>');
    expect(baseToken('<LOCATION>')).toBe('<LOCATION>');
  });

  it('re-applies a variant (null leaves the base unchanged)', () => {
    expect(withVariant('<LOCATION>', 'reachable')).toBe('<LOCATION|reachable>');
    expect(withVariant('<LOCATION>', 'summary')).toBe('<LOCATION|summary>');
    expect(withVariant('<LOCATION>', null)).toBe('<LOCATION>');
  });
});

describe('variable lookup by token (base or variant)', () => {
  it('resolves any variant token to its base variable', () => {
    expect(variableForToken('<LOCATION|reachable>')?.label).toBe('Location');
    const loc = variableForToken('<LOCATION|summary>')!;
    expect(variableAxes(loc).find((a) => a.id === 'content')?.options).toHaveLength(2);
  });

  it('exposes the variant label for the chip (null for the full form)', () => {
    expect(variantLabelForToken('<LOCATION|sublocations>')).toBe('Sub-locations');
    expect(variantLabelForToken('<LOCATION|summary>')).toBe('Summary');
    expect(variantLabelForToken('<LOCATION>')).toBeNull();
  });

  it('shares label/color across all forms', () => {
    expect(labelForToken('<LOCATION|reachable>')).toBe('Location');
    expect(colorForToken('<LOCATION|reachable>')).toBe(colorForToken('<LOCATION>'));
  });

  it('marks variables without variants', () => {
    expect(variableForToken('<NOTES>')?.variants).toBeUndefined();
    expect(variableForToken('<UNKNOWN>')).toBeUndefined();
  });
});

describe('multi-axis variants (Stats: content × format)', () => {
  const STATS = variableForToken('<STATS DESCRIPTION>')!;

  it('exposes the three content-piece axes plus format', () => {
    expect(variableAxes(STATS).map((a) => a.id)).toEqual(['numbers', 'descriptions', 'meaning', 'format']);
  });

  it('normalizes a single-axis (variants-based) variable into one axis', () => {
    // No registry variable still uses the `variants` shorthand, but the normalization path is supported.
    const single: PromptVariable = {
      token: '<X>', label: 'X', color: '#000',
      variants: [{ id: null, label: 'A' }, { id: 'b', label: 'B' }],
    };
    expect(variableAxes(single)).toHaveLength(1);
    expect(variableAxes(single)[0].options).toHaveLength(2);
  });

  it('decodes a combined id into a per-axis selection (order-independent)', () => {
    expect(decodeVariant(STATS, 'numbers.meaning.markdown')).toEqual({ numbers: 'numbers', descriptions: null, meaning: 'meaning', format: 'markdown' });
    expect(decodeVariant(STATS, 'markdown')).toEqual({ numbers: null, descriptions: null, meaning: null, format: 'markdown' });
    expect(decodeVariant(STATS, 'numbers')).toEqual({ numbers: 'numbers', descriptions: null, meaning: null, format: null });
    expect(decodeVariant(STATS, null)).toEqual({ numbers: null, descriptions: null, meaning: null, format: null });
  });

  it('encodes a selection back to the combined id (null when all default)', () => {
    expect(encodeVariant(STATS, { numbers: 'numbers', descriptions: null, meaning: 'meaning', format: 'markdown' })).toBe('numbers.meaning.markdown');
    expect(encodeVariant(STATS, { numbers: null, descriptions: null, meaning: null, format: 'markdown' })).toBe('markdown');
    expect(encodeVariant(STATS, { numbers: 'numbers', descriptions: null, meaning: null, format: null })).toBe('numbers');
    expect(encodeVariant(STATS, { numbers: null, descriptions: null, meaning: null, format: null })).toBeNull();
  });

  it('lists every combined id, and a compound is not masked by its prefix', () => {
    for (const id of ['descriptions', 'numbers', 'markdown', 'descriptions.markdown', 'numbers.markdown', 'summary', 'sublocations', 'reachable.summary.markdown']) {
      expect(ALL_VARIANT_IDS).toContain(id);
    }
    // The real contract behind the longest-first ordering: a compound id decodes to BOTH axes rather than
    // being truncated to its bare prefix (e.g. 'descriptions.markdown' isn't collapsed to 'descriptions').
    expect(decodeVariant(STATS, 'descriptions.markdown')).toEqual({ numbers: null, descriptions: 'descriptions', meaning: null, format: 'markdown' });
  });

  it('composes the chip label from the non-default axis selections', () => {
    expect(variantLabelForToken('<STATS DESCRIPTION|descriptions.markdown>')).toBe('Descriptor, Markdown');
    expect(variantLabelForToken('<STATS DESCRIPTION|markdown>')).toBe('Markdown');
    expect(variantLabelForToken('<STATS DESCRIPTION|descriptions>')).toBe('Descriptor');
    expect(variantLabelForToken('<STATS DESCRIPTION>')).toBeNull();
  });

  it('gives Traits a single format axis (shared with Stats)', () => {
    const TRAITS = variableForToken('<TRAITS DESCRIPTION>')!;
    expect(variableAxes(TRAITS).map((a) => a.id)).toEqual(['format']);
    expect(variantLabelForToken('<TRAITS DESCRIPTION|markdown>')).toBe('Markdown');
    expect(variantLabelForToken('<TRAITS DESCRIPTION>')).toBeNull();
  });

  it('gives Location a scope axis (Current/Sub-locations/Reachable/Destinations) plus content and format', () => {
    const LOC = variableForToken('<LOCATION>')!;
    expect(variableAxes(LOC).map((a) => a.id)).toEqual(['scope', 'content', 'format']);
    expect(variantLabelForToken('<LOCATION|summary.markdown>')).toBe('Summary, Markdown');
    expect(variantLabelForToken('<LOCATION|reachable.summary.markdown>')).toBe('Reachable, Summary, Markdown');
    expect(variantLabelForToken('<LOCATION|destinations>')).toBe('Destinations');
  });

  it('gives Entities a scope axis (Here/Sub-locations/Reachable) plus content and format', () => {
    const ENT = variableForToken('<ENTITIES>')!;
    expect(variableAxes(ENT).map((a) => a.id)).toEqual(['scope', 'content', 'format']);
    expect(variantLabelForToken('<ENTITIES|reachable.summary.markdown>')).toBe('Reachable, Summary, Markdown');
    expect(variantLabelForToken('<ENTITIES|markdown>')).toBe('Markdown');
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

describe('the Dictionary chip is narration-scoped', () => {
  it('offers <DICTIONARY> on the narration toolbar only, labeled Dictionary', () => {
    expect(PROMPT_KIND_VARIABLES.narration.map((v) => v.token)).toContain('<DICTIONARY>');
    expect(labelForToken('<DICTIONARY>')).toBe('Dictionary');
    // Not a shared context chip — absent from the other kinds' toolbars.
    expect(PROMPT_KIND_VARIABLES.choices.map((v) => v.token)).not.toContain('<DICTIONARY>');
  });
});
