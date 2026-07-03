import { describe, it, expect } from 'vitest';
import { normalizeBooruTags } from './imagePrompt';

describe('normalizeBooruTags', () => {
  it('splits CamelCase/PascalCase joined tokens into spaced words', () => {
    expect(normalizeBooruTags('ModernSuburbanHome, BackyardPool')).toBe('modern suburban home, backyard pool');
  });

  it('handles acronym boundaries (HTMLParser → html parser)', () => {
    expect(normalizeBooruTags('HTMLParser')).toBe('html parser');
  });

  it('turns underscores into spaces', () => {
    expect(normalizeBooruTags('silver_hair, white_picket_fence')).toBe('silver hair, white picket fence');
  });

  it('lowercases and strips stray punctuation', () => {
    expect(normalizeBooruTags('Silver Hair!, (Outdoors).')).toBe('silver hair, outdoors');
  });

  it('splits on newlines as well as commas', () => {
    expect(normalizeBooruTags('1girl\nsilver hair\noutdoors')).toBe('1girl, silver hair, outdoors');
  });

  it('dedupes case-insensitively and drops empty segments', () => {
    expect(normalizeBooruTags('Outdoors, outdoors, , day,')).toBe('outdoors, day');
  });

  it('preserves count tags like 1girl', () => {
    expect(normalizeBooruTags('1girl, solo')).toBe('1girl, solo');
  });
});
