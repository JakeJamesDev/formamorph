import type { UpdateState } from './updateState';

/** The update dialog's title for the current phase. */
export function updateDialogTitle(state: Pick<UpdateState, 'phase' | 'latestVersion' | 'failedStep'>): string {
  switch (state.phase) {
    case 'available': return `Update Available: ${state.latestVersion}`;
    case 'downloading': return `Downloading Update: ${state.latestVersion}`;
    case 'downloaded': return `Update Downloaded: ${state.latestVersion}`;
    case 'checking': return 'Checking for Updates';
    case 'idle': return 'App Updates';
    case 'error':
      if (state.failedStep === 'download') return 'Couldn’t Download the Update';
      if (state.failedStep === 'install') return 'Couldn’t Install the Update';
      return 'Couldn’t Check for Updates';
    case 'up-to-date': return 'You’re Up to Date';
  }
}
