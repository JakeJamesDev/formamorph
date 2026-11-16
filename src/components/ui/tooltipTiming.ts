/** Shared open delay, and the window in which moving to a neighboring trigger opens instantly. Both
 *  live on the provider, so no call site retunes them; only the test setup below does. Native `title` waited about a second; this is
 *  fast enough to feel like part of the app and slow enough not to fire while the pointer crosses.
 *  The code editor's hover cards wait the same. */
export const TOOLTIP_DELAY_MS = 400

let openDelay = TOOLTIP_DELAY_MS

/** The open delay the provider passes on its next render. */
export const tooltipOpenDelay = () => openDelay

/** Test seam: the suite setup sets 0 so a hover opens a tip at once. Its own module, so setup loads no Base UI. */
export function setTooltipOpenDelayForTests(ms: number) {
  openDelay = ms
}
