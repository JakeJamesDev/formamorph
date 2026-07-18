import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { HelpButton } from './HelpButton';

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
  });

  it('renders nothing for a topic with no copy yet', () => {
    const { container } = render(<HelpButton topicId="worldEditor.nope" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('nudges until its topic is opened, then stays quiet — and the quiet persists across mounts', () => {
    render(<HelpButton topicId="worldEditor.stats" />);
    expect(tinted()).toBe(true);

    fireEvent.click(helpButton());
    expect(tinted()).toBe(false);

    // A fresh mount re-reads the store, so the quiet is persisted rather than only in memory.
    cleanup();
    render(<HelpButton topicId="worldEditor.stats" />);
    expect(tinted()).toBe(false);
  });

  it('reads seen-state per topic on mount — an unseen topic still nudges after another was opened', () => {
    // Seen-state is read once, on mount. The World Editor swaps topics on one button via `key={topicId}`,
    // which remounts it — modeled here by cleanup + a fresh render for the next topic.
    render(<HelpButton topicId="worldEditor.stats" />);
    fireEvent.click(helpButton());
    expect(tinted()).toBe(false);

    cleanup();
    render(<HelpButton topicId="worldEditor.dictionary" />);
    expect(tinted()).toBe(true); // its own state — not inherited from the opened one
  });
});
