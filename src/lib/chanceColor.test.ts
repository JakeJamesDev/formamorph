import { describe, it, expect } from 'vitest';
import { accentAtChance, chanceChipStyle } from './chanceColor';

describe('chanceChipStyle (plain-text value chips)', () => {
  it('reads muted at 0%, so a benched value looks off', () => {
    expect(chanceChipStyle(0)).toEqual({ backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' });
  });

  it('reads as chips always have at 50%', () => {
    expect(chanceChipStyle(50)).toEqual({
      backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))',
    });
  });

  it('reads primary at 100%, so a certain value looks fixed', () => {
    expect(chanceChipStyle(100)).toEqual({
      backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))',
    });
  });

  it('mixes the two nearest stops between them, foreground alongside background', () => {
    expect(chanceChipStyle(25)).toEqual({
      backgroundColor: 'color-mix(in oklab, hsl(var(--muted)) 50%, hsl(var(--secondary)))',
      color: 'color-mix(in oklab, hsl(var(--muted-foreground)) 50%, hsl(var(--secondary-foreground)))',
    });
    expect(chanceChipStyle(90).backgroundColor)
      .toBe('color-mix(in oklab, hsl(var(--secondary)) 20%, hsl(var(--primary)))');
  });

  it('clamps to the ends of the ramp', () => {
    expect(chanceChipStyle(-5)).toEqual(chanceChipStyle(0));
    expect(chanceChipStyle(140)).toEqual(chanceChipStyle(100));
  });
});

describe('accentAtChance (reference chips)', () => {
  it('keeps the whole accent at 100%', () => {
    expect(accentAtChance('#fde68a', 100)).toBe('hsl(48, 97%, 77%)');
  });

  it('keeps the hue and scales the saturation with the chance', () => {
    expect(accentAtChance('#fde68a', 50)).toBe('hsl(48, 49%, 77%)');
  });

  it('floors at a neutral gray of the same lightness', () => {
    expect(accentAtChance('#fde68a', 0)).toBe('hsl(48, 0%, 77%)');
    expect(accentAtChance('#fde68a', -20)).toBe(accentAtChance('#fde68a', 0));
  });
});
