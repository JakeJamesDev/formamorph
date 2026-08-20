import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackDevicePixelRatio } from './devicePixelGrid';

/** The ratio the tracker is meant to read, as a display would report it. */
const setRatio = (dpr: number) => {
  Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
};

let stop: (() => void) | null = null;

const readVar = () => document.documentElement.style.getPropertyValue('--dpr');

afterEach(() => {
  stop?.();
  stop = null;
  document.documentElement.style.removeProperty('--dpr');
});

describe('trackDevicePixelRatio', () => {
  it('publishes the display ratio so a hairline can be drawn one device pixel thick', () => {
    setRatio(1.5);
    stop = trackDevicePixelRatio();
    expect(readVar()).toBe('1.5');
  });

  it('follows the ratio to a differently scaled display', () => {
    setRatio(1);
    stop = trackDevicePixelRatio();
    setRatio(2);
    window.dispatchEvent(new Event('resize'));
    expect(readVar()).toBe('2');
  });

  it('stops writing once torn down, so a unmounted app leaves the page alone', () => {
    setRatio(1);
    const teardown = trackDevicePixelRatio();
    teardown();
    setRatio(3);
    window.dispatchEvent(new Event('resize'));
    expect(readVar()).toBe('1');
  });

  it('watches the ratio it published rather than a fixed query, so each change arms the next', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia');
    setRatio(1.25);
    stop = trackDevicePixelRatio();
    expect(matchMedia).toHaveBeenCalledWith('(resolution: 1.25dppx)');
    setRatio(2);
    window.dispatchEvent(new Event('resize'));
    expect(matchMedia).toHaveBeenCalledWith('(resolution: 2dppx)');
    matchMedia.mockRestore();
  });
});
