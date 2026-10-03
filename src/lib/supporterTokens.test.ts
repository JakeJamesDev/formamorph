import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUPPORTER_BADGE_STYLES } from '@/lib/supporterFlair';

type Vars = Record<string, string>;
type Block = { selectors: string[]; vars: Vars };

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const blocks: Block[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selectors: selector.trim().split(/\s*,\s*/),
  vars: Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])),
}));

const varsOf = (selector: string): Vars =>
  Object.assign({}, ...blocks.filter((block) => block.selectors.includes(selector)).map((block) => block.vars));

const THEMES = [...new Set(blocks.flatMap((block) => block.selectors)
  .map((selector) => selector.match(/^\.(?:light|dark)\[data-theme="(\w+)"\]$/)?.[1])
  .filter((theme): theme is string => Boolean(theme)))];

/** Every palette's resolved variables in each mode: the mode's base block, then the palette's overrides. */
function palettes(mode: 'light' | 'dark'): { name: string; vars: Vars }[] {
  const base = varsOf(mode === 'light' ? ':root' : '.dark');
  return THEMES.map((theme) => ({ name: `${mode}/${theme}`, vars: { ...base, ...varsOf(`.${mode}[data-theme="${theme}"]`) } }));
}

type Rgb = [number, number, number];

function toRgb(hsl: string): Rgb {
  const [h, s, l] = hsl.split(/\s+/).map(parseFloat);
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
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

const mix = (from: Rgb, to: Rgb, amount: number): Rgb => from.map((v, i) => v * (1 - amount) + to[i] * amount) as Rgb;

/** The surfaces a username or a badge rests on. */
const SURFACES = ['background', 'card', 'popover', 'muted', 'accent', 'secondary'];
/** High Contrast fills these two with mid grays that no hue clears at 4.5:1. */
const SKIPPED = new Set(['highcontrast/accent', 'highcontrast/secondary']);
/** The strongest tint in the badge classes, read from them so the two cannot drift apart. */
const STRONGEST_TINT = Math.max(
  ...Object.values(SUPPORTER_BADGE_STYLES).flatMap((classes) => [...classes.matchAll(/bg-supporter[\w-]*\/(\d+)/g)].map(([, n]) => Number(n) / 100)),
);
const TEXT_CONTRAST = 4.5;

describe.each(['supporter', 'supporter-plus'])('the %s color token', (token) => {
  it.each(['light', 'dark'] as const)('reads as text on every %s palette surface, bare and under its badge tint', (mode) => {
    const failures: string[] = [];
    for (const { name, vars } of palettes(mode)) {
      const color = toRgb(varsOf(mode === 'light' ? ':root' : '.dark')[token]);
      for (const surface of SURFACES) {
        if (SKIPPED.has(`${name.split('/')[1]}/${surface}`)) continue;
        const bg = toRgb(vars[surface]);
        const worst = Math.min(contrast(color, bg), contrast(color, mix(bg, color, STRONGEST_TINT)));
        if (worst < TEXT_CONTRAST) failures.push(`${name}/${surface}: ${worst.toFixed(2)}`);
      }
    }

    expect(failures).toEqual([]);
  });
});

describe('the contrast check itself', () => {
  it('fails a color that is too faint for the surface', () => {
    expect(contrast(toRgb('12 80% 60%'), toRgb('0 0% 100%'))).toBeLessThan(TEXT_CONTRAST);
  });

  it('reads the strongest badge tint from the badge classes', () => {
    expect(STRONGEST_TINT).toBe(0.15);
  });

  it('reads every palette in both modes', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(8);
    expect(palettes('dark')[0].vars.background).toBeTruthy();
  });
});
