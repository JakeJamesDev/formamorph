import { describe, it, expect } from 'vitest';
import { statFieldStep, statFieldText } from './statValueField';

describe('statFieldText', () => {
  it('reads a value as a whole number', () => {
    expect(statFieldText(42)).toBe('42');
  });

  it('rounds the fractional value regen and stat code leave behind', () => {
    expect(statFieldText(41.6)).toBe('42');
    expect(statFieldText(0.4)).toBe('0');
  });
});

describe('statFieldStep — in range', () => {
  it('commits a typed value straight through', () => {
    expect(statFieldStep('42', 50, 0, 100)).toEqual({ text: '42', commit: 42 });
  });

  it('commits a value sitting exactly on either bound', () => {
    expect(statFieldStep('0', 50, 0, 100)).toEqual({ text: '0', commit: 0 });
    expect(statFieldStep('100', 50, 0, 100)).toEqual({ text: '100', commit: 100 });
  });

  it('commits a negative value inside a negative range', () => {
    expect(statFieldStep('-5', 0, -20, 20)).toEqual({ text: '-5', commit: -5 });
  });
});

describe('statFieldStep — clamping', () => {
  it('clamps above the max rather than letting the range break for a frame', () => {
    expect(statFieldStep('9999', 50, 0, 100)).toEqual({ text: '100', commit: 100 });
  });

  it('clamps below the min', () => {
    expect(statFieldStep('-40', 50, 0, 100)).toEqual({ text: '0', commit: 0 });
  });

  // Warmth in the dev fixture: min 10, so the first digit of "33" is itself below the floor. It clamps up
  // to the min on that keystroke like any other out-of-range entry — the range holds, and typing on.
  it('clamps a below-min first digit up to the min on a stat whose floor is above zero', () => {
    expect(statFieldStep('3', 33, 10, 50)).toEqual({ text: '10', commit: 10 });
  });

  it('clamps a value over the max of a stat whose floor is above zero', () => {
    expect(statFieldStep('88', 33, 10, 50)).toEqual({ text: '50', commit: 50 });
  });
});

describe('statFieldStep — nothing to commit', () => {
  it('lets the field go blank and holds the stat where it is', () => {
    expect(statFieldStep('', 42, 0, 100)).toEqual({ text: '', commit: null });
  });

  it('treats whitespace as blank rather than as a zero', () => {
    expect(statFieldStep('   ', 42, 0, 100)).toEqual({ text: '', commit: null });
  });

  it('refuses junk and snaps the text back to the committed value', () => {
    expect(statFieldStep('abc', 42, 0, 100)).toEqual({ text: '42', commit: null });
    expect(statFieldStep('-', 42, 0, 100)).toEqual({ text: '42', commit: null });
  });
});

describe('statFieldStep — whole numbers only', () => {
  it('drops a typed fraction, since the field steps by one', () => {
    expect(statFieldStep('37.9', 50, 0, 100)).toEqual({ text: '37', commit: 37 });
  });

  it('accepts a trailing decimal point mid-typing', () => {
    expect(statFieldStep('37.', 50, 0, 100)).toEqual({ text: '37', commit: 37 });
  });
});
