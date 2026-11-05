// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { installWindowChrome, leaveWindowFullScreen, useWindowFullScreen } from './windowChrome';

const setBridge = (bridge: unknown) => {
  (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = bridge;
};

const setForeground = (hsl: string) => document.documentElement.style.setProperty('--foreground', hsl);

// jsdom has no layout or hit test, so each test says what the corner's hit test finds, topmost first.
let atCorner: Element[] = [];
const hits = vi.fn(() => atCorner);
Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: hits });

beforeEach(() => {
  setForeground('0 0% 100%');
  atCorner = [];
  hits.mockClear();
});

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

  describe('dimming', () => {
    const DIMMED = '#ffffff40';

    afterEach(() => document.body.replaceChildren());

    const install = () => {
      const setWindowSymbolColor = vi.fn();
      setBridge({ windowOverlay: true, setWindowSymbolColor });
      installWindowChrome();
      return setWindowSymbolColor;
    };

    /** A popup portaled to the body: its dimming layer and, above it, the dialog. */
    const mountPopup = () => {
      const portal = document.createElement('div');
      const layer = document.createElement('div');
      layer.dataset.dimLayer = '';
      layer.dataset.state = 'open';
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      portal.append(layer, dialog);
      document.body.append(portal);
      return { portal, layer, dialog };
    };

    it('fades the symbols to white at 25% while a dimming layer reaches the corner', async () => {
      const send = install();
      const { layer } = mountPopup();
      atCorner = [layer];
      await vi.waitFor(() => expect(send).toHaveBeenLastCalledWith(DIMMED));
      // In steps, not one jump.
      expect(send.mock.calls.length).toBeGreaterThan(3);
    });

    it('returns to the theme color when the popup closes', async () => {
      const send = install();
      const { portal, layer } = mountPopup();
      atCorner = [layer];
      await vi.waitFor(() => expect(send).toHaveBeenLastCalledWith(DIMMED));
      portal.remove();
      atCorner = [];
      await vi.waitFor(() => expect(send).toHaveBeenLastCalledWith('#ffffff'));
    });

    it('undims as the layer starts closing', async () => {
      const send = install();
      const { layer } = mountPopup();
      atCorner = [layer];
      await vi.waitFor(() => expect(send).toHaveBeenLastCalledWith(DIMMED));
      layer.dataset.state = 'closed';
      layer.dispatchEvent(new Event('animationstart', { bubbles: true }));
      await vi.waitFor(() => expect(send).toHaveBeenLastCalledWith('#ffffff'));
    });

    it('stays dim while a nested dialog closes over its parent', async () => {
      const send = install();
      const outer = mountPopup();
      const inner = mountPopup();
      atCorner = [inner.layer, outer.layer];
      await vi.waitFor(() => expect(send).toHaveBeenLastCalledWith(DIMMED));
      const sent = send.mock.calls.length;
      inner.layer.dataset.state = 'closed';
      inner.layer.dispatchEvent(new Event('animationstart', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(send).toHaveBeenCalledTimes(sent);
    });

    it('keeps full color over a full-window dialog', async () => {
      const send = install();
      const { layer, dialog } = mountPopup();
      atCorner = [dialog, layer];
      await vi.waitFor(() => expect(hits).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenLastCalledWith('#ffffff');
    });

    it('rechecks once a dialog finishes opening over its dimming layer', async () => {
      const send = install();
      const { layer, dialog } = mountPopup();
      // Mid-zoom, the dialog doesn't reach the corner yet.
      atCorner = [layer];
      await vi.waitFor(() => expect(send).toHaveBeenLastCalledWith(DIMMED));
      atCorner = [dialog, layer];
      dialog.dispatchEvent(new Event('animationend', { bubbles: true }));
      await vi.waitFor(() => expect(send).toHaveBeenLastCalledWith('#ffffff'));
    });

    it('keeps full color while a full-window dialog zooms in over its dimming layer', async () => {
      const send = install();
      const { layer, dialog } = mountPopup();
      // Layout size, which the zoom's scale leaves at the full window.
      Object.defineProperty(dialog, 'offsetWidth', { value: window.innerWidth });
      Object.defineProperty(dialog, 'offsetHeight', { value: window.innerHeight });
      // Mid-zoom, the scaled dialog doesn't reach the corner yet.
      atCorner = [layer];
      await vi.waitFor(() => expect(hits).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenLastCalledWith('#ffffff');
    });

    it('runs no corner check while narration streams into the page', async () => {
      install();
      const panel = document.createElement('div');
      // Mounting the panel is a body change, so let its check run before counting.
      document.body.append(panel);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      hits.mockClear();
      for (let i = 0; i < 50; i += 1) {
        const word = document.createElement('span');
        word.textContent = `word ${i}`;
        panel.append(word);
        word.dispatchEvent(new Event('animationend', { bubbles: true }));
        word.dispatchEvent(new Event('transitionend', { bubbles: true }));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      expect(hits).not.toHaveBeenCalled();
    });
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

describe('full screen', () => {
  /** A desktop bridge whose main process starts in `start` and can report a change later. */
  const fullScreenBridge = (start: boolean) => {
    let report: (on: boolean) => void = () => {};
    setBridge({
      windowOverlay: true,
      setWindowSymbolColor: vi.fn(),
      isFullScreen: () => start,
      onFullScreen: (cb: (on: boolean) => void) => { report = cb; return () => {}; },
    });
    return (on: boolean) => act(() => report(on));
  };
  const dragArea = () => document.querySelector<HTMLElement>('.window-drag-area');

  it('drops the flag and the drag area on entering, and brings them back on leaving', () => {
    const report = fullScreenBridge(false);
    installWindowChrome();
    const { result } = renderHook(() => useWindowFullScreen());
    expect(result.current).toBe(false);

    report(true);
    expect(document.documentElement.dataset.windowOverlay).toBeUndefined();
    expect(dragArea()?.hidden).toBe(true);
    expect(result.current).toBe(true);

    report(false);
    expect(document.documentElement.dataset.windowOverlay).toBe('');
    expect(dragArea()?.hidden).toBe(false);
    expect(result.current).toBe(false);
  });

  it('starts without the flag after a reload in full screen', () => {
    fullScreenBridge(true);
    installWindowChrome();
    expect(document.documentElement.dataset.windowOverlay).toBeUndefined();
    expect(renderHook(() => useWindowFullScreen()).result.current).toBe(true);
  });

  it('never reports full screen on the web build', async () => {
    // A fresh module, as a page load has: the earlier tests left this one in full screen.
    vi.resetModules();
    const fresh = await import('./windowChrome');
    fresh.installWindowChrome();
    expect(renderHook(() => fresh.useWindowFullScreen()).result.current).toBe(false);
  });

  it('asks the main process to leave', () => {
    const leaveFullScreen = vi.fn(async () => {});
    setBridge({ windowOverlay: true, leaveFullScreen });
    leaveWindowFullScreen();
    expect(leaveFullScreen).toHaveBeenCalledTimes(1);
  });
});
