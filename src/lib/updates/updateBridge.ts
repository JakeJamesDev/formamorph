/**
 * One accessor for whichever update bridge this build has.
 *
 * The desktop shell and the Android app both stage a download and install it, and the screens that offer
 * an update should not each know which one they are talking to. Everything else — the browser — has no
 * bridge, and its update is a reload.
 */

import { registerPlugin } from '@capacitor/core';

/** Which release a download is for, and where its files are. */
export interface UpdateDownloadTarget {
  version?: string;
  /** Which channel to draw from. The desktop shell's own updater resolves the release from this. */
  channel?: 'stable' | 'prerelease';
  /** The release asset to download, and its checksum sidecar. Android needs both, because the plugin
   *  never reads GitHub itself; the desktop main process finds its own asset and ignores them. */
  url?: string;
  sha512Url?: string;
}

/** What an install attempt reports back. The desktop shell relaunches instead of returning. */
export interface UpdateApplyResult {
  /** Android cannot install until the player allows installs from this app. The plugin opens that
   *  setting and returns, so the offer has to survive for the tap that follows. */
  needsPermission?: boolean;
}

/**
 * What every platform's update bridge can do, as far as anything reaching for it through here needs.
 *
 * Deliberately narrower than the desktop shell's own bridge: each surface that starts using this adds
 * the call it needs, so the cross-platform contract stays the intersection rather than one platform's
 * shape copied onto the others.
 */
export interface UpdateBridge {
  /** Present on the Android adapter alone, because Android's install is the system's own sheet rather
   *  than a relaunch, and the button that starts it has to say so. The desktop shell's bridge is the
   *  object the shell injects, so it carries no tag and the absence is what names it. */
  kind?: 'android';
  /** A download from an earlier session still staged on disk, or null. */
  pending: () => Promise<{ version: string } | null>;
  /** Start the platform download for a named release. */
  download: (opts: UpdateDownloadTarget) => Promise<void>;
  /** Install what was downloaded. */
  apply: () => Promise<UpdateApplyResult | void>;
  /** Subscribe to download progress; returns an unsubscribe function. */
  onProgress: (cb: (p: { received: number; total: number }) => void) => () => void;
  /** Subscribe to the download finishing; returns an unsubscribe function. */
  onDownloaded: (cb: () => void) => () => void;
}

/** What the plugin sends, by event name. */
interface AndroidUpdateEvents {
  downloadProgress: { received: number; total: number };
  downloaded: void;
}

/** The Android plugin as Capacitor injects it. Its listener handles resolve asynchronously, which is the
 *  one place its shape differs from the desktop bridge's. */
interface AndroidUpdatePlugin {
  pending: () => Promise<{ version: string | null }>;
  download: (opts: { url: string; sha512Url: string; version: string }) => Promise<void>;
  apply: () => Promise<UpdateApplyResult>;
  addListener: <E extends keyof AndroidUpdateEvents>(
    event: E,
    cb: (data: AndroidUpdateEvents[E]) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
}

interface CapacitorGlobal {
  /** True once the native side has declared a plugin by that name. The browser declares none. */
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: { FormamorphUpdate?: AndroidUpdatePlugin };
}

declare global {
  interface Window {
    /** Capacitor's runtime. Present wherever `@capacitor/core` loaded, which is every build; only the
     *  Android app answers `isPluginAvailable` for anything. */
    Capacitor?: CapacitorGlobal;
  }
}

const PLUGIN_NAME = 'FormamorphUpdate';

// Registering publishes the plugin's proxy on `Capacitor.Plugins`, once, before anything can ask for the
// bridge. The accessor then reads the global rather than `@capacitor/core`'s exported `Capacitor`, so the
// seam matches the desktop shell's `window.formamorphDesktop` and a test can plant either one.
registerPlugin(PLUGIN_NAME);

/** Subscribe through Capacitor's listener handle, which arrives a tick after the call. */
function listen<E extends keyof AndroidUpdateEvents>(
  plugin: AndroidUpdatePlugin,
  event: E,
  cb: (data: AndroidUpdateEvents[E]) => void,
): () => void {
  const handle = plugin.addListener(event, cb);
  return () => { void handle.then((h) => h.remove()); };
}

/** Wrap the Android plugin in the shape every platform's bridge answers to. */
function androidAdapter(plugin: AndroidUpdatePlugin): UpdateBridge {
  return {
    kind: 'android',
    pending: async () => {
      const { version } = await plugin.pending();
      return version ? { version } : null;
    },
    download: async ({ url, sha512Url, version }) => {
      if (!url || !sha512Url) throw new Error('This release has no Android download.');
      await plugin.download({ url, sha512Url, version: version ?? '' });
    },
    apply: () => plugin.apply(),
    onProgress: (cb) => listen(plugin, 'downloadProgress', cb),
    onDownloaded: (cb) => listen(plugin, 'downloaded', cb),
  };
}

/**
 * The update bridge this build talks to, or null in the browser.
 *
 * @returns The bridge, or null where the platform has no way to install anything
 */
export function updateBridge(): UpdateBridge | null {
  if (typeof window === 'undefined') return null;
  const desktop = window.formamorphDesktop?.update;
  if (desktop) return desktop;

  const capacitor = window.Capacitor;
  if (!capacitor?.isPluginAvailable?.(PLUGIN_NAME)) return null;
  const android = capacitor.Plugins?.FormamorphUpdate;
  return android ? androidAdapter(android) : null;
}
