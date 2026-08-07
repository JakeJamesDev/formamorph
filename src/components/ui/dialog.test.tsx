import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dialog, DialogContent, DialogTitle, dialogFullHeight, dialogFullHeightMobile } from './dialog';
import { cn } from '@/lib/utils';

/** Render a dialog with the given shell classes and hand back its content element's class list. */
const classesFor = (shell: string) => {
  render(
    <Dialog open>
      <DialogContent hideClose aria-label="shell" aria-describedby={undefined} className={cn(shell)}>
        <DialogTitle className="sr-only">shell</DialogTitle>
        body
      </DialogContent>
    </Dialog>,
  );
  return screen.getByLabelText('shell').className.split(/\s+/);
};

describe('full-height dialog shells anchor to the top', () => {
  it('drops the centering a normal dialog uses', () => {
    const classes = classesFor(dialogFullHeight);

    // Centering is what makes the keyboard shrinking the viewport slide the header down and back:
    // a shell whose center is pinned loses half of every lost pixel off the top.
    expect(classes).not.toContain('top-[50%]');
    expect(classes).not.toContain('translate-y-[-50%]');
    expect(classes).toContain('top-[var(--app-top,0px)]');
    expect(classes).toContain('translate-y-0');
    // Horizontal centering is untouched — only the vertical axis moves with the keyboard.
    expect(classes).toContain('translate-x-[-50%]');
  });

  it('tracks the keyboard-aware height with a dvh fallback', () => {
    expect(classesFor(dialogFullHeight)).toContain('h-[var(--app-h,100dvh)]');
  });

  it('leaves the centered window in place above the sm breakpoint', () => {
    const classes = classesFor(dialogFullHeightMobile);

    // This shell is only full-height on a phone, so the wide-screen dialog must still be centered.
    expect(classes).toContain('top-[50%]');
    expect(classes).toContain('translate-y-[-50%]');
    expect(classes).toContain('max-sm:top-[var(--app-top,0px)]');
    expect(classes).toContain('max-sm:translate-y-0');
    expect(classes).toContain('max-sm:h-[var(--app-h,100dvh)]');
  });
});
