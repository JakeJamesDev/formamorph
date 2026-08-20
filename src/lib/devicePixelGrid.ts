/**
 * Publishes the display's pixel ratio as `--dpr`, so a rule can be drawn one *device* pixel thick.
 *
 * A 1px line is 1.25 or 1.5 device pixels on a scaled Windows display, and where that lands on the device
 * grid decides whether the browser paints one crisp row or two blurred ones — so a menu's separators come
 * out at visibly different weights depending on where the menu opened. `h-hairline` divides by this instead,
 * which is exactly one device pixel wherever it falls.
 *
 * The ratio changes when the window moves to another monitor or the page is zoomed, and the media query it
 * is watched with matches only the ratio it was made for, so each change re-registers the next one. Resize
 * is watched alongside it: a zoom or a move between monitors resizes the window, and an embedded view can
 * change ratio without the query ever firing.
 */
export function trackDevicePixelRatio(): () => void {
  if (typeof window === 'undefined') return () => {};
  let query: MediaQueryList | null = null;
  let stopped = false;

  const apply = () => {
    if (stopped) return;
    const dpr = window.devicePixelRatio || 1;
    document.documentElement.style.setProperty('--dpr', String(dpr));
    query?.removeEventListener('change', apply);
    query = window.matchMedia(`(resolution: ${dpr}dppx)`);
    query.addEventListener('change', apply);
  };

  apply();
  window.addEventListener('resize', apply);
  return () => {
    stopped = true;
    window.removeEventListener('resize', apply);
    query?.removeEventListener('change', apply);
  };
}
