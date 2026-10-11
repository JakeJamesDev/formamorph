import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex, SECTION_CHAR_LIMIT } from '@/lib/docs/docsIndex';
import { openDocs } from '@/lib/formaquestion/docsOpener';
import { WIDE_WIDTH } from '@/lib/formaquestion/windowBox';
import { openHelpSettings, storeFramedWindow, storeMinimalWindow, storeWindowBox } from '@/test/helpFixtures';

// The AI settings come from the app's providers. No test here asks a question.
vi.mock('./useHelpAi', () => import('@/test/idleHelpAi'));
import { Formaquestion } from './Formaquestion';

const WIKI = 'https://github.com/JakeJamesDev/formamorph/wiki';
const filler = Array.from({ length: Math.ceil((SECTION_CHAR_LIMIT * 2) / 30) }, (_, i) => `- **Entry ${i}:** a tile moves.`);
const PAGES = {
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## The Panel\n\nThe panel shows each number.\n',
  Tiles: ['# 🧱 Tiles', '', 'Tiles move.', '', '## The Long List', '', ...filler, ''].join('\n'),
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n- [Tiles](Tiles)\n' }));

const helpWindow = () => screen.getByRole('dialog', { name: 'Formaquestion' });
const confirm = () => screen.queryByRole('alertdialog', { name: 'Open Wiki' });
const open = vi.fn();

async function openWindow() {
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await screen.findByRole('textbox', { name: 'Ask a Question' });
}

async function openWikiFromMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'More Actions' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Open Wiki' }));
}

/** Opens a row of a page in the contents list of the Guide tab, opening the page first when it is shut. */
async function readInWindow(page: RegExp, row: string) {
  await userEvent.click(screen.getByRole('tab', { name: 'Guide' }));
  const toggle = await within(helpWindow()).findByRole('button', { name: page });
  if (toggle.getAttribute('aria-expanded') !== 'true') await userEvent.click(toggle);
  await userEvent.click(within(toggle.parentElement!).getByRole('button', { name: row }));
}

/** Presses Open in the confirm. */
async function pressOpen() {
  await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Open Wiki' })).getByRole('button', { name: 'Open' }));
  await waitFor(() => expect(confirm()).toBeNull());
}

