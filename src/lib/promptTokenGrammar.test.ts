import { describe, expect, it } from 'vitest';
import {
  ALL_PROMPT_VARIABLES, TOKEN_PATTERN, decodeChipKey, decodeVariant, encodeVariant, joinToken, splitToken, tokenVariant,
  variableAxes, variableForToken, variableOptionIds, variantLabelForToken, withVariant, type TokenParts,
} from './promptVariables';
import { corpusTokens } from '@/test/tokenCorpus';
import { parsePromptTemplate, renderPromptTemplate, serializeSegments } from './promptTemplate';
import { chipValues } from './chipValues/chipValues';
import { sampleChipScene } from './chipValues/sampleScene';
import { foreignTokens, spelledTokens } from '@/test/chipTokens';
import recorded from '@/test/tokenCorpus.recorded.json';

const ENTITIES = variableForToken('<ENTITIES>')!;
const PERSONA = variableForToken('<PERSONA>')!;
const STATS = variableForToken('<STATS DESCRIPTION>')!;

const ROSTER_IDS = ['withstats', 'withtraits', 'notraits', 'norange', 'nodescriptor', 'nodescription'];

/** The template as the parser splits it: each segment's kind and text. */
const segments = (text: string) => parsePromptTemplate(text).map((s) => (s.type === 'text' ? `text:${s.value}` : `chip:${s.token}`));

const allDefault = (base: string) => decodeVariant(variableForToken(base)!, null);

describe('shipped spellings', () => {
  // Every token in the app's source and bundled worlds, as the cross-product parser read it.
  const entries = recorded as { token: string; parts: TokenParts; selection: Record<string, string | null> }[];

  it('covers the default prompts and every bundled world', () => {
    expect(entries.length).toBeGreaterThan(100);
    for (const base of ['<ENTITIES>', '<PERSONA>', '<LOCATION>', '<STATS DESCRIPTION>', '<DICTIONARY>']) {
      expect(entries.some((e) => e.parts.base === base && e.parts.variantId), base).toBe(true);
    }
  });

  it('reads every token the app ships today with a key the value lookup accepts', () => {
    const tokens = corpusTokens(TOKEN_PATTERN);
    expect(tokens.length).toBeGreaterThan(100);
    for (const token of tokens) expect(decodeChipKey(splitToken(token)!.key), token).toBeDefined();
  });

  it.each(entries)('parses $token to the same pieces and selection as before', ({ token, parts, selection }) => {
    expect(segments(token)).toEqual([`chip:${token}`]);
    expect(splitToken(token)).toEqual(parts);
    expect(joinToken(splitToken(token)!)).toBe(token);
    expect(decodeVariant(variableForToken(token)!, tokenVariant(token))).toEqual({ ...allDefault(parts.base), ...selection });
  });
});

describe('the roster ids', () => {
  it('are distinct, plain words, and apart from the Stats chip ids', () => {
    for (const variable of ALL_PROMPT_VARIABLES) {
      const ids = variableOptionIds(variable);
      expect(new Set(ids).size, variable.token).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
    }
    for (const id of [...ROSTER_IDS, 'stats']) expect(variableOptionIds(STATS)).not.toContain(id);
    for (const id of ROSTER_IDS) {
      expect(variableOptionIds(ENTITIES)).toContain(id);
      expect(variableOptionIds(PERSONA)).toContain(id);
    }
  });

  it('give Sub-Locations and Reachable a stats-on id and leave the persona without one', () => {
    expect(decodeVariant(ENTITIES, 'sublocations.stats')).toMatchObject({ scope: 'sublocations', stats: 'stats' });
    expect(decodeVariant(ENTITIES, 'reachable.stats')).toMatchObject({ scope: 'reachable', stats: 'stats' });
    expect(variableOptionIds(PERSONA)).not.toContain('stats');
    expect(segments('<PERSONA|stats>')).toEqual(['text:<PERSONA|stats>']);
  });

  it.each(['<ENTITIES>', '<PERSONA>'])('round-trip byte for byte on %s', (base) => {
    const tokens = spelledTokens(base);
    expect(tokens.filter((t) => ROSTER_IDS.some((id) => t.includes(id))).length).toBeGreaterThan(100);
    for (const token of tokens) {
      const variable = variableForToken(token)!;
      expect(withVariant(base, encodeVariant(variable, decodeVariant(variable, tokenVariant(token))))).toBe(token);
      expect(splitToken(token)?.key).toBe(token);
      const placed = joinToken({ ...splitToken(token)!, pre: 'Cast: ', header: 'Who' });
      expect(serializeSegments(parsePromptTemplate(placed))).toBe(placed);
    }
  });

  it('encode in registry order, and an unchanged selection encodes to the bare token', () => {
    expect(encodeVariant(ENTITIES, { ...allDefault('<ENTITIES>'), format: 'xml', withtraits: 'withtraits', scope: 'inscene', range: 'norange' }))
      .toBe('inscene.withtraits.norange.xml');
    expect(encodeVariant(PERSONA, { ...allDefault('<PERSONA>'), description: 'nodescription', traits: 'notraits', withstats: 'withstats' }))
      .toBe('withstats.notraits.nodescription');
    expect(encodeVariant(ENTITIES, allDefault('<ENTITIES>'))).toBeNull();
    expect(encodeVariant(PERSONA, allDefault('<PERSONA>'))).toBeNull();
  });
});

