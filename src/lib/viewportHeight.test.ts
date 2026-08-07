import { describe, it, expect } from 'vitest';
import {
  installViewportHeightVar,
  APP_HEIGHT_VAR, APP_WIDTH_VAR, APP_TOP_VAR, APP_LEFT_VAR,
  type ViewportHost,
} from './viewportHeight';

/** A fake visual viewport whose rect can be moved, plus the listeners it handed out. */
function makeHost(rect = { height: 800, width: 400, offsetTop: 0, offsetLeft: 0, scale: 1 }) {
  const listeners = new Set<() => void>();
  const vv = {
    ...rect,
    addEventListener: (_t: string, l: () => void) => { listeners.add(l); },
    removeEventListener: (_t: string, l: () => void) => { listeners.delete(l); },
  };
  const style = document.createElement('div').style;
  const host = { visualViewport: vv, document: { documentElement: { style } } } as unknown as ViewportHost;
  return { host, vv, style, fire: () => listeners.forEach((l) => l()), count: () => listeners.size };
}

const rectOf = (style: CSSStyleDeclaration) => ({
  height: style.getPropertyValue(APP_HEIGHT_VAR),
  width: style.getPropertyValue(APP_WIDTH_VAR),
  top: style.getPropertyValue(APP_TOP_VAR),
  left: style.getPropertyValue(APP_LEFT_VAR),
});

describe('installViewportHeightVar', () => {
  it('publishes the visible rect immediately and on every resize', () => {
    const { host, vv, style, fire } = makeHost();
    installViewportHeightVar(host);
    expect(rectOf(style)).toEqual({ height: '800px', width: '400px', top: '0px', left: '0px' });

    vv.height = 460;
    fire();
    expect(rectOf(style).height).toBe('460px');
  });

  it('follows the offset when the engine pans instead of resizing', () => {
    const { host, vv, style, fire } = makeHost();
    installViewportHeightVar(host);

    // The keyboard can move the visible area down the page rather than shrink it. The app has to
    // follow, or it stays where the viewport used to be and leaves its own background showing.
    vv.height = 460;
    vv.offsetTop = 120;
    fire();
    expect(rectOf(style)).toMatchObject({ height: '460px', top: '120px' });
  });

  it('publishes the visible height even when the layout viewport shrank with it', () => {
    const { host, vv, style, fire } = makeHost();
    installViewportHeightVar(host);

    // An engine that resizes its own layout makes `dvh` right too — but under the Fullscreen API the
    // element is sized to the screen regardless, so the measured rect has to win either way.
    vv.height = 460;
    fire();
    expect(rectOf(style).height).toBe('460px');
  });

  it('stands down while pinch-zoomed so the whole-viewport fallback takes over', () => {
    const { host, vv, style, fire } = makeHost();
    installViewportHeightVar(host);

    vv.scale = 2;
    vv.height = 400;
    fire();
    expect(rectOf(style)).toEqual({ height: '', width: '', top: '', left: '' });

    vv.scale = 1;
    fire();
    expect(rectOf(style).height).toBe('400px');
  });

  it('unsubscribes and clears every variable on cleanup', () => {
    const { host, vv, style, fire, count } = makeHost();
    const stop = installViewportHeightVar(host);
    stop();

    expect(count()).toBe(0);
    expect(rectOf(style)).toEqual({ height: '', width: '', top: '', left: '' });
    vv.height = 460;
    fire();
    expect(rectOf(style).height).toBe('');
  });

  it('is a no-op without a visual viewport, leaving the fallback in place', () => {
    const style = document.createElement('div').style;
    const host = { visualViewport: null, document: { documentElement: { style } } } as unknown as ViewportHost;
    expect(() => installViewportHeightVar(host)()).not.toThrow();
    expect(rectOf(style).height).toBe('');
  });
});
