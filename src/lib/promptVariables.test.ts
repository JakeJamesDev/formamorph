import { describe, it, expect } from 'vitest';
import { sentenceShapeViolation } from '@/test/copyShape';
import {
  baseToken, tokenVariant, withVariant, variantLabelForToken,
  variableForToken, labelForToken, colorForToken,
  variableAxes, decodeVariant, encodeVariant, NOW_LINE_VARIABLES,
  PROMPT_KIND_VARIABLES, ALL_PROMPT_VARIABLES, splitToken,
  type PromptVariable,
} from './promptVariables';
import { renderPromptTemplate } from './promptTemplate';

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

describe('retired variant ids', () => {
  // A released prompt may still hold the old Definitions variant; it reads as the one Markdown Guidance.
  const saved = '<MARKDOWN GUIDANCE|definitions|pre="Syntax: "|format=markdown|header="Formatting">';

  it('parse to the bare chip key', () => {
    expect(splitToken(saved)?.key).toBe('<MARKDOWN GUIDANCE>');
  });

  it('render the bare chip value', () => {
    expect(renderPromptTemplate(saved, { '<MARKDOWN GUIDANCE>': 'defs' })).toBe('\n## Formatting\nSyntax: defs\n');
  });

  it('stay out of Chip Options', () => {
    expect(variableAxes(variableForToken('<MARKDOWN GUIDANCE>')!)).toEqual([]);
  });
});

describe('variable lookup by token (base or variant)', () => {
  it('resolves any variant token to its base variable', () => {
    expect(variableForToken('<LOCATION|reachable>')?.label).toBe('Location');
    const loc = variableForToken('<LOCATION|summary>')!;
    expect(variableAxes(loc).find((a) => a.id === 'content')?.options.map((o) => o.label)).toEqual(['Full', 'Summary', 'Name']);
  });

  it('exposes the variant label for the chip (null for the full form)', () => {
    expect(variantLabelForToken('<LOCATION|sublocations>')).toBe('Sub');
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

  it('decodes a compound id to both axes rather than its bare prefix', () => {
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

  it('gives Location a scope axis (Current/Sub/Reachable/Destinations) plus content and format', () => {
    const LOC = variableForToken('<LOCATION>')!;
    expect(variableAxes(LOC).map((a) => a.id)).toEqual(['scope', 'content', 'format']);
    expect(variantLabelForToken('<LOCATION|summary.markdown>')).toBe('Summary, Markdown');
    expect(variantLabelForToken('<LOCATION|reachable.summary.markdown>')).toBe('Reachable, Summary, Markdown');
    expect(variantLabelForToken('<LOCATION|destinations>')).toBe('Destinations');
    // The Name content option — the bare-name rendering the now-line message uses mid-sentence.
    expect(variantLabelForToken('<LOCATION|name>')).toBe('Name');
    expect(variantLabelForToken('<LOCATION|sublocations.name>')).toBe('Sub, Name');
  });

  it('gives Entities a scope axis (Here/Sub/Reachable) plus content, stats and format', () => {
    const ENT = variableForToken('<ENTITIES>')!;
    expect(variableAxes(ENT).map((a) => a.id)).toEqual([
      'scope', 'withstats', 'withtraits', 'content', 'traits', 'stats', 'range', 'descriptor', 'description', 'format',
    ]);
    expect(variantLabelForToken('<ENTITIES|reachable.summary.markdown>')).toBe('Reachable, Summary, Markdown');
    expect(variantLabelForToken('<ENTITIES|markdown>')).toBe('Markdown');
  });

  it('keeps the Entities stats piece on in a bare token and names its off state in the label', () => {
    expect(variantLabelForToken('<ENTITIES>')).toBeNull();
    expect(variantLabelForToken('<ENTITIES|inscene.summary.nostats.xml>')).toBe('In Scene, Summary, No Stats, XML');
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

describe('phase 2 registry changes', () => {
  it('offers Parent alongside the other location scopes', () => {
    const LOC = variableForToken('<LOCATION>')!;
    const scope = variableAxes(LOC).find((a) => a.id === 'scope')!;
    expect(scope.options.map((o) => o.label)).toEqual(['Current', 'Sub', 'Parent', 'Reachable', 'Destinations']);
    expect(variantLabelForToken('<LOCATION|parent.name>')).toBe('Parent, Name');
  });

  it('offers the In Scene entity scope', () => {
    const ENT = variableForToken('<ENTITIES>')!;
    const scope = variableAxes(ENT).find((a) => a.id === 'scope')!;
    expect(scope.options.map((o) => o.id)).toContain('inscene');
    expect(variantLabelForToken('<ENTITIES|inscene.name>')).toBe('In Scene, Name');
    expect(scope.options.map((o) => o.label)).toEqual(['Here', 'In Sub', 'Reachable', 'Known', 'In Scene']);
  });

  it('registers Time as an ordinary affixable context chip', () => {
    const TIME = variableForToken('<TIME>')!;
    expect(TIME.label).toBe('Time');
    expect(TIME.affixable).toBe(true);
    expect(variableAxes(TIME)).toHaveLength(0); // one value, no modes
  });

  it('has retired the bespoke clause tokens', () => {
    for (const t of ['<SCENE CAST>', '<SCENE NOTES>', '<SCENE TIME>', '<SCENE LOCATION>']) {
      expect(variableForToken(t)).toBeUndefined();
    }
  });

  it('offers the now-line only ordinary chips, each of which can carry wording', () => {
    expect(NOW_LINE_VARIABLES.map((v) => v.token)).toEqual(['<LOCATION>', '<ENTITIES>', '<TIME>', '<NOTES>']);
    expect(NOW_LINE_VARIABLES.every((v) => v.affixable)).toBe(true);
  });
});

describe('stat detail help', () => {
  const help = (token: string) => Object.fromEntries(
    variableAxes(variableForToken(token)!).filter((axis) => axis.row === 'Stat Detail').map((axis) => [axis.label, axis.help]),
  );

  it('reads the same on the Stats, Entities and Persona chips', () => {
    const stats = help('<STATS DESCRIPTION>');
    expect(Object.keys(stats)).toEqual(['Range', 'Descriptor', 'Description']);
    expect(help('<ENTITIES>')).toEqual(stats);
    expect(help('<PERSONA>')).toEqual(stats);
  });

  it('starts each piece with a verb and ends none with a period', () => {
    for (const text of Object.values(help('<STATS DESCRIPTION>'))) {
      expect(text).toMatch(/^Sends /);
      expect(text).not.toMatch(/\.$/);
    }
  });
});

describe('registry help lines', () => {
  const lines = ALL_PROMPT_VARIABLES.flatMap((variable) => variableAxes(variable).flatMap((axis) => [
    axis.help, axis.rowHelp, axis.readOnlyHelp, ...axis.options.map((option) => option.help),
  ].filter((text): text is string => !!text)));

  it('covers every axis and option help the dialog shows as a tooltip', () => {
    expect(lines.length).toBeGreaterThan(40);
  });

  it('follow the help-line shape, with no dash aside and no "character" for an entity', () => {
    for (const text of lines) {
      expect(sentenceShapeViolation(text), text).toBeNull();
      expect(text, text).not.toMatch(/ — | - /);
      expect(text, text).not.toMatch(/\bcharacters?\b/i);
    }
  });
});

