/**
 * One accessor for whichever update bridge this build has.
 *
 * The desktop shell and the Android app both stage a download and install it, and the screens that offer
 * an update should not each know which one they are talking to. Everything else — the browser — has no
 * bridge, and its update is a reload.
 */

/**
 * What every platform's update bridge can do, as far as anything reaching for it through here needs.
 *
 * Deliberately narrower than the desktop shell's own bridge: each surface that starts using this adds
 * the call it needs, so the cross-platform contract stays the intersection rather than one platform's
 * shape copied onto the others.
 */
export interface UpdateBridge {
  /** Start the platform download for a named release. */
  download: (opts: { version?: string; channel?: 'stable' | 'prerelease' }) => Promise<void>;
}

/**
 * The update bridge this build talks to, or null in the browser.
 *
 * @returns The bridge, or null where the platform has no way to install anything
 */
export function updateBridge(): UpdateBridge | null {
  if (typeof window === 'undefined') return null;
  return window.formamorphDesktop?.update ?? null;
}
