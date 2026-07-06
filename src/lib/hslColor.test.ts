import { describe, it, expect } from 'vitest';
import { parseHslTriple, hslToHex, hexToHsl, hexToHslTriple, hslTripleToHex } from './hslColor';

describe('parseHslTriple', () => {
  it('parses a token value', () => {
    expect(parseHslTriple('217 84% 56%')).toEqual({ h: 217, s: 84, l: 56 });
  });
  it('parses decimals and extra whitespace', () => {
    expect(parseHslTriple('  222.2 84% 4.9% ')).toEqual({ h: 222.2, s: 84, l: 4.9 });
  });
  it('rejects non-triples', () => {
    expect(parseHslTriple('0.5rem')).toBeNull();
    expect(parseHslTriple('#fff')).toBeNull();
  });
});

describe('hslToHex', () => {
  it('converts primaries', () => {
    expect(hslToHex(0, 0, 100)).toBe('#ffffff');
    expect(hslToHex(0, 0, 0)).toBe('#000000');
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(hslToHex(120, 100, 50)).toBe('#00ff00');
    expect(hslToHex(240, 100, 50)).toBe('#0000ff');
  });
});

describe('hexToHsl', () => {
  it('converts primaries', () => {
    expect(hexToHsl('#ffffff')).toEqual({ h: 0, s: 0, l: 100 });
    expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 });
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 100, l: 50 });
  });
});

describe('round-trips', () => {
  it('triple → hex → triple is stable within rounding', () => {
    const hex = hslTripleToHex('217 84% 56%');
    const back = parseHslTriple(hexToHslTriple(hex))!;
    expect(back.h).toBeCloseTo(217, -1);
    expect(back.s).toBeCloseTo(84, -1);
    expect(back.l).toBeCloseTo(56, -1);
  });
  it('falls back to black on a non-triple', () => {
    expect(hslTripleToHex('0.5rem')).toBe('#000000');
  });
});
