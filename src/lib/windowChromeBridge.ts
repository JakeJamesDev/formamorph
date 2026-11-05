/** The window chrome part of `window.formamorphDesktop`, which electron/preload.cjs exposes. */
export interface WindowChromeBridge {
  /** True only where the main process hides the title bar. */
  windowOverlay?: boolean;
  /** Paints the native window buttons in a `#rrggbb` color. */
  setWindowSymbolColor?: (color: string) => Promise<void>;
  /** Whether full screen hides the window buttons, answered before the page lays out. */
  isFullScreen?: () => boolean;
  /** Hears full screen hide or bring back the window buttons. */
  onFullScreen?: (cb: (on: boolean) => void) => () => void;
  /** Leaves full screen, where the window buttons are hidden. */
  leaveFullScreen?: () => Promise<void>;
}
