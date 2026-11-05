// Windows only: macOS puts its buttons on the left, and neither other platform is tested here.

// The sandboxed preload can't require this module, so main passes the desktop flag as an argument.
const WINDOW_OVERLAY_ARG = '--formamorph-window-overlay';
const WINDOW_BUTTONS_HEIGHT = 56;
const FULL_SCREEN_CHANNEL = 'window-full-screen';
const TRANSPARENT = '#00000000';
const SYMBOL_COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

const hasWindowOverlay = (platform) => platform === 'win32';

const overlayOptions = (symbolColor) => ({ color: TRANSPARENT, symbolColor, height: WINDOW_BUTTONS_HEIGHT });

/** The `BrowserWindow` options that differ by platform. */
function windowChromeOptions(platform) {
  if (!hasWindowOverlay(platform)) return {};
  return {
    useContentSize: true,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: overlayOptions('#ffffff'),
    webPreferences: { additionalArguments: [WINDOW_OVERLAY_ARG] },
  };
}

/** Tells the page when full screen hides the window buttons. The overlay keeps reporting its size there. */
function watchFullScreen(win, platform) {
  if (!hasWindowOverlay(platform)) return;
  const send = (on) => () => {
    if (!win.isDestroyed()) win.webContents.send(FULL_SCREEN_CHANNEL, on);
  };
  win.on('enter-full-screen', send(true));
  win.on('leave-full-screen', send(false));
}

/** Whether the window buttons are hidden by full screen. Always false with a native title bar. */
const isFullScreen = (win, platform) => !!win && hasWindowOverlay(platform) && win.isFullScreen();

function leaveFullScreen(win, platform) {
  if (win && hasWindowOverlay(platform)) win.setFullScreen(false);
}

/** Paints the window buttons in a color from the page, which is untrusted. `win` is null once it has closed. */
function setWindowSymbolColor(win, color, platform) {
  if (!win || !hasWindowOverlay(platform)) return;
  if (typeof color !== 'string' || !SYMBOL_COLOR.test(color)) return;
  win.setTitleBarOverlay(overlayOptions(color));
}

module.exports = { WINDOW_OVERLAY_ARG, FULL_SCREEN_CHANNEL, windowChromeOptions, setWindowSymbolColor, watchFullScreen, isFullScreen, leaveFullScreen };
