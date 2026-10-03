import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVEAL_BLUR_AMOUNT, DEFAULT_REVEAL_EASING, DEFAULT_REVEAL_FADE, DEFAULT_REVEAL_MIN_DURATION,
  DEFAULT_REVEAL_MIN_STAGGER, DEFAULT_REVEAL_MOVE, DEFAULT_REVEAL_MOVE_DIRECTION, DEFAULT_REVEAL_MOVE_DISTANCE,
  DEFAULT_REVEAL_SCALE, DEFAULT_REVEAL_SCALE_AMOUNT, DEFAULT_REVEAL_SCALE_DIRECTION, DEFAULT_REVEAL_SCALE_MODE,
  DEFAULT_REVEAL_BLUR, DEFAULT_STAGGER, DEFAULT_DURATION, REVEAL_EASINGS,
} from '@/lib/narrationRevealConfig';
import { DEFAULT_HELP_REVEAL, helpRevealSpec, helpRevealTiming, parseHelpReveal } from './helpReveal';

describe('help reveal values', () => {
  it("start at narration's defaults", () => {
    expect(DEFAULT_HELP_REVEAL).toEqual({
      fade: DEFAULT_REVEAL_FADE,
      move: DEFAULT_REVEAL_MOVE,
      moveDirection: DEFAULT_REVEAL_MOVE_DIRECTION,
      moveDistance: DEFAULT_REVEAL_MOVE_DISTANCE,
      scale: DEFAULT_REVEAL_SCALE,
      scaleMode: DEFAULT_REVEAL_SCALE_MODE,
      scaleDirection: DEFAULT_REVEAL_SCALE_DIRECTION,
      scaleAmount: DEFAULT_REVEAL_SCALE_AMOUNT,
      blur: DEFAULT_REVEAL_BLUR,
      blurAmount: DEFAULT_REVEAL_BLUR_AMOUNT,
      easing: DEFAULT_REVEAL_EASING,
      minDuration: DEFAULT_REVEAL_MIN_DURATION,
      minStagger: DEFAULT_REVEAL_MIN_STAGGER,
    });
  });

  it('keep every good stored value', () => {
    const stored = {
      fade: false, move: true, moveDirection: 'left', moveDistance: 1.25, scale: true, scaleMode: 'axis',
      scaleDirection: 'top', scaleAmount: 0.6, blur: true, blurAmount: 9, easing: REVEAL_EASINGS[2].value,
      minDuration: 600, minStagger: 75,
    };
    expect(parseHelpReveal(stored)).toEqual(stored);
  });

  it.each([
    ['fade', 'yes'],
    ['moveDirection', 'up'],
    ['moveDistance', 9],
    ['scaleMode', 'squash'],
    ['scaleAmount', 0],
    ['blurAmount', 2.5],
    ['easing', 'steps(4)'],
    ['minDuration', -50],
    ['minStagger', 151],
  ] as const)('take the default for a bad %s', (key, bad) => {
    const parsed = parseHelpReveal({ ...DEFAULT_HELP_REVEAL, move: true, [key]: bad });
    expect(parsed[key]).toEqual(DEFAULT_HELP_REVEAL[key]);
    expect(parsed.move).toBe(true);
  });

  it('take the defaults for a value that is not an object', () => {
    expect(parseHelpReveal('fade')).toEqual(DEFAULT_HELP_REVEAL);
    expect(parseHelpReveal(undefined)).toEqual(DEFAULT_HELP_REVEAL);
  });
});

describe('helpRevealSpec', () => {
  const moving = { ...DEFAULT_HELP_REVEAL, move: true, scale: true, blur: true };

  it('turns Move and Scale off under reduced motion, and keeps Fade and Blur', () => {
    const spec = helpRevealSpec(moving, true);
    expect(spec).toMatchObject({ fade: true, move: false, scale: false, blur: true });
  });

  it('keeps every effect without reduced motion', () => {
    expect(helpRevealSpec(moving, false)).toMatchObject({ move: true, scale: true });
  });
});

describe('helpRevealTiming', () => {
  it('runs at the default pace with no floors', () => {
    expect(helpRevealTiming({ ...DEFAULT_HELP_REVEAL, minDuration: 0, minStagger: 0 }))
      .toEqual({ stagger: DEFAULT_STAGGER, duration: DEFAULT_DURATION });
  });

  it('never runs faster than the floors', () => {
    expect(helpRevealTiming({ ...DEFAULT_HELP_REVEAL, minDuration: 900, minStagger: 120 }))
      .toEqual({ stagger: 120, duration: 900 });
    expect(helpRevealTiming({ ...DEFAULT_HELP_REVEAL, minDuration: 0, minStagger: 120 }))
      .toEqual({ stagger: 120, duration: 480 });
  });
});
