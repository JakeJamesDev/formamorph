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

describe('the masked Weather Background', () => {
  /** Images waiting to load; `load` reports each at 1600 by 900. */
  let pending: { src: string; onload: (() => void) | null; naturalWidth: number; naturalHeight: number }[];
  const load = () => act(() => { for (const img of pending.splice(0)) img.onload?.(); });
  beforeEach(() => {
    pending = [];
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      naturalWidth = 1600;
      naturalHeight = 900;
      src = '';
      constructor() { pending.push(this); }
    });
  });

  it('draws nothing until the art’s size is known, then draws through the mask', () => {
    render(<WeatherBackground kind="rain" mode="full" plain={false} mask="m-one" art="art-unseen" />);
    expect(screen.queryByTestId('weather-background')).toBeNull();
    expect(frames.size).toBe(0);
    load();
    expect(screen.getByTestId('weather-background').dataset.weatherMask).toBe('m-one');
  });

  it('keeps one canvas while the mask changes', () => {
    const { rerender } = render(<WeatherBackground kind="rain" mode="full" plain={false} mask="m-one" art="art-kept" />);
    load();
    const canvas = screen.getByTestId('weather-background');
    rerender(<WeatherBackground kind="rain" mode="full" plain={false} mask="m-two" art="art-kept" />);
    expect(screen.getByTestId('weather-background')).toBe(canvas);
    expect(canvas.dataset.weatherMask).toBe('m-two');
  });

  it('draws unmasked weather at once, with no art to measure', () => {
    render(<WeatherBackground kind="rain" mode="full" plain={false} art="art-ignored" />);
    expect(screen.getByTestId('weather-background').dataset.weatherMask).toBeUndefined();
    expect(pending).toHaveLength(0);
  });
});
