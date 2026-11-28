import { describe, expect, it } from 'vitest';
import { COMMON_LANGUAGES, aiLanguageCode, deviceLanguageCode } from '@/lib/languages';

/** The server's list. It stores any other value but `other` as `unknown`. */
const SERVER_CODES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'pl', 'uk', 'zh', 'ja', 'ko', 'ar', 'hi', 'tr', 'vi', 'id'];

describe('aiLanguageCode', () => {
  it('has a code the server accepts for every suggestion, one each', () => {
    const codes = COMMON_LANGUAGES.map(aiLanguageCode);
    expect(codes).not.toContain('other');
    expect(new Set(codes).size).toBe(COMMON_LANGUAGES.length);
    expect(codes.filter((code) => !SERVER_CODES.includes(code))).toEqual([]);
  });

  it.each([
    ['', 'en'], ['   ', 'en'], ['English', 'en'], [' english ', 'en'],
    ['French', 'fr'], ['  PORTUGUESE ', 'pt'],
    ['pirate speak', 'other'], ['formal English', 'other'], ['constructor', 'other'],
  ])('maps %j to %s', (typed, code) => {
    expect(aiLanguageCode(typed)).toBe(code);
  });
});

describe('deviceLanguageCode', () => {
  it.each([
    ['pt-BR', 'pt-BR'], ['zh-Hant-TW', 'zh-TW'], ['fr', 'fr'], ['PT-br', 'pt-BR'],
    ['es-419', 'es-419'], ['de-DE-u-co-phonebk', 'de-DE'],
    ['', 'unknown'], ['pirate speak', 'unknown'], ['en_US', 'unknown'],
    // Parses, but names no language.
    ['und', 'unknown'], ['und-US', 'unknown'],
  ])('maps %j to %s', (tag, code) => {
    expect(deviceLanguageCode(tag)).toBe(code);
  });
});
