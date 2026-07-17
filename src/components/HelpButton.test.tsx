import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { HelpButton } from './HelpButton';

let rerender: (ui: React.ReactElement) => void;

/** The help button itself. Queried by its aria-label rather than by role: while the pop-out is open Radix
 *  marks the background `aria-hidden`, so a role query silently returns the dialog's close button instead. */
const helpButton = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('[aria-label^="About"]');
  if (!el) throw new Error('help button not rendered');
  return el;
};

/** The nudge tint the button carries until its topic has been opened. */
const tinted = () => helpButton().className.includes('border-primary');

describe('HelpButton', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
    ({ rerender } = render(<HelpButton topicId="worldEditor.stats" />));
  });

  it('renders nothing for a topic with no copy yet', () => {
    cleanup();
    const { container } = render(<HelpButton topicId="worldEditor.nope" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('nudges until its topic is opened, then stays quiet', () => {
    expect(tinted()).toBe(true);

    fireEvent.click(helpButton());
    expect(tinted()).toBe(false);

    // A fresh mount re-reads the store, so the quiet is persisted rather than only in memory.
    cleanup();
    render(<HelpButton topicId="worldEditor.stats" />);
    expect(tinted()).toBe(false);
  });

  it('tracks seen-state per topic when one mounted button swaps topicId', () => {
    // The World Editor reuses a single button across tabs; a mount-only read would leak the previous
    // topic's seen-state onto the next tab and silently kill its nudge.
    fireEvent.click(helpButton());
    expect(tinted()).toBe(false);

    rerender(<HelpButton topicId="worldEditor.dictionary" />);
    expect(tinted()).toBe(true);

    rerender(<HelpButton topicId="worldEditor.stats" />);
    expect(tinted()).toBe(false);
  });
});
