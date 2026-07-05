import { describe, it, expect } from 'vitest';
import { hexToRgb, hexToHslTriple, contrastForeground } from './color';

describe('hexToRgb', () => {
  it('parses 6- and 3-digit hex, with or without #', () => {
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
    expect(hexToRgb('000000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#a1dddd')).toEqual([161, 221, 221]);
  });

  it('returns null for malformed input', () => {
    expect(hexToRgb('nope')).toBeNull();
    expect(hexToRgb('#12g')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });
});

describe('hexToHslTriple', () => {
  it('handles pure white/black', () => {
    expect(hexToHslTriple('#ffffff')).toBe('0 0% 100%');
    expect(hexToHslTriple('#000000')).toBe('0 0% 0%');
  });

  it('converts the library default accent to ~hue 180 teal', () => {
    const triple = hexToHslTriple('#a1dddd');
    expect(triple).not.toBeNull();
    const [h, s, l] = triple!.split(' ');
    expect(Number(h)).toBe(180);
    expect(parseFloat(s)).toBeGreaterThan(40);
    expect(parseFloat(l)).toBeGreaterThan(70);
  });

  it('returns null for invalid hex', () => {
    expect(hexToHslTriple('teal')).toBeNull();
  });
});

describe('contrastForeground', () => {
  it('picks dark text on a light accent and light text on a dark accent', () => {
    expect(contrastForeground('#ffffff')).toBe('222.2 84% 4.9%');
    expect(contrastForeground('#a1dddd')).toBe('222.2 84% 4.9%');
    expect(contrastForeground('#000000')).toBe('210 40% 98%');
    expect(contrastForeground('#1a1a40')).toBe('210 40% 98%');
  });
});
