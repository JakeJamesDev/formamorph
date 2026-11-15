import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPEAKER_PALETTE_SIZE, slotColor, speakerColors } from './speakerPalette';

type Vars = Record<string, string>;
type Block = { selectors: string[]; vars: Vars; body: string };

const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const blocks: Block[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selectors: selector.trim().split(/\s*,\s*/),
  vars: Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])),
  body,
}));

const varsOf = (selector: string): Vars =>
  Object.assign({}, ...blocks.filter((block) => block.selectors.includes(selector)).map((block) => block.vars));

const THEMES = [...new Set(blocks.flatMap((block) => block.selectors)
  .map((selector) => selector.match(/^\.(?:light|dark)\[data-theme="(\w+)"\]$/)?.[1])
  .filter((theme): theme is string => Boolean(theme)))];

/** Each theme's resolved variables in a mode: the mode's base block, then the theme's overrides. */
const themes = (mode: 'light' | 'dark') => {
  const base = varsOf(mode === 'light' ? ':root' : '.dark');
  return THEMES.map((theme) => ({ name: `${mode}/${theme}`, vars: { ...base, ...varsOf(`.${mode}[data-theme="${theme}"]`) } }));
};

type Rgb = [number, number, number];

function toRgb(hsl: string): Rgb {
  const [h, s, l] = hsl.split(/\s+/).map(parseFloat);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Narration sits on the turn card; the page background shows around it. */
const SURFACES = ['background', 'card'];
const TEXT_CONTRAST = 4.5;
const SLOTS = Array.from({ length: SPEAKER_PALETTE_SIZE }, (_, i) => i);

describe('the speaker palette', () => {
  it.each(['light', 'dark'] as const)('reads as text on every %s theme surface', (mode) => {
    const palette = varsOf(mode === 'light' ? ':root' : '.dark');
    const failures: string[] = [];
    for (const { name, vars } of themes(mode)) {
      for (const slot of SLOTS) {
        for (const surface of SURFACES) {
          const ratio = contrast(toRgb(palette[`speaker-${slot}`]), toRgb(vars[surface]));
          if (ratio < TEXT_CONTRAST) failures.push(`${name}/${surface}/speaker-${slot}: ${ratio.toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('defines one token per slot in each mode, and no more', () => {
    for (const selector of [':root', '.dark']) {
      const tokens = Object.keys(varsOf(selector)).filter((name) => /^speaker-\d+$/.test(name)).sort();
      expect(tokens).toEqual(SLOTS.map((slot) => `speaker-${slot}`).sort());
    }
  });

  it("puts a speaker's color ahead of the player's own quote color, then the palette's", () => {
    const rule = blocks.find((block) => block.selectors.includes(':root[data-quote-color] .dialogue-quote'));
    expect(rule?.body).toMatch(/color:\s*var\(--quote-speaker,\s*var\(--dialogue-custom,\s*hsl\(var\(--dialogue\)\)\)\)/);
  });

  it('paints speaker colors only while Quote Color is on', () => {
    const readers = blocks.filter((block) => block.body.includes('var(--quote-speaker'));
    expect(readers.length).toBeGreaterThan(0);
    expect(readers.flatMap((block) => block.selectors).every((selector) => selector.includes('[data-quote-color]'))).toBe(true);
  });
});

describe('speaker colors', () => {
  const cast = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `entity-${i}` }));

  it('gives the first eight cast members eight different colors', () => {
    expect(new Set(speakerColors(cast(8)).values()).size).toBe(SPEAKER_PALETTE_SIZE);
  });

  it('keeps an entity on its color when a runtime character joins after the world cast', () => {
    const before = speakerColors(cast(3));
    const after = speakerColors([...cast(3), { id: 'runtime-1' }]);
    expect(cast(3).map(({ id }) => after.get(id))).toEqual(cast(3).map(({ id }) => before.get(id)));
    expect(after.get('runtime-1')).toBe(slotColor(3));
  });

  it('gives the player no slot, so the cast after them keeps the first colors', () => {
    const colors = speakerColors([{ id: 'player' }, ...cast(2)], 'player');
    expect(colors.has('player')).toBe(false);
    expect(colors.get('entity-0')).toBe(slotColor(0));
  });

  it('wraps to the first color after eight', () => {
    expect(speakerColors(cast(9)).get('entity-8')).toBe(slotColor(0));
    expect(slotColor(0)).toBe('hsl(var(--speaker-0))');
  });
});

describe('the contrast check itself', () => {
  it('fails a color too faint for the surface', () => {
    expect(contrast(toRgb('45 85% 60%'), toRgb('0 0% 100%'))).toBeLessThan(TEXT_CONTRAST);
  });

  it('reads every theme in both modes', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(8);
    expect(themes('dark')[0].vars.card).toBeTruthy();
  });
});
