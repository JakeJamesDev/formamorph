import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { registerDocsOpener } from '@/lib/formaquestion/docsOpener';
import { HELP_TOPICS } from '@/lib/helpTopics';
import { HelpButton } from './HelpButton';

// Minimal MediaQueryList stub so `useIsMobile` (tabbed topics' body switch) resolves in jsdom.
const stubMatchMedia = () =>
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    media: '',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  })));
afterEach(() => vi.unstubAllGlobals());

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
    stubMatchMedia();
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

describe('HelpButton Learn more', () => {
  const topicId = 'worldEditor.stats';
  const topic = HELP_TOPICS[topicId];
  let unregister: (() => void) | null = null;
  beforeEach(() => {
    localStorage.clear();
    cleanup();
    stubMatchMedia();
  });
  afterEach(() => unregister?.());

  const learnMore = () => screen.getByRole('link', { name: 'Learn more →' });

  it('opens the topic docs heading in the reader and closes the pop-out, with no navigation', () => {
    const open = vi.fn();
    unregister = registerDocsOpener(open);
    render(<HelpButton topicId={topicId} />);
    fireEvent.click(helpButton());
    const proceeded = fireEvent.click(learnMore());
    expect(proceeded).toBe(false);
    expect(open).toHaveBeenCalledWith({ page: topic.wikiPage, anchor: topic.wikiAnchor });
    expect(screen.queryByRole('link', { name: 'Learn more →' })).toBeNull();
  });

  it('leaves a modified click to the browser, so Ctrl+click still opens a new tab', () => {
    const open = vi.fn();
    unregister = registerDocsOpener(open);
    render(<HelpButton topicId={topicId} />);
    fireEvent.click(helpButton());
    expect(fireEvent.click(learnMore(), { ctrlKey: true })).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('links to the wiki in a new tab when no reader is mounted', () => {
    render(<HelpButton topicId={topicId} />);
    fireEvent.click(helpButton());
    expect(fireEvent.click(learnMore())).toBe(true);
    expect(learnMore()).toHaveAttribute('target', '_blank');
    expect(learnMore().getAttribute('href')).toContain(`/wiki/${topic.wikiPage}`);
  });
});
