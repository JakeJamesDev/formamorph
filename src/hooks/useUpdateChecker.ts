// Owns the update flow on every platform that can install one: runs the renderer-side check (on mount,
// every ~3h, and on demand), reflects the channel setting, and exposes download/apply that route to
// whichever bridge this build has. Progress + completion come back through the bridge's events and dispatch
// into the same reducer. Detection is one GitHub fetch everywhere; only download/apply differ per platform
// (the desktop main process, or the Android plugin).

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { APP_VERSION } from '@/lib/version';
import { checkForUpdate, androidAssets, type AndroidDownloadUrls } from '@/services/UpdateService';
import { initialUpdateState, updateReducer, type UpdateState } from '@/lib/updates/updateState';
import { updateBridge } from '@/lib/updates/updateBridge';
import type { UpdateChannel } from '@/contexts/settingsDefaults';

const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000; // ~3h

export interface UpdateChecker {
  state: UpdateState;
  /** Manually re-check now (the dialog's "Check for updates" button). */
  check: () => void;
  /** Begin the platform download for the available update. */
  download: () => void;
  /** Install what was downloaded. The desktop shell relaunches; Android hands it to its own installer. */
  applyUpdate: () => void;
}

export function useUpdateChecker(channel: UpdateChannel): UpdateChecker {
  const [state, dispatch] = useReducer(updateReducer, undefined, () => initialUpdateState(APP_VERSION, channel));
  // Android downloads the release asset itself, so the URLs the check already found travel with the
  // download call. The desktop main process finds its own asset and ignores them.
  const assets = useRef<AndroidDownloadUrls | null>(null);

  const runCheck = useCallback(async () => {
    dispatch({ type: 'CHECK_START' });
    const res = await checkForUpdate(channel);
    if (!res.success || !res.result) {
      dispatch({ type: 'ERROR', error: res.error ?? 'Update check failed' });
      return;
    }
    const r = res.result;
    assets.current = androidAssets(r.release);
    if (r.available && r.latestVersion) {
      dispatch({ type: 'CHECK_RESULT', available: true, latestVersion: r.latestVersion, changelog: r.changelog ?? '', at: Date.now() });
      // If this exact version was already downloaded in a prior session (staged on disk), resume at the
      // apply offer instead of making the user re-download.
      const stripV = (v: string) => v.replace(/^v/, '');
      const pending = await updateBridge()?.pending();
      if (pending && stripV(pending.version) === stripV(r.latestVersion)) {
        dispatch({ type: 'DOWNLOAD_DONE' });
      }
    } else {
      dispatch({ type: 'CHECK_RESULT', available: false, changelog: r.changelog, at: Date.now() });
    }
  }, [channel]);

  // Reset to the new channel and re-check whenever the channel setting changes (covers the initial mount too).
  useEffect(() => {
    dispatch({ type: 'SET_CHANNEL', channel });
    void runCheck();
  }, [channel, runCheck]);

  // Periodic re-check while the app stays open.
  useEffect(() => {
    const id = setInterval(() => void runCheck(), CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [runCheck]);

  // Platform update events (electron-updater on Linux, the Windows swap downloader, the Android plugin's
  // stream to the cache directory) drive progress.
  useEffect(() => {
    const bridge = updateBridge();
    if (!bridge) return;
    const offProgress = bridge.onProgress((p) => dispatch({ type: 'DOWNLOAD_PROGRESS', received: p.received, total: p.total }));
    const offDone = bridge.onDownloaded(() => dispatch({ type: 'DOWNLOAD_DONE' }));
    return () => { offProgress(); offDone(); };
  }, []);

  const check = useCallback(() => void runCheck(), [runCheck]);

  const download = useCallback(() => {
    dispatch({ type: 'DOWNLOAD_START' });
    // The bridge exposes no error event, so a rejected download would otherwise leave the UI stuck at
    // 'downloading' forever — surface it as an error the dialog can show and retry from. A failed checksum
    // arrives here too, which is why the Android plugin rejects rather than reporting a finished download.
    updateBridge()
      ?.download({ version: state.latestVersion, channel, ...assets.current })
      .catch((e) => dispatch({ type: 'ERROR', error: (e as Error)?.message ?? 'Update download failed' }));
  }, [state.latestVersion, channel]);

  const applyUpdate = useCallback(() => {
    const bridge = updateBridge();
    if (!bridge) return;
    // A resolved apply leaves the state alone: the desktop shell relaunches, and Android's `needsPermission`
    // sends the player to a setting they come back from, so the offer must survive. Only a rejection is an
    // error worth showing.
    void Promise.resolve(bridge.apply())
      .catch((e) => dispatch({ type: 'ERROR', error: (e as Error)?.message ?? 'Update install failed' }));
  }, []);

  return { state, check, download, applyUpdate };
}
