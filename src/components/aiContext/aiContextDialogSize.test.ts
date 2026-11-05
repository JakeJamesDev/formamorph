import { describe, expect, it } from 'vitest';
import { AI_CONTEXT_DIALOG_SIZE } from './aiContextDialogSize';

describe('AI_CONTEXT_DIALOG_SIZE', () => {
  it('fills the screen on mobile, clear of the status bar and the gesture bar', () => {
    // Centered at 90% height, the keyboard pushed the window under the status bar.
    const classes = AI_CONTEXT_DIALOG_SIZE.split(' ');
    expect(classes).toContain('max-sm:h-[var(--app-h,100dvh)]');
    expect(classes).toContain('max-sm:border-t-[length:env(safe-area-inset-top)]');
    expect(classes).toContain('max-sm:border-b-[length:env(safe-area-inset-bottom)]');
  });
});
