/**
 * Publishes the visual viewport's rect as CSS variables, so the app can be pinned to exactly the area
 * the user can see rather than to a viewport unit that may or may not account for the on-screen keyboard.
 *
 * Inferring the visible area from units does not survive contact with the real cases. `dvh` tracks the
 * layout viewport, which the keyboard shrinks on some engines and not others; under the Fullscreen API
 * the element is sized to the screen with `height: 100% !important` and neither unit describes what is
 * actually on screen. The visual viewport is the one thing that always does, so it is measured and used
 * directly — whatever the browser did, the app covers what is visible and nothing else.
 *
 * Consumers use the `.app-viewport` class (index.css); every variable falls back to the whole viewport,
 * so a browser without `visualViewport` behaves exactly as before. Pinch-zoom is the one case to stay
 * out of — the zoomed rect is not the app's frame — so the variables are cleared above `ZOOM_EPSILON`.
 *
 * `#dev?probe=viewport` puts every number this reads on screen (see `ViewportReadout.tsx`).
 */

/** Usable height, in px. */
export const APP_HEIGHT_VAR = '--app-h';
/** Usable width, in px. */
export const APP_WIDTH_VAR = '--app-w';
/** Offset of the visible area from the layout viewport's top, in px. */
export const APP_TOP_VAR = '--app-top';
/** Offset of the visible area from the layout viewport's left, in px. */
export const APP_LEFT_VAR = '--app-left';

const ALL_VARS = [APP_HEIGHT_VAR, APP_WIDTH_VAR, APP_TOP_VAR, APP_LEFT_VAR];

/** Above this scale the user is pinch-zoomed, and the zoomed rect is not the app's frame. */
const ZOOM_EPSILON = 1.01;

/** The visual viewport plus the document root it reports onto — all this module needs. */
export interface ViewportHost {
  visualViewport?: {
    height: number;
    width: number;
    offsetTop: number;
    offsetLeft: number;
    scale: number;
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
  } | null;
  document: { documentElement: { style: CSSStyleDeclaration } };
}

/**
 * Start tracking the visual viewport. Returns a cleanup that unsubscribes and clears the variables;
 * a no-op when the host has no `visualViewport`.
 */
export function installViewportHeightVar(host: ViewportHost = window): () => void {
  const vv = host.visualViewport;
  if (!vv) return () => {};
  const style = host.document.documentElement.style;
  const clear = () => { for (const v of ALL_VARS) style.removeProperty(v); };

  const apply = () => {
    if (vv.scale > ZOOM_EPSILON) { clear(); return; }
    style.setProperty(APP_HEIGHT_VAR, `${Math.round(vv.height)}px`);
    style.setProperty(APP_WIDTH_VAR, `${Math.round(vv.width)}px`);
    style.setProperty(APP_TOP_VAR, `${Math.round(vv.offsetTop)}px`);
    style.setProperty(APP_LEFT_VAR, `${Math.round(vv.offsetLeft)}px`);
  };

  apply();
  // `scroll` fires when the engine pans the visual viewport instead of resizing it — the offset moves
  // without the size changing, and the app has to follow it.
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  return () => {
    vv.removeEventListener('resize', apply);
    vv.removeEventListener('scroll', apply);
    clear();
  };
}
