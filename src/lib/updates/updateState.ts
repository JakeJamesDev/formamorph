// The desktop update flow's state machine, kept as a pure reducer so it's unit-testable and framework-free.
// Detection (which release is latest + its notes) is computed in the renderer via UpdateService; download +
// apply are per-platform (Linux electron-updater, Windows launcher swap, macOS dmg open) and feed progress
// back through DOWNLOAD_* actions dispatched from the desktop bridge events.

import type { UpdateChannel } from '@/contexts/settingsDefaults';

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateState {
  phase: UpdatePhase;
  /** The running app's version (never changes for the session). */
  currentVersion: string;
  channel: UpdateChannel;
  latestVersion?: string;
  /** Release notes markdown for the latest (or newest-checked) release. */
  changelog?: string;
  downloadPct?: number;
  bytesReceived?: number;
  bytesTotal?: number;
  error?: string;
  lastCheckedAt?: number;
}

export type UpdateAction =
  | { type: 'CHECK_START' }
  | { type: 'CHECK_RESULT'; available: false; changelog?: string; at: number }
  | { type: 'CHECK_RESULT'; available: true; latestVersion: string; changelog: string; at: number }
  | { type: 'DOWNLOAD_START' }
  | { type: 'DOWNLOAD_PROGRESS'; received: number; total: number }
  | { type: 'DOWNLOAD_DONE' }
  | { type: 'ERROR'; error: string }
  | { type: 'SET_CHANNEL'; channel: UpdateChannel };

export function initialUpdateState(currentVersion: string, channel: UpdateChannel): UpdateState {
  return { phase: 'idle', currentVersion, channel };
}

export function updateReducer(state: UpdateState, action: UpdateAction): UpdateState {
  switch (action.type) {
    case 'CHECK_START':
      return { ...state, phase: 'checking', error: undefined };
    case 'CHECK_RESULT':
      if (action.available) {
        return {
          ...state,
          phase: 'available',
          latestVersion: action.latestVersion,
          changelog: action.changelog,
          lastCheckedAt: action.at,
          error: undefined,
        };
      }
      // Up to date: keep the current release's notes (for the "you're up to date" dialog), drop any prior target.
      return {
        ...state,
        phase: 'up-to-date',
        latestVersion: undefined,
        changelog: action.changelog,
        lastCheckedAt: action.at,
        error: undefined,
      };
    case 'DOWNLOAD_START':
      return { ...state, phase: 'downloading', downloadPct: 0, bytesReceived: 0, bytesTotal: undefined };
    case 'DOWNLOAD_PROGRESS': {
      const pct = action.total > 0 ? Math.min(100, Math.round((action.received / action.total) * 100)) : state.downloadPct;
      return { ...state, phase: 'downloading', downloadPct: pct, bytesReceived: action.received, bytesTotal: action.total };
    }
    case 'DOWNLOAD_DONE':
      return { ...state, phase: 'downloaded', downloadPct: 100 };
    case 'ERROR':
      return { ...state, phase: 'error', error: action.error };
    case 'SET_CHANNEL':
      // Switching channel invalidates any pending result; a fresh check follows.
      return { ...initialUpdateState(state.currentVersion, action.channel) };
    default:
      return state;
  }
}
