import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';

// The Android app is the web build in a WebView, so the only thing marking it is the build class. Nothing
// in the WebView sets the bridge, and the desktop-only surfaces — the bundled engine, the model catalog —
// must stay hidden there. Reading the class here is what would break that.
const build = vi.hoisted(() => ({ target: '' }));
vi.mock('@/lib/buildInfo', () => ({
  get BUILD_TARGET() { return build.target; },
  get BUILD_TAG() { return build.target || 'dev'; },
  buildSignature: () => '',
}));

const { isDesktop, isLocalLlmAvailable } = await import('@/lib/imageGen/desktop');

beforeEach(() => {
  build.target = '';
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
});

afterEach(() => {
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
});

describe('isDesktop', () => {
  it('is false with no bridge', () => {
    expect(isDesktop()).toBe(false);
  });

  it('is true with the bridge', () => {
    (window as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    expect(isDesktop()).toBe(true);
  });

  it('stays false in the Android build', () => {
    build.target = 'android';
    expect(isDesktop()).toBe(false);
    expect(isLocalLlmAvailable()).toBe(false);
  });
});
