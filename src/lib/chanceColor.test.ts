import { describe, it, expect } from 'vitest';
import { accentAtChance, BENCHED, chanceChipStyle, relativeChance } from './chanceColor';

const SECONDARY = {
  backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', opacity: 1,
};

describe('relativeChance (chance against the strongest sibling)', () => {
  it('gives every value of an even split the full 100', () => {
    expect(relativeChance(25, [25, 25, 25, 25])).toBe(100);
  });

  it('scales a weaker value against the strongest one', () => {
    // Weights 3,1,1,1 → chances 50,16.7,16.7,16.7 → the three light ones sit at a third.
    const chances = [50, 50 / 3, 50 / 3, 50 / 3];
    expect(relativeChance(chances[0], chances)).toBe(100);
    expect(relativeChance(chances[1], chances)).toBeCloseTo(100 / 3);
  });

  it('leaves a benched value at 0 and out of the max', () => {
    expect(relativeChance(0, [0, 100])).toBe(0);
    expect(relativeChance(100, [0, 100])).toBe(100);
  });

  it('reads 0 when no sibling can be drawn at all', () => {
    expect(relativeChance(0, [0, 0])).toBe(0);
    expect(relativeChance(0, [])).toBe(0);
  });

  it('clamps to the ramp', () => {
    expect(relativeChance(120, [100])).toBe(100);
    expect(relativeChance(-5, [100])).toBe(0);
  });
});

describe('chanceChipStyle (plain-text value chips)', () => {
  it('is the ordinary secondary chip at full, so an even split changes nothing', () => {
    expect(chanceChipStyle(100)).toEqual(SECONDARY);
  });

  it('is the benched look at 0, so a weight-0 value reads as off', () => {
    expect(chanceChipStyle(0)).toEqual(BENCHED);
    expect(BENCHED.opacity).toBeLessThan(1);
  });

  it('mixes toward the benched look between the two, opacity fading alongside', () => {
    const third = chanceChipStyle(100 / 3);
    expect(third.backgroundColor).toBe('color-mix(in oklab, hsl(var(--secondary)) 33%, hsl(var(--muted)))');
    expect(third.color)
      .toBe('color-mix(in oklab, hsl(var(--secondary-foreground)) 33%, hsl(var(--muted-foreground)))');
    expect(third.opacity).toBeGreaterThan(BENCHED.opacity);
    expect(third.opacity).toBeLessThan(1);
  });

  it('keeps its text readable at 75%: the background mixes surface tokens only, the text foreground tokens only', () => {
    // Each channel stays on its own side, so the pair never converges on one mid tone.
    const { backgroundColor, color, opacity } = chanceChipStyle(75);
    expect(backgroundColor).toBe('color-mix(in oklab, hsl(var(--secondary)) 75%, hsl(var(--muted)))');
    expect(color).toBe('color-mix(in oklab, hsl(var(--secondary-foreground)) 75%, hsl(var(--muted-foreground)))');
    expect(backgroundColor).not.toMatch(/foreground/);
    expect(color).not.toMatch(/--(secondary|muted)\)/);
    expect(opacity).toBeGreaterThan(0.85);
  });

  it('clamps to the ends of the ramp', () => {
    expect(chanceChipStyle(-5)).toEqual(chanceChipStyle(0));
    expect(chanceChipStyle(140)).toEqual(chanceChipStyle(100));
  });
});

describe('accentAtChance (reference chips)', () => {
  it('wears the whole accent at 100, with dark text and full opacity', () => {
    expect(accentAtChance('#fde68a', 100)).toEqual({ backgroundColor: 'hsl(48, 97%, 77%)', color: '#000', opacity: 1 });
  });

  it('keeps the hue and scales the saturation with the relative chance', () => {
    expect(accentAtChance('#fde68a', 50).backgroundColor).toBe('hsl(48, 49%, 77%)');
    expect(accentAtChance('#fde68a', 1).backgroundColor).toBe('hsl(48, 1%, 77%)');
    expect(accentAtChance('#fde68a', 1).opacity).toBe(1);
  });

  it('snaps to the same benched look as a plain chip at 0', () => {
    expect(accentAtChance('#fde68a', 0)).toEqual(chanceChipStyle(0));
    expect(accentAtChance('#fde68a', -20)).toEqual(chanceChipStyle(0));
  });
});
