import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { openDocs } from '@/lib/formaquestion/docsOpener';

// The AI settings come from the app's providers. No test here asks a question.
vi.mock('./useHelpAi', () => import('@/test/idleHelpAi'));
import { storeFramedWindow, storeMinimalWindow } from '@/test/helpFixtures';
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Home: '# 🏠 Home\n\nWelcome. Read [Stats](Stats) first.\n',
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## The Panel\n\nThe panel shows each number.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Home](Home)\n- [Stats](Stats)\n- [Traits](Traits)\n' }));

const helpWindow = () => screen.getByRole('dialog', { name: 'Formaquestion' });
const guideScreen = () => screen.queryByRole('dialog', { name: 'Guide' });
const article = (scope: HTMLElement | Document | null, name: RegExp) => (scope ? within(scope as HTMLElement) : screen).queryByRole('article', { name });

/** Renders the app's one Formaquestion and opens the window from the Help tab. */
async function openWindow() {
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await screen.findByRole('textbox', { name: 'Ask a Question' });
}

/** Opens the full screen from the ⋮ menu. */
async function openFromMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'More Actions' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Open Guide' }));
  return screen.findByRole('dialog', { name: 'Guide' });
}

/** Opens a row of a page in the contents list, opening the page first when it is shut. */
async function pick(scope: HTMLElement, page: RegExp, row: string) {
  const toggle = await within(scope).findByRole('button', { name: page });
  if (toggle.getAttribute('aria-expanded') !== 'true') await userEvent.click(toggle);
  await userEvent.click(within(toggle.parentElement!).getByRole('button', { name: row }));
}

