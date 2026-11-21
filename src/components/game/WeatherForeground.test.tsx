import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { WeatherForeground } from './WeatherForeground';
import { FOREGROUND_DURATION } from './weatherForegroundEffects';

let frames: Map<number, FrameRequestCallback>;
let nextId: number;

/** Runs the frames queued so far at `ms`, as the browser would on its next paint. */
const paint = (ms: number) => act(() => {
  const queued = [...frames.values()];
  frames.clear();
  for (const cb of queued) cb(ms);
});

beforeEach(() => {
  frames = new Map();
  nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(nextId, cb); return nextId++; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  const gradient = () => ({ addColorStop: () => {} });
  const ctx = new Proxy({}, {
    get: (_t, name) => (name === 'createLinearGradient' || name === 'createRadialGradient' ? gradient : () => {}),
    set: () => true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const canvas = () => screen.queryByTestId('weather-foreground');

describe('the Weather Foreground', () => {
  it('shows nothing before any change, or with no kind to play', () => {
    const { rerender } = render(<WeatherForeground kind="rain" play={0} />);
    expect(canvas()).toBeNull();
    rerender(<WeatherForeground kind={null} play={1} />);
    expect(canvas()).toBeNull();
    expect(frames.size).toBe(0);
  });

  it('plays for its length, then removes itself and stops drawing', () => {
    render(<WeatherForeground kind="storm" play={1} />);
    expect(canvas()?.dataset.weatherKind).toBe('storm');
    paint(1000);
    paint(1000 + FOREGROUND_DURATION.storm * 500);
    expect(canvas()).not.toBeNull();
    paint(1000 + FOREGROUND_DURATION.storm * 1000);
    expect(canvas()).toBeNull();
    expect(frames.size).toBe(0);
  });

  it('does not play again on a redraw with the same change', () => {
    const { rerender } = render(<WeatherForeground kind="snow" play={3} />);
    paint(0);
    paint(1);
    paint(1 + FOREGROUND_DURATION.snow * 1000);
    rerender(<WeatherForeground kind="snow" play={3} />);
    expect(canvas()).toBeNull();
  });

  it('replaces a playing effect with a new one, which then plays its full length', () => {
    const { rerender } = render(<WeatherForeground kind="rain" play={1} />);
    paint(1);
    paint(1000);
    rerender(<WeatherForeground kind="brightSun" play={2} />);
    expect(screen.getAllByTestId('weather-foreground')).toHaveLength(1);
    expect(canvas()?.dataset.weatherKind).toBe('brightSun');
    expect(frames.size).toBe(1);
    paint(2000);
    // Past where the rain would have ended, inside the new effect's length.
    paint(2000 + FOREGROUND_DURATION.brightSun * 900);
    expect(canvas()?.dataset.weatherKind).toBe('brightSun');
  });

  it('never plays a change that arrived with nothing to play, when the switch turns on later', () => {
    const { rerender } = render(<WeatherForeground kind={null} play={1} />);
    rerender(<WeatherForeground kind="rain" play={1} />);
    expect(canvas()).toBeNull();
    expect(frames.size).toBe(0);
  });

  it('does not restart when the switch goes off and on mid-play', () => {
    const { rerender } = render(<WeatherForeground kind="rain" play={1} />);
    paint(1);
    rerender(<WeatherForeground kind={null} play={1} />);
    expect(canvas()).toBeNull();
    rerender(<WeatherForeground kind="rain" play={1} />);
    expect(canvas()).toBeNull();
  });

  it('stops at once when a change with no effect comes in', () => {
    const { rerender } = render(<WeatherForeground kind="rain" play={1} />);
    paint(1);
    rerender(<WeatherForeground kind={null} play={2} />);
    expect(canvas()).toBeNull();
    expect(frames.size).toBe(0);
  });
});
