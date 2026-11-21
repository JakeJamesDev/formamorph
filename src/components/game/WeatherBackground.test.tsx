import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { WeatherBackground } from './WeatherBackground';

let frames: Map<number, FrameRequestCallback>;
let nextId: number;

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

/** Runs the frames queued so far, once each, as the browser would on its next paint. */
const paint = () => {
  const queued = [...frames.entries()];
  frames.clear();
  for (const [, cb] of queued) cb(performance.now());
};

beforeEach(() => {
  frames = new Map();
  nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(nextId, cb); return nextId++; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const ctx = new Proxy({}, {
    get: (_t, name) => (name === 'createLinearGradient' ? () => ({ addColorStop: () => {} }) : () => {}),
    set: () => true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  setHidden(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setHidden(false);
});

describe('the Weather Background', () => {
  it('mounts no canvas and queues no frame while it shows nothing', () => {
    render(<WeatherBackground kind={null} mode="none" plain={false} />);
    expect(screen.queryByTestId('weather-background')).toBeNull();
    expect(frames.size).toBe(0);
  });

  it('keeps drawing a kind, frame after frame', () => {
    render(<WeatherBackground kind="rain" mode="full" plain={false} />);
    expect(screen.getByTestId('weather-background').dataset.weatherKind).toBe('rain');
    for (let i = 0; i < 3; i++) {
      expect(frames.size).toBe(1);
      paint();
    }
    expect(frames.size).toBe(1);
  });

  it('stops drawing while the page is hidden and starts again when it shows', () => {
    render(<WeatherBackground kind="storm" mode="full" plain={false} />);
    paint();
    act(() => setHidden(true));
    expect(frames.size).toBe(0);
    act(() => setHidden(false));
    expect(frames.size).toBe(1);
  });

  it('stops drawing when the weather turns to nothing', () => {
    const { rerender } = render(<WeatherBackground kind="snow" mode="full" plain={false} />);
    paint();
    rerender(<WeatherBackground kind={null} mode="none" plain={false} />);
    expect(screen.queryByTestId('weather-background')).toBeNull();
    expect(frames.size).toBe(0);
  });
});
