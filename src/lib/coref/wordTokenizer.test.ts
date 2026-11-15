import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pythonPattern, wordTokenize } from './wordTokenizer';

// spaCy en_core_web_sm's tokens for synthetic edge cases (scripts/coref/record_spacy_tokens.py).
const cases = JSON.parse(readFileSync(new URL('./__fixtures__/spacyTokens.json', import.meta.url), 'utf8')) as
  { text: string; tokens: [number, number][] }[];

describe('wordTokenize', () => {
  it.each(cases.map((c) => [c.text.slice(0, 40), c] as const))('splits like spaCy: %s', (_, c) => {
    const got = wordTokenize(c.text);
    expect(got.map((t) => [t.start, t.end])).toEqual(c.tokens);
    expect(got.every((t) => c.text.slice(t.start, t.end) === t.text)).toBe(true);
  });

  it('gives nothing for empty text', () => {
    expect(wordTokenize('')).toEqual([]);
  });
});

describe('pythonPattern', () => {
  it('rewrites Python-only escapes for a unicode JS RegExp', () => {
    const re = new RegExp(pythonPattern(String.raw`(?u)^[\U0001F600\-x]\'\w+\d$`), 'u');
    expect(re.test(`${String.fromCodePoint(0x1f600)}'café٣`)).toBe(true);
    expect(re.test("-'abc1")).toBe(true);
    expect(re.test("y'abc1")).toBe(false);
  });
});
