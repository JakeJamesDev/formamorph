import { describe, expect, it } from 'vitest';
import { SETTINGS_DIALOG_SIZE } from './settingsDialogSize';

describe('SETTINGS_DIALOG_SIZE', () => {
  it('keeps the mobile safe-area inset', () => {
    // A later border class merges it away, and Settings then draws under the status bar.
    const classes = SETTINGS_DIALOG_SIZE.split(' ');
    expect(classes).toContain('max-sm:border-t-[length:env(safe-area-inset-top)]');
    expect(classes).toContain('max-sm:border-b-[length:env(safe-area-inset-bottom)]');
  });
});