describe('the parser', () => {
  it('reads ids in any order as the same selection, with the canonical key', () => {
    const parts = splitToken('<ENTITIES|xml.notraits.withstats.inscene|pre="With "|header="Cast">')!;
    expect(parts.variantId).toBe('xml.notraits.withstats.inscene');
    expect(parts.key).toBe('<ENTITIES|inscene.withstats.notraits.xml>');
    expect(decodeVariant(ENTITIES, parts.variantId)).toEqual(decodeVariant(ENTITIES, 'inscene.withstats.notraits.xml'));
    expect(splitToken('<STATS DESCRIPTION|markdown.meaning.numbers>')?.key).toBe('<STATS DESCRIPTION|numbers.meaning.markdown>');
  });

  it('keeps an any-order spelling as typed', () => {
    const text = 'A <PERSONA|markdown.nodescriptor|header="Player"> B';
    expect(segments(text)).toEqual(['text:A ', 'chip:<PERSONA|markdown.nodescriptor|header="Player">', 'text: B']);
    expect(serializeSegments(parsePromptTemplate(text))).toBe(text);
  });

  it('decodes a repeated id, or two ids of one axis, last-wins', () => {
    expect(splitToken('<ENTITIES|norange.norange>')?.key).toBe('<ENTITIES|norange>');
    expect(splitToken('<ENTITIES|markdown.xml>')?.key).toBe('<ENTITIES|xml>');
    expect(splitToken('<ENTITIES|sublocations.stats.nostats>')?.key).toBe('<ENTITIES|sublocations.nostats>');
    expect(splitToken('<ENTITIES|nostats.stats>')?.key).toBe('<ENTITIES|stats>');
    expect(splitToken('<ENTITIES|reachable.summary.inscene>')?.key).toBe('<ENTITIES|inscene.summary>');
  });

  it.each([
    '<ENTITIES|bogus>', '<ENTITIES|summary.bogus>', '<ENTITIES|summary.>', '<ENTITIES|.summary>', '<ENTITIES|numbers>',
    '<STATS DESCRIPTION|norange>', '<LOCATION|withstats>', '<NOTES|markdown>', '<ENTITIES|Summary>', '<ENTITIES|summary..xml>',
  ])('leaves %s as text', (token) => {
    expect(segments(`x ${token} y`)).toEqual([`text:x ${token} y`]);
    expect(splitToken(token)).toBeNull();
  });

  it.each(ALL_PROMPT_VARIABLES.map((v) => v.token))('leaves %s with another chip\'s id as text', (base) => {
    for (const token of foreignTokens(base)) {
      expect(segments(token), token).toEqual([`text:${token}`]);
      expect(splitToken(token), token).toBeNull();
    }
  });
});

describe('the chip label', () => {
  it('never names a roster id or the stats-on id', () => {
    for (const id of ROSTER_IDS) {
      expect(variantLabelForToken(`<ENTITIES|${id}>`), id).toBeNull();
      expect(variantLabelForToken(`<PERSONA|${id}>`), id).toBeNull();
    }
    expect(variantLabelForToken('<ENTITIES|withstats.withtraits.notraits.norange.nodescriptor.nodescription>')).toBeNull();
    expect(variantLabelForToken('<ENTITIES|sublocations.stats>')).toBe('In Sub');
    expect(variantLabelForToken('<ENTITIES|inscene.withstats.summary.notraits.markdown>')).toBe('In Scene, Summary, Markdown');
    expect(variantLabelForToken('<PERSONA|nostats.norange>')).toBe('No Stats');
  });
});

describe('lock groups', () => {
  const groups = (base: string) => Object.fromEntries(
    variableAxes(variableForToken(base)!).filter((a) => a.toggle).map((a) => [a.id, a.lockGroup ?? null]),
  );

  it('group the Stats chip pieces, and the Stat Detail pieces of each roster chip', () => {
    expect(groups('<STATS DESCRIPTION>')).toEqual({ numbers: 'statDetail', descriptions: 'statDetail', meaning: 'statDetail' });
    const roster = {
      withstats: null, withtraits: null, traits: null, stats: null,
      range: 'statDetail', descriptor: 'statDetail', description: 'statDetail',
    };
    expect(groups('<ENTITIES>')).toEqual(roster);
    expect(groups('<PERSONA>')).toEqual(roster);
  });
});

describe('rendering the roster ids', () => {
  const values = chipValues(sampleChipScene());

  it.each(['<ENTITIES>', '<PERSONA>'])('renders every %s spelling that carries a roster id, never as raw token text', (base) => {
    for (const token of spelledTokens(base)) {
      const value = values(token);
      expect(value, token).toEqual(expect.any(String));
      expect(value, token).not.toContain(base.slice(0, -1));
    }
  });

  it('renders an any-order or repeated spelling as its canonical one, not as raw text', () => {
    const canonical = renderPromptTemplate('<ENTITIES|inscene.summary.markdown>', values);
    expect(canonical).not.toContain('<ENTITIES');
    expect(renderPromptTemplate('<ENTITIES|markdown.summary.inscene>', values)).toBe(canonical);
    expect(renderPromptTemplate('<ENTITIES|summary.inscene.markdown.markdown>', values)).toBe(canonical);
    expect(renderPromptTemplate('<PERSONA|xml.name>', values)).toBe(renderPromptTemplate('<PERSONA|name.xml>', values));
  });
});
