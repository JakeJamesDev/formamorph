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

describe('the stock open animation', () => {
  const contentClasses = (unanimated?: boolean) => {
    render(
      <Dialog open>
        <DialogContent hideClose unanimated={unanimated} aria-label="box" aria-describedby={undefined}>
          <DialogTitle className="sr-only">box</DialogTitle>
          body
        </DialogContent>
      </Dialog>,
    );
    return screen.getByLabelText('box').className.split(/\s+/);
  };

  it('is what every dialog gets by default', () => {
    const classes = contentClasses();
    expect(classes).toContain('data-[state=open]:zoom-in-95');
    expect(classes).toContain('data-[state=open]:animate-in');
  });

  it('is dropped entirely when the caller animates the box itself', () => {
    // A zoom left in place rewrites `transform` every frame, so a caller's own FLIP would be erased as
    // fast as it was written and the box would jump rather than travel.
    const classes = contentClasses(true);
    expect(classes.some(c => c.includes('zoom-in-95'))).toBe(false);
    expect(classes.some(c => c.includes('animate-in'))).toBe(false);
    expect(classes.some(c => c.includes('slide-in'))).toBe(false);
    // The frame itself is untouched — only the animation goes.
    expect(classes).toContain('bg-background');
  });
});

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

    // This shell is only full-height on mobile, so the wide-screen dialog must still be centered.
    expect(classes).toContain('top-[50%]');
    expect(classes).toContain('translate-y-[-50%]');
    expect(classes).toContain('max-sm:top-[var(--app-top,0px)]');
    expect(classes).toContain('max-sm:translate-y-0');
    expect(classes).toContain('max-sm:h-[var(--app-h,100dvh)]');
  });
});
