import { describe, it, expect, vi } from 'vitest';
import windowChrome from './windowChrome.cjs';

const { WINDOW_OVERLAY_ARG, windowChromeOptions, setWindowSymbolColor } = windowChrome;

describe('the window options', () => {
  it('hides the title bar on Windows and keeps its buttons at the header height', () => {
    const options = windowChromeOptions('win32');
    expect(options.titleBarStyle).toBe('hidden');
    expect(options.titleBarOverlay).toMatchObject({ color: '#00000000', height: 56 });
  });

  it('holds the Windows content area to half of a 1080p screen', () => {
    expect(windowChromeOptions('win32')).toMatchObject({ useContentSize: true, minWidth: 800, minHeight: 600 });
  });

  it('hands the page the desktop flag on Windows', () => {
    expect(windowChromeOptions('win32').webPreferences.additionalArguments).toContain(WINDOW_OVERLAY_ARG);
  });

  it.each(['darwin', 'linux'])('leaves %s on the native title bar, with no size limits and no flag', (platform) => {
    const options = windowChromeOptions(platform);
    expect(options.titleBarStyle).toBeUndefined();
    expect(options.titleBarOverlay).toBeUndefined();
    expect(options.minWidth).toBeUndefined();
    expect(options.minHeight).toBeUndefined();
    expect(options.useContentSize).toBeUndefined();
    expect(options.webPreferences).toBeUndefined();
  });
});

describe('the symbol color', () => {
  const windowDouble = () => ({ setTitleBarOverlay: vi.fn() });

  it('paints the window buttons on Windows and keeps the background clear', () => {
    const win = windowDouble();
    setWindowSymbolColor(win, '#123456', 'win32');
    expect(win.setTitleBarOverlay).toHaveBeenCalledWith({ color: '#00000000', symbolColor: '#123456', height: 56 });
  });

  it('never touches a window with a native title bar', () => {
    const win = windowDouble();
    setWindowSymbolColor(win, '#123456', 'linux');
    expect(win.setTitleBarOverlay).not.toHaveBeenCalled();
  });

  it.each([[null], [42], ['red'], ['#12345'], ['#123456; x']])('refuses %s from the page', (color) => {
    const win = windowDouble();
    setWindowSymbolColor(win, color, 'win32');
    expect(win.setTitleBarOverlay).not.toHaveBeenCalled();
  });

  it('does nothing once the window has closed', () => {
    expect(() => setWindowSymbolColor(null, '#123456', 'win32')).not.toThrow();
  });
});

describe('full screen', () => {
  const { FULL_SCREEN_CHANNEL, watchFullScreen, isFullScreen, leaveFullScreen } = windowChrome;

  /** A window that runs the listeners it was given when `emit` names their event. */
  const windowDouble = ({ full = false, destroyed = false } = {}) => {
    const listeners = {};
    return {
      on: (event, cb) => { listeners[event] = cb; },
      emit: (event) => listeners[event]?.(),
      isDestroyed: () => destroyed,
      isFullScreen: () => full,
      setFullScreen: vi.fn(),
      webContents: { send: vi.fn() },
    };
  };

  it('tells the page on entering and on leaving', () => {
    const win = windowDouble();
    watchFullScreen(win, 'win32');
    win.emit('enter-full-screen');
    expect(win.webContents.send).toHaveBeenLastCalledWith(FULL_SCREEN_CHANNEL, true);
    win.emit('leave-full-screen');
    expect(win.webContents.send).toHaveBeenLastCalledWith(FULL_SCREEN_CHANNEL, false);
  });

  it('sends nothing to a closed window', () => {
    const win = windowDouble({ destroyed: true });
    watchFullScreen(win, 'win32');
    win.emit('enter-full-screen');
    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it('reports full screen on Windows only', () => {
    expect(isFullScreen(windowDouble({ full: true }), 'win32')).toBe(true);
    expect(isFullScreen(windowDouble({ full: false }), 'win32')).toBe(false);
    expect(isFullScreen(windowDouble({ full: true }), 'darwin')).toBe(false);
    expect(isFullScreen(null, 'win32')).toBe(false);
  });

  it('leaves full screen on Windows only', () => {
    const win = windowDouble({ full: true });
    leaveFullScreen(win, 'win32');
    expect(win.setFullScreen).toHaveBeenCalledWith(false);
    const mac = windowDouble({ full: true });
    leaveFullScreen(mac, 'darwin');
    expect(mac.setFullScreen).not.toHaveBeenCalled();
  });

  it('tells a page with a native title bar nothing', () => {
    const mac = windowDouble();
    watchFullScreen(mac, 'darwin');
    mac.emit('enter-full-screen');
    expect(mac.webContents.send).not.toHaveBeenCalled();
  });
});