/** Opens a section in the small window's Guide tab. */
async function readInWindow(page: RegExp, row: string) {
  await userEvent.click(screen.getByRole('tab', { name: 'Guide' }));
  await pick(helpWindow(), page, row);
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Open Guide in the Full chrome', () => {
  beforeEach(() => storeFramedWindow());

  it('opens from the title bar button with the rail and an empty reader', async () => {
    await openWindow();
    await userEvent.click(screen.getByRole('button', { name: 'Open Guide' }));

    const box = await screen.findByRole('dialog', { name: 'Guide' });
    expect(within(box).getByRole('searchbox', { name: 'Search the Guide' })).toBeInTheDocument();
    expect(within(box).getByRole('navigation', { name: 'Guide Contents' })).toBeInTheDocument();
    expect(within(box).getByText('Select a section to read')).toBeInTheDocument();
  });

  it('opens from the ⋮ menu item', async () => {
    await openWindow();
    const box = await openFromMenu();
    expect(within(box).getByRole('navigation', { name: 'Guide Contents' })).toBeInTheDocument();
  });

  it('opens on the section the window shows, and carries a section opened there back to the window', async () => {
    await openWindow();
    await readInWindow(/Traits/, 'Introduction');
    expect(article(helpWindow(), /Traits/)).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Open Guide' }));
    const box = await screen.findByRole('dialog', { name: 'Guide' });
    expect(article(box, /Traits/)).not.toBeNull();

    await pick(box, /Stats/, 'The Panel');
    expect(article(box, /The Panel/)).not.toBeNull();
    await userEvent.click(within(box).getByRole('button', { name: 'Close Guide' }));

    await waitFor(() => expect(guideScreen()).toBeNull());
    expect(article(helpWindow(), /The Panel/)).not.toBeNull();
    expect(article(helpWindow(), /Traits/)).toBeNull();
  });

  it('carries the search text and the open pages both ways', async () => {
    await openWindow();
    await userEvent.click(screen.getByRole('button', { name: 'Open Guide' }));
    const box = await screen.findByRole('dialog', { name: 'Guide' });
    await userEvent.type(within(box).getByRole('searchbox', { name: 'Search the Guide' }), 'panel');
    await userEvent.click(within(box).getByRole('button', { name: 'Close Guide' }));
    await waitFor(() => expect(guideScreen()).toBeNull());

    await userEvent.click(screen.getByRole('tab', { name: 'Search' }));
    expect(within(helpWindow()).getByRole('searchbox', { name: 'Search the Guide' })).toHaveValue('panel');
  });

  it('closes on Escape and returns focus to the button that opened it', async () => {
    await openWindow();
    const opener = screen.getByRole('button', { name: 'Open Guide' });
    await userEvent.click(opener);
    await screen.findByRole('dialog', { name: 'Guide' });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(guideScreen()).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(helpWindow()).toBeInTheDocument();
  });

  it('returns focus to the ⋮ button after the menu item opened it', async () => {
    await openWindow();
    await openFromMenu();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(guideScreen()).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'More Actions' })).toHaveFocus());
  });

  it('sinks the window under the full screen and brings it back on close', async () => {
    await openWindow();
    const mount = helpWindow().parentElement!;
    expect(mount.inert).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Open Guide' }));
    await screen.findByRole('dialog', { name: 'Guide' });
    expect(mount.inert).toBe(true);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(guideScreen()).toBeNull());
    expect(mount.inert).toBe(false);
  });

  it('leaves the window alone under the full screen: F1 moves no focus and closes nothing', async () => {
    await openWindow();
    await userEvent.click(screen.getByRole('button', { name: 'Open Guide' }));
    const box = await screen.findByRole('dialog', { name: 'Guide' });
    const search = within(box).getByRole('searchbox', { name: 'Search the Guide' });
    search.focus();

    act(() => { fireEvent.keyDown(search, { key: 'F1' }); });

    expect(search).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Help' })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Open Guide in the Minimal chrome', () => {
  beforeEach(() => storeMinimalWindow({ mascot: false }));

  it('has the ⋮ item and no title bar button', async () => {
    await openWindow();
    expect(screen.queryByRole('button', { name: 'Open Guide' })).toBeNull();
    const box = await openFromMenu();
    expect(within(box).getByRole('navigation', { name: 'Guide Contents' })).toBeInTheDocument();
  });

  it('carries the reader piece section into the full screen and back', async () => {
    await openWindow();
    act(() => { openDocs({ page: 'Traits' }); });
    const piece = await waitFor(() => {
      const found = helpWindow().querySelector<HTMLElement>('[data-fq-piece="reader"]');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(article(piece, /Traits/)).not.toBeNull();

    const box = await openFromMenu();
    expect(article(box, /Traits/)).not.toBeNull();

    await pick(box, /Stats/, 'The Panel');
    await userEvent.click(within(box).getByRole('button', { name: 'Close Guide' }));

    await waitFor(() => expect(guideScreen()).toBeNull());
    const after = helpWindow().querySelector<HTMLElement>('[data-fq-piece="reader"]');
    expect(article(after, /The Panel/)).not.toBeNull();
  });

  it('opens a reader piece for a section picked in the full screen', async () => {
    await openWindow();
    expect(helpWindow().querySelector('[data-fq-piece="reader"]')).toBeNull();
    const box = await openFromMenu();
    await pick(box, /Traits/, 'Introduction');
    await userEvent.click(within(box).getByRole('button', { name: 'Close Guide' }));

    await waitFor(() => expect(guideScreen()).toBeNull());
    expect(article(helpWindow().querySelector<HTMLElement>('[data-fq-piece="reader"]'), /Traits/)).not.toBeNull();
  });
});

describe('Open Guide on the Minimal sheet', () => {
  beforeEach(() => storeMinimalWindow({ mascot: false }));

  it('leaves no reader piece behind for the desktop to show later', async () => {
    const changes = new Set<() => void>();
    const screenWidth = (width: number) => {
      vi.stubGlobal('innerWidth', width);
      window.dispatchEvent(new Event('resize'));
      changes.forEach((notify) => notify());
    };
    vi.stubGlobal('matchMedia', (query: string) => {
      const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
      return {
        get matches() { return query.includes('max-width') && window.innerWidth <= max; },
        media: query,
        addEventListener: (_type: string, notify: () => void) => { changes.add(notify); },
        removeEventListener: (_type: string, notify: () => void) => { changes.delete(notify); },
      };
    });
    vi.stubGlobal('innerWidth', 390);
    await openWindow();
    const box = await openFromMenu();
    await pick(box, /Traits/, 'Introduction');
    await userEvent.click(within(box).getByRole('button', { name: 'Close Guide' }));
    await waitFor(() => expect(guideScreen()).toBeNull());

    act(() => screenWidth(1600));
    await waitFor(() => expect(helpWindow().getAttribute('data-fq-sheet')).toBeNull());    expect(helpWindow().querySelector('[data-fq-piece="reader"]')).toBeNull();
  });
});

describe('Open Guide on the mobile sheet', () => {
  beforeEach(() => {
    storeFramedWindow();
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('matchMedia', (query: string) => {
      const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
      return { matches: query.includes('max-width') && 390 <= max, media: query, addEventListener: () => {}, removeEventListener: () => {} };
    });
  });

  it('shows the contents, then the section behind a Contents row', async () => {
    await openWindow();
    await userEvent.click(screen.getByRole('button', { name: 'Open Guide' }));
    const box = await screen.findByRole('dialog', { name: 'Guide' });
    expect(within(box).queryByText('Select a section to read')).toBeNull();

    await pick(box, /Traits/, 'Introduction');
    expect(article(box, /Traits/)).not.toBeNull();
    expect(within(box).queryByRole('navigation', { name: 'Guide Contents' })).toBeNull();

    await userEvent.click(within(box).getByRole('button', { name: 'Contents' }));
    expect(within(box).getByRole('navigation', { name: 'Guide Contents' })).toBeInTheDocument();
  });
});
