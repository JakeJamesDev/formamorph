// Owns the desktop update flow: runs the renderer-side check (on mount, every ~3h, and on demand), reflects
// the channel setting, and exposes download/apply that route to the desktop bridge. Progress + completion
// come back through the bridge's update events and dispatch into the same reducer. Detection works on every
// desktop platform (GitHub fetch); only download/apply differ per OS (wired in the main process).

import { useCallback, useEffect, useReducer } from 'react';
import { APP_VERSION } from '@/lib/version';
import { checkForUpdate } from '@/services/UpdateService';
import { initialUpdateState, updateReducer, type UpdateState } from '@/lib/updates/updateState';
import type { UpdateChannel } from '@/contexts/settingsDefaults';

const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000; // ~3h

export interface UpdateChecker {
  state: UpdateState;
  /** Manually re-check now (the dialog's "Check for updates" button). */
  check: () => void;
  /** Begin the platform download for the available update. */
  download: () => void;
  /** Apply the downloaded update and relaunch. */
  applyAndRestart: () => void;
}

export function useUpdateChecker(channel: UpdateChannel): UpdateChecker {
  const [state, dispatch] = useReducer(updateReducer, undefined, () => initialUpdateState(APP_VERSION, channel));

  const runCheck = useCallback(async () => {
    dispatch({ type: 'CHECK_START' });
    const res = await checkForUpdate(channel);
    if (!res.success || !res.result) {
      dispatch({ type: 'ERROR', error: res.error ?? 'Update check failed' });
      return;
    }
    const r = res.result;
    if (r.available && r.latestVersion) {
      dispatch({ type: 'CHECK_RESULT', available: true, latestVersion: r.latestVersion, changelog: r.changelog ?? '', at: Date.now() });
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

  // Main-process update events (electron-updater on Linux; the Windows swap downloader) drive progress.
  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.formamorphDesktop?.update : undefined;
    if (!bridge) return;
    const offProgress = bridge.onProgress((p) => dispatch({ type: 'DOWNLOAD_PROGRESS', received: p.received, total: p.total }));
    const offDone = bridge.onDownloaded(() => dispatch({ type: 'DOWNLOAD_DONE' }));
    return () => { offProgress(); offDone(); };
  }, []);

  const check = useCallback(() => void runCheck(), [runCheck]);

  const download = useCallback(() => {
    dispatch({ type: 'DOWNLOAD_START' });
    void window.formamorphDesktop?.update?.download({ version: state.latestVersion, channel });
  }, [state.latestVersion, channel]);

  const applyAndRestart = useCallback(() => {
    void window.formamorphDesktop?.update?.apply();
  }, []);

  return { state, check, download, applyAndRestart };
}
