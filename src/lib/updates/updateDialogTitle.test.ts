import { describe, it, expect } from 'vitest';
import { updateDialogTitle } from './updateDialogTitle';
import type { UpdatePhase } from './updateState';

const title = (phase: UpdatePhase) => updateDialogTitle({ phase, latestVersion: 'v9.9.9' });

describe('updateDialogTitle', () => {
  it('names the update while it is available, downloading and downloaded', () => {
    expect(title('available')).toBe('Update Available: v9.9.9');
    expect(title('downloading')).toBe('Downloading Update: v9.9.9');
    expect(title('downloaded')).toBe('Update Downloaded: v9.9.9');
  });

  it('says "You’re up to date" only for the up-to-date phase', () => {
    expect(title('up-to-date')).toBe('You’re up to date');
    const phases: UpdatePhase[] = ['idle', 'checking', 'available', 'downloading', 'downloaded', 'error'];
    for (const p of phases) expect(title(p)).not.toBe('You’re up to date');
  });

  it('gives checking, idle and error their own titles', () => {
    expect(title('checking')).toBe('Checking for Updates');
    expect(title('idle')).toBe('App Updates');
    expect(title('error')).toBe('Couldn’t check for updates');
  });
});
