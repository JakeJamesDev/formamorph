import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchOnScreen } from './watchOnScreen';

const target = {} as Element;
let report: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};
const disconnect = vi.fn();

class FakeObserver {
  constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) { report = callback; }
  observe() {}
  disconnect() { disconnect(); }
}

afterEach(() => {
  vi.unstubAllGlobals();
  disconnect.mockClear();
});

describe('watchOnScreen', () => {
  it('follows the latest report and stops on request', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const watch = watchOnScreen(target);
    expect(watch.visible).toBe(true);
    report([{ isIntersecting: true }, { isIntersecting: false }]);
    expect(watch.visible).toBe(false);
    report([{ isIntersecting: true }]);
    expect(watch.visible).toBe(true);
    watch.stop();
    expect(disconnect).toHaveBeenCalled();
  });

  it('counts as visible where the browser cannot tell', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(watchOnScreen(target).visible).toBe(true);
  });
});