beforeEach(() => {
  localStorage.clear();
  open.mockReset();
  vi.spyOn(window, 'open').mockImplementation(open);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Open Wiki in the Full chrome', () => {
  beforeEach(() => storeFramedWindow());

  it('goes to the wiki page and heading of the section the Guide tab shows', async () => {
    await openWindow();
    await readInWindow(/Stats/, 'The Panel');

    await openWikiFromMenu();
    expect(within(confirm()!).getByText('Open the “Stats” page of the wiki in your browser?')).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    await pressOpen();

    expect(open).toHaveBeenCalledExactlyOnceWith(`${WIKI}/Stats#the-panel`, '_blank', 'noopener,noreferrer');
  });

  it('goes to the wiki home with no section open', async () => {
    await openWindow();
    await openWikiFromMenu();
    expect(within(confirm()!).getByText('Open the wiki home page in your browser?')).toBeInTheDocument();
    await pressOpen();

    expect(open).toHaveBeenCalledExactlyOnceWith(WIKI, '_blank', 'noopener,noreferrer');
  });

  it('drops the part suffix of a split section', async () => {
    await openWindow();
    await readInWindow(/Tiles/, 'The Long List (Part 2)');

    await openWikiFromMenu();
    await pressOpen();

    expect(open).toHaveBeenCalledExactlyOnceWith(`${WIKI}/Tiles#the-long-list`, '_blank', 'noopener,noreferrer');
  });

  it('goes to the home while the Ask tab covers a section the Guide opened before', async () => {
    await openWindow();
    await readInWindow(/Stats/, 'The Panel');
    await userEvent.click(screen.getByRole('tab', { name: 'Ask' }));

    await openWikiFromMenu();
    await pressOpen();

    expect(open).toHaveBeenCalledExactlyOnceWith(WIKI, '_blank', 'noopener,noreferrer');
  });

  it('leaves the window under the confirm, and keeps focus on the ⋮ button after Cancel', async () => {
    await openWindow();
    const mount = helpWindow().parentElement!;
    await openWikiFromMenu();
    await screen.findByRole('alertdialog', { name: 'Open Wiki' });
    expect(mount.inert).toBe(true);

    await userEvent.click(within(confirm()!).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(confirm()).toBeNull());
    expect(mount.inert).toBe(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'More Actions' })).toHaveFocus());
    expect(open).not.toHaveBeenCalled();
  });

  it('closes on Escape without opening the wiki', async () => {
    await openWindow();
    await openWikiFromMenu();
    await screen.findByRole('alertdialog', { name: 'Open Wiki' });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(confirm()).toBeNull());
    expect(open).not.toHaveBeenCalled();
  });

  it('asks again after a Cancel, even with Don’t Ask Again checked', async () => {
    await openWindow();
    await openWikiFromMenu();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Open Wiki' })).getByRole('checkbox', { name: 'Don’t Ask Again' }));
    await userEvent.click(within(confirm()!).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(confirm()).toBeNull());

    await openWikiFromMenu();

    const again = await screen.findByRole('alertdialog', { name: 'Open Wiki' });
    expect(within(again).getByRole('checkbox', { name: 'Don’t Ask Again' })).toHaveAttribute('aria-checked', 'false');
    expect(open).not.toHaveBeenCalled();
  });

  it('skips the confirm on later opens after Open with Don’t Ask Again, until the settings switch is turned back on', async () => {
    await openWindow();
    await openWikiFromMenu();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Open Wiki' })).getByRole('checkbox', { name: 'Don’t Ask Again' }));
    await pressOpen();
    expect(open).toHaveBeenCalledTimes(1);

    await openWikiFromMenu();
    expect(confirm()).toBeNull();
    expect(open).toHaveBeenCalledTimes(2);

    await openHelpSettings();
    const row = await within(await screen.findByRole('dialog', { name: 'Formaquestion Settings' })).findByRole('checkbox', { name: 'Confirm Before Opening the Wiki' });
    expect(row).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(row);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Formaquestion Settings' })).toBeNull());

    await openWikiFromMenu();
    await screen.findByRole('alertdialog', { name: 'Open Wiki' });
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('keeps the confirm switch on by default', async () => {
    await openWindow();
    await openHelpSettings();

    const row = await within(await screen.findByRole('dialog', { name: 'Formaquestion Settings' })).findByRole('checkbox', { name: 'Confirm Before Opening the Wiki' });
    expect(row).toHaveAttribute('aria-checked', 'true');
  });

  it('has a button in the full-screen Guide header that goes to the section it shows', async () => {
    await openWindow();
    await readInWindow(/Stats/, 'The Panel');
    await userEvent.click(screen.getByRole('button', { name: 'Open Guide' }));
    const box = await screen.findByRole('dialog', { name: 'Guide' });

    await userEvent.click(within(box).getByRole('button', { name: 'Open Wiki' }));
    await pressOpen();

    expect(open).toHaveBeenCalledExactlyOnceWith(`${WIKI}/Stats#the-panel`, '_blank', 'noopener,noreferrer');
    // The confirm closes alone: the full screen stays.
    expect(screen.getByRole('dialog', { name: 'Guide' })).toBeInTheDocument();
  });

  it('goes to the wiki home from the full-screen Guide with no section open', async () => {
    await openWindow();
    await userEvent.click(screen.getByRole('button', { name: 'Open Guide' }));
    const box = await screen.findByRole('dialog', { name: 'Guide' });

    await userEvent.click(within(box).getByRole('button', { name: 'Open Wiki' }));
    await pressOpen();

    expect(open).toHaveBeenCalledExactlyOnceWith(WIKI, '_blank', 'noopener,noreferrer');
  });
});

describe('Open Wiki in Wide View', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1600);
    vi.stubGlobal('innerHeight', 900);
    storeFramedWindow();
    storeWindowBox({ x: 400, y: 100, w: WIDE_WIDTH, h: 560 });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('goes to the section the reader shows, and to the home once the conversation takes its place', async () => {
    await openWindow();
    const toggle = await within(helpWindow()).findByRole('button', { name: /Stats/ });
    await userEvent.click(toggle);
    await userEvent.click(within(toggle.parentElement!).getByRole('button', { name: 'The Panel' }));

    await openWikiFromMenu();
    await pressOpen();
    expect(open).toHaveBeenLastCalledWith(`${WIKI}/Stats#the-panel`, '_blank', 'noopener,noreferrer');

    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'Back to Conversation' }));
    await openWikiFromMenu();
    await pressOpen();
    expect(open).toHaveBeenLastCalledWith(WIKI, '_blank', 'noopener,noreferrer');
  });
});

describe('Open Wiki in the Minimal chrome', () => {
  beforeEach(() => storeMinimalWindow({ mascot: false }));

  it('goes to the section the reader piece shows', async () => {
    await openWindow();
    act(() => { openDocs({ page: 'Stats', anchor: 'the-panel' }); });
    await waitFor(() => expect(helpWindow().querySelector('[data-fq-piece="reader"]')).not.toBeNull());

    await openWikiFromMenu();
    await pressOpen();

    expect(open).toHaveBeenCalledExactlyOnceWith(`${WIKI}/Stats#the-panel`, '_blank', 'noopener,noreferrer');
  });

  it('goes to the wiki home with the reader piece shut', async () => {
    await openWindow();
    await openWikiFromMenu();
    await pressOpen();

    expect(open).toHaveBeenCalledExactlyOnceWith(WIKI, '_blank', 'noopener,noreferrer');
  });
});

describe('Open Wiki in the Bubble chrome', () => {
  it('has the ⋮ item and goes to the wiki home with no section open', async () => {
    await openWindow();
    await openWikiFromMenu();
    await pressOpen();

    expect(open).toHaveBeenCalledExactlyOnceWith(WIKI, '_blank', 'noopener,noreferrer');
  });
});
