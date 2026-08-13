import { describe, it, expect } from 'vitest';
import {
  FONT_TUNING_BASE, FONT_TUNING_RANGES, boldWeightRange, boldWeightFor, diffFromDefaults, fontTuningDefaults,
  fontTuningMapCodec, fontTuningVars, isFontTuningDefault, resolveFontTuning, withFontTuning,
} from './fontTuning';

describe('fontTuningDefaults', () => {
  it('gives an untuned font the shared baseline', () => {
    expect(fontTuningDefaults('inter')).toEqual(FONT_TUNING_BASE);
  });

  it('ships JetBrains Mono at bold weight 800', () => {
    expect(fontTuningDefaults('jetbrainsmono').boldWeight).toBe(800);
  });

  it('treats the system font as tunable like any other', () => {
    expect(fontTuningDefaults('system')).toEqual(FONT_TUNING_BASE);
  });
});

describe('bold weight', () => {
  it('caps the slider at a variable font’s axis maximum', () => {
    expect(boldWeightRange('jetbrainsmono').max).toBe(800);
    expect(boldWeightRange('inter').max).toBe(900);
    // The shared ceiling is 1000, so a font's own axis is what decides its slider.
    expect(boldWeightRange('jetbrainsmono').max).toBeLessThan(FONT_TUNING_RANGES.boldWeight.max);
  });

  it('caps the slider at 700 for a static face', () => {
    expect(boldWeightRange('lato').max).toBe(700);
  });

  it('puts bold a step above semibold', () => {
    expect(boldWeightFor('inter', { ...FONT_TUNING_BASE, boldWeight: 600 })).toBe(700);
  });

  it('floors the slider at the app’s stock semibold, so bold can’t go lighter than body', () => {
    expect(FONT_TUNING_RANGES.boldWeight.min).toBe(600);
  });

  it('clamps bold to the axis maximum rather than running past it', () => {
    expect(boldWeightFor('jetbrainsmono', { ...FONT_TUNING_BASE, boldWeight: 800 })).toBe(800);
    expect(boldWeightFor('lato', { ...FONT_TUNING_BASE, boldWeight: 700 })).toBe(700);
  });
});

describe('resolveFontTuning', () => {
  it('lays stored overrides over the font’s shipped defaults', () => {
    const t = resolveFontTuning('jetbrainsmono', { jetbrainsmono: { scale: 1.2 } });
    expect(t.scale).toBe(1.2);
    expect(t.boldWeight).toBe(800); // untouched field still comes from the registry
  });

  it('keeps each font on its own entry', () => {
    const map = { inter: { scale: 1.4 }, lato: { scale: 0.8 } };
    expect(resolveFontTuning('inter', map).scale).toBe(1.4);
    expect(resolveFontTuning('lato', map).scale).toBe(0.8);
    expect(resolveFontTuning('roboto', map).scale).toBe(1);
  });

  it('clamps an out-of-range stored value into the slider’s bounds', () => {
    expect(resolveFontTuning('inter', { inter: { scale: 9 } }).scale).toBe(1.5);
    expect(resolveFontTuning('lato', { lato: { boldWeight: 900 } }).boldWeight).toBe(700);
    expect(resolveFontTuning('lato', { lato: { boldWeight: 100 } }).boldWeight).toBe(600);
    expect(resolveFontTuning('inter', { inter: { italicSkew: 40 } }).italicSkew).toBe(15);
  });
});

describe('storage shape', () => {
  it('stores only what differs from the shipped defaults', () => {
    const tuning = { ...fontTuningDefaults('jetbrainsmono'), scale: 1.1 };
    expect(diffFromDefaults('jetbrainsmono', tuning)).toEqual({ scale: 1.1 });
  });

  it('drops a font’s entry once it is back at its defaults', () => {
    const map = withFontTuning({ inter: { scale: 1.3 } }, 'inter', fontTuningDefaults('inter'));
    expect(map).not.toHaveProperty('inter');
  });

  it('round-trips through the codec', () => {
    const map = { inter: { scale: 1.2 }, system: { letterSpacing: 0.02 } };
    expect(fontTuningMapCodec.parse(fontTuningMapCodec.serialize(map))).toEqual(map);
  });

  it('throws on a blob that is not a map, so the caller falls back to defaults', () => {
    expect(() => fontTuningMapCodec.parse('[1,2]')).toThrow();
    expect(() => fontTuningMapCodec.parse('null')).toThrow();
  });

  it('drops junk fields and non-numeric values instead of storing them', () => {
    expect(fontTuningMapCodec.parse('{"inter":{"scale":1.2,"scale2":5,"boldWeight":"x"}}'))
      .toEqual({ inter: { scale: 1.2 } });
    expect(fontTuningMapCodec.parse('{"inter":"nope"}')).toEqual({});
  });
});

describe('isFontTuningDefault', () => {
  it('is true at the font’s shipped tuning, not at the bare baseline', () => {
    expect(isFontTuningDefault('jetbrainsmono', fontTuningDefaults('jetbrainsmono'))).toBe(true);
    expect(isFontTuningDefault('jetbrainsmono', FONT_TUNING_BASE)).toBe(false);
  });
});

describe('fontTuningVars', () => {
  it('names every variable under the given prefix', () => {
    expect(fontTuningVars('jetbrainsmono', fontTuningDefaults('jetbrainsmono'), '--fm-')).toEqual({
      '--fm-weight-semibold': '800',
      '--fm-weight-bold': '800',
      '--fm-italic-skew': '0deg',
      '--fm-line-height': '1',
      '--fm-letter-spacing': '0em',
    });
  });
});
