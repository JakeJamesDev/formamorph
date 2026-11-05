// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installWindowChrome } from './windowChrome';

const setBridge = (bridge: unknown) => {
  (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = bridge;
};

const setForeground = (hsl: string) => document.documentElement.style.setProperty('--foreground', hsl);

beforeEach(() => setForeground('0 0% 100%'));

afterEach(() => {
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
  delete document.documentElement.dataset.windowOverlay;
  document.documentElement.className = '';
  document.querySelector('.window-drag-area')?.remove();
});

describe('installWindowChrome', () => {
  it('leaves the web build without the flag or a drag area', () => {
    installWindowChrome();
    expect(document.documentElement.dataset.windowOverlay).toBeUndefined();
    expect(document.querySelector('.window-drag-area')).toBeNull();
  });

  it('leaves a desktop build with a native title bar without them', () => {
    const setWindowSymbolColor = vi.fn();
    setBridge({ windowOverlay: false, setWindowSymbolColor });
    installWindowChrome();
    expect(document.documentElement.dataset.windowOverlay).toBeUndefined();
    expect(document.querySelector('.window-drag-area')).toBeNull();
    expect(setWindowSymbolColor).not.toHaveBeenCalled();
  });

  it('sets the flag and the drag area on the Windows desktop build', () => {
    setBridge({ windowOverlay: true, setWindowSymbolColor: vi.fn() });
    installWindowChrome();
    expect(document.documentElement.dataset.windowOverlay).toBe('');
    expect(document.querySelector('.window-drag-area')).not.toBeNull();
  });

  it('sends the theme foreground, and sends again when the theme changes', async () => {
    const setWindowSymbolColor = vi.fn();
    setBridge({ windowOverlay: true, setWindowSymbolColor });
    installWindowChrome();
    expect(setWindowSymbolColor).toHaveBeenLastCalledWith('#ffffff');

    setForeground('0 0% 0%');
    document.documentElement.className = 'light';
    await vi.waitFor(() => expect(setWindowSymbolColor).toHaveBeenLastCalledWith('#000000'));
    expect(setWindowSymbolColor).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when a class change leaves the color the same', async () => {
    const setWindowSymbolColor = vi.fn();
    setBridge({ windowOverlay: true, setWindowSymbolColor });
    installWindowChrome();
    document.documentElement.className = 'dark';
    await Promise.resolve();
    await Promise.resolve();
    expect(setWindowSymbolColor).toHaveBeenCalledTimes(1);
  });
});
