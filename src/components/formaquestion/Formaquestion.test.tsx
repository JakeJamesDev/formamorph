import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex, type DocsIndex } from '@/lib/docs/docsIndex';
import { NARROW_WIDTH, WIDE_WIDTH } from '@/lib/formaquestion/windowBox';
import { openDocs } from '@/lib/formaquestion/docsOpener';

// The AI settings come from the app's providers. No test here asks a question.
vi.mock('./useHelpAi', () => import('@/test/idleHelpAi'));
import { storeFramedWindow, storeWindowBox } from '@/test/helpFixtures';
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Home: '# 🏠 Home\n\nWelcome. Read [Stats](Stats#the-panel) first.\n',
  Stats: [
    '# 📊 Stats',
    '',
    'Stats are numbers. See [the fields](#fields), [Traits](Traits) and [the site](https://example.com/stats).',
    '',
    '## The Panel',
    '',
    'The panel shows each number.',
    '',
    '### Fields',
    '',
    'Each field has a label.',
    '',
    '## How to Add a Stat',
    '',
    '1. Select **Add**.',
  ].join('\n'),
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\nSelect **Add** on the Traits tab. A trait can add to a stat.\n',
};
const SIDEBAR = '- [Home](Home)\n- [Stats](Stats)\n- [Traits](Traits)\n';

const fixtureIndex = () => createDocsIndex({ pages: PAGES, sidebar: SIDEBAR });
const loadFixture = () => Promise.resolve(fixtureIndex());

const helpTab = () => screen.queryByRole('button', { name: 'Help' });
const helpWindow = () => screen.queryByRole('dialog', { name: 'Formaquestion' });
const pressF1 = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'F1' });

/** Renders the app's one Formaquestion and opens the window, with the fixture docs loaded. */
async function openWindow(loadIndex: () => Promise<DocsIndex> = loadFixture) {
  const view = render(<Formaquestion loadIndex={loadIndex} />);
  fireEvent.click(helpTab()!);
  await screen.findByRole('textbox', { name: 'Ask a Question' });
  return view;
}

/** Opens the window and goes to its Search tab. */
async function openSearch() {
  const view = await openWindow();
  await userEvent.click(screen.getByRole('tab', { name: 'Search' }));
  return view;
}

function setScreenWidth(width: number) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('matchMedia', (query: string) => {
    const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
    return {
      matches: query.includes('max-width') && width <= max,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });
}

beforeEach(() => {
  localStorage.clear();
  storeFramedWindow();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('opening and closing', () => {
  it('opens from the Help tab and closes from the Close control', async () => {
    await openWindow();
    expect(helpTab()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    expect(helpTab()).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(helpWindow()).toBeNull());
  });

  it('does not load the docs before the first open', async () => {
    const loadIndex = vi.fn(loadFixture);
    render(<Formaquestion loadIndex={loadIndex} />);
    expect(loadIndex).not.toHaveBeenCalled();
    pressF1();
    await screen.findByRole('textbox', { name: 'Ask a Question' });
    expect(loadIndex).toHaveBeenCalledTimes(1);
  });

  it('F1 opens the window and puts the cursor in the question field', async () => {
    render(<Formaquestion loadIndex={loadFixture} />);
    pressF1();
    const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
    await waitFor(() => expect(field).toHaveFocus());
  });

  it('F1 moves the cursor into an open window first, and closes the window on the next press', async () => {
    render(<><input aria-label="Outside" /><Formaquestion loadIndex={loadFixture} /></>);
    pressF1();
    const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
    const outside = screen.getByRole('textbox', { name: 'Outside' });
    outside.focus();

    pressF1();
    expect(field).toHaveFocus();
    expect(helpTab()).toHaveAttribute('aria-expanded', 'true');

    pressF1();
    expect(helpTab()).toHaveAttribute('aria-expanded', 'false');
    // Focus goes back to where it was before the window took it.
    expect(outside).toHaveFocus();
  });

  it('does not close on Escape, and Escape keeps the search text', async () => {
    await openSearch();
    const field = screen.getByRole('searchbox', { name: 'Search the Guide' });
    fireEvent.change(field, { target: { value: 'stat' } });
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    field.dispatchEvent(escape);
    expect(helpWindow()).not.toBeNull();
    expect(helpTab()).toHaveAttribute('aria-expanded', 'true');
    // A search field clears on Escape unless the key is prevented.
    expect(escape.defaultPrevented).toBe(true);
  });

  it('keeps the cursor in the window when a press removes the control it was on', async () => {
    render(<Formaquestion loadIndex={loadFixture} />);
    await userEvent.click(helpTab()!);
    await userEvent.click(await screen.findByRole('tab', { name: 'Search' }));
    const field = screen.getByRole('searchbox', { name: 'Search the Guide' });
    await userEvent.type(field, 'panel');
    // The result row leaves the screen when its section opens.
    await userEvent.click(within(screen.getByRole('list', { name: 'Search Results' })).getByText('The Panel'));
    await waitFor(() => expect(helpWindow()).toContainElement(document.activeElement as HTMLElement));

    // So the next F1 closes the window, and focus goes back to the tab that opened it.
    pressF1();
    expect(helpTab()).toHaveAttribute('aria-expanded', 'false');
    expect(helpTab()).toHaveFocus();
  });

  it('does not toggle again while F1 is held down', async () => {
    await openWindow();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'F1', repeat: true });
    expect(helpTab()).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the search text and the open section across a close', async () => {
    await openSearch();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'panel' } });
    fireEvent.click(within(screen.getByRole('list', { name: 'Search Results' })).getByText('The Panel'));
    expect(screen.getByRole('article', { name: '📊 Stats: The Panel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    await waitFor(() => expect(helpWindow()).toBeNull());
    fireEvent.click(helpTab()!);

    expect(screen.getByRole('article', { name: '📊 Stats: The Panel' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Search' }));
    expect(screen.getByRole('searchbox', { name: 'Search the Guide' })).toHaveValue('panel');
  });
});

describe('while it stands down', () => {
  it('shows no tab and ignores F1 while something covers the screen', () => {
    const loadIndex = vi.fn(loadFixture);
    render(<Formaquestion suspended loadIndex={loadIndex} />);
    expect(helpTab()).toBeNull();
    const key = new KeyboardEvent('keydown', { key: 'F1', bubbles: true, cancelable: true });
    document.body.dispatchEvent(key);
    expect(helpWindow()).toBeNull();
    expect(loadIndex).not.toHaveBeenCalled();
    expect(key.defaultPrevented).toBe(false);
  });

  it('hides an open window while suspended and shows it again with its state', async () => {
    const view = await openSearch();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'trait' } });

    view.rerender(<Formaquestion suspended loadIndex={loadFixture} />);
    expect(helpWindow()).toBeNull();
    expect(helpTab()).toBeNull();

    view.rerender(<Formaquestion loadIndex={loadFixture} />);
    expect(screen.getByRole('searchbox', { name: 'Search the Guide' })).toHaveValue('trait');
  });

  it('does not take the cursor when it shows again', async () => {
    const tree = (suspended: boolean) => <><input aria-label="Outside" /><Formaquestion suspended={suspended} loadIndex={loadFixture} /></>;
    const view = render(tree(false));
    fireEvent.click(helpTab()!);
    await screen.findByRole('textbox', { name: 'Ask a Question' });

    view.rerender(tree(true));
    const outside = screen.getByRole('textbox', { name: 'Outside' });
    outside.focus();
    view.rerender(tree(false));

    expect(helpWindow()).not.toBeNull();
    expect(outside).toHaveFocus();
  });
});

describe('search', () => {
  it('asks for two letters before it searches', async () => {
    await openSearch();
    expect(screen.getByText('Type two or more letters')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 's' } });
    expect(screen.getByText('Type two or more letters')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Search Results' })).toBeNull();
  });

  it('shows ranked sections, each with its heading, its page and the start of its text', async () => {
    await openSearch();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'add a trait' } });
    const rows = within(screen.getByRole('list', { name: 'Search Results' })).getAllByRole('button');
    // The heading match leads; a section that only names traits in its text follows.
    expect(rows[0]).toHaveTextContent('How to Add a Trait');
    expect(rows[0]).toHaveTextContent('🧬 Traits');
    expect(rows[0]).toHaveTextContent('Select Add on the Traits tab.');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('shows an empty state when no section matches', async () => {
    await openSearch();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'zeppelin' } });
    expect(screen.getByRole('status')).toHaveTextContent('No sections match “zeppelin”');
    expect(screen.queryByRole('list', { name: 'Search Results' })).toBeNull();
  });

  it('opens a result in the reader', async () => {
    await openSearch();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'add a stat' } });
    fireEvent.click(within(screen.getByRole('list', { name: 'Search Results' })).getAllByRole('button')[0]);
    const article = screen.getByRole('article', { name: '📊 Stats: How to Add a Stat' });
    expect(article).toHaveTextContent('Select Add.');
    expect(screen.getByRole('tab', { name: 'Guide' })).toHaveAttribute('data-state', 'active');
  });
});

describe('the guide', () => {
  async function openGuideTab() {
    await openWindow();
    await userEvent.click(screen.getByRole('tab', { name: 'Guide' }));
    return screen.getByRole('navigation', { name: 'Guide Contents' });
  }

  it('lists every page of the index, in sidebar order', async () => {
    const contents = await openGuideTab();
    const pages = fixtureIndex().contents().map((page) => page.title);
    expect(pages).toEqual(['🏠 Home', '📊 Stats', '🧬 Traits']);
    const listed = within(contents).getAllByRole('button').map((button) => button.textContent);
    expect(listed).toEqual(pages);
  });

  it('shows a page\'s sections on a click, and a section in the reader on the next', async () => {
    const contents = await openGuideTab();
    await userEvent.click(within(contents).getByRole('button', { name: '📊 Stats' }));
    expect(within(contents).getByRole('button', { name: 'Introduction' })).toBeInTheDocument();
    await userEvent.click(within(contents).getByRole('button', { name: 'The Panel' }));

    const article = screen.getByRole('article', { name: '📊 Stats: The Panel' });
    expect(article).toHaveTextContent('The panel shows each number.');
    expect(within(article).getByRole('heading', { name: 'The Panel', level: 3 })).toBeInTheDocument();
  });

  it('goes back to the contents from a section', async () => {
    const contents = await openGuideTab();
    await userEvent.click(within(contents).getByRole('button', { name: '🧬 Traits' }));
    await userEvent.click(within(contents).getByRole('button', { name: 'How to Add a Trait' }));
    await userEvent.click(screen.getByRole('button', { name: 'Contents' }));
    expect(screen.queryByRole('article')).toBeNull();
    // The list shows where the player was: the page is still open and the section is marked.
    const back = screen.getByRole('navigation', { name: 'Guide Contents' });
    expect(within(back).getByRole('button', { name: 'How to Add a Trait' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(back).queryByRole('button', { name: 'How to Add a Stat' })).toBeNull();
  });

  it('opens the page of a section that came from a search, and marks the section', async () => {
    await openSearch();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'add a stat' } });
    fireEvent.click(within(screen.getByRole('list', { name: 'Search Results' })).getAllByRole('button')[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Contents' }));
    const contents = screen.getByRole('navigation', { name: 'Guide Contents' });
    expect(within(contents).getByRole('button', { name: 'How to Add a Stat' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the pages the player opened and closed, across a section and a tab change', async () => {
    const contents = await openGuideTab();
    await userEvent.click(within(contents).getByRole('button', { name: '📊 Stats' }));
    await userEvent.click(within(contents).getByRole('button', { name: '🧬 Traits' }));
    await userEvent.click(within(contents).getByRole('button', { name: 'How to Add a Trait' }));
    await userEvent.click(screen.getByRole('button', { name: 'Contents' }));

    // Both pages are still open.
    let back = screen.getByRole('navigation', { name: 'Guide Contents' });
    expect(within(back).getByRole('button', { name: 'The Panel' })).toBeInTheDocument();
    expect(within(back).getByRole('button', { name: 'How to Add a Trait' })).toBeInTheDocument();

    // A page the player closes stays closed, even though it holds the open section.
    await userEvent.click(within(back).getByRole('button', { name: '🧬 Traits' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Search' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Guide' }));
    back = screen.getByRole('navigation', { name: 'Guide Contents' });
    expect(within(back).queryByRole('button', { name: 'How to Add a Trait' })).toBeNull();
    expect(within(back).getByRole('button', { name: 'The Panel' })).toBeInTheDocument();
  });

  it('lists the other sections of the page under a section, and opens one', async () => {
    const contents = await openGuideTab();
    await userEvent.click(within(contents).getByRole('button', { name: '📊 Stats' }));
    await userEvent.click(within(contents).getByRole('button', { name: 'The Panel' }));
    const article = screen.getByRole('article');
    expect(within(article).getByText('On This Page')).toBeInTheDocument();
    await userEvent.click(within(article).getByRole('button', { name: 'How to Add a Stat' }));
    expect(screen.getByRole('article', { name: '📊 Stats: How to Add a Stat' })).toBeInTheDocument();
  });
});

describe('links in the reader', () => {
  async function openStatsIntroduction() {
    await openWindow();
    await userEvent.click(screen.getByRole('tab', { name: 'Guide' }));
    const contents = screen.getByRole('navigation', { name: 'Guide Contents' });
    await userEvent.click(within(contents).getByRole('button', { name: '📊 Stats' }));
    await userEvent.click(within(contents).getByRole('button', { name: 'Introduction' }));
    return screen.getByRole('article', { name: '📊 Stats: 📊 Stats' });
  }

  it('opens a link to another docs page in the reader', async () => {
    const article = await openStatsIntroduction();
    const link = await within(article).findByRole('link', { name: 'Traits' });
    expect(link).not.toHaveAttribute('target');
    await userEvent.click(link);
    expect(screen.getByRole('article', { name: '🧬 Traits: 🧬 Traits' })).toHaveTextContent('A trait changes a stat.');
  });

  it('opens a link to a sub-heading in the section that holds it', async () => {
    const article = await openStatsIntroduction();
    await userEvent.click(await within(article).findByRole('link', { name: 'the fields' }));
    expect(screen.getByRole('article', { name: '📊 Stats: The Panel' })).toHaveTextContent('Each field has a label.');
  });

  it('sends a link to an outside site to the browser', async () => {
    const article = await openStatsIntroduction();
    const link = await within(article).findByRole('link', { name: 'the site' });
    expect(link).toHaveAttribute('href', 'https://example.com/stats');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await userEvent.click(link);
    // The reader stays on its section.
    expect(screen.getByRole('article', { name: '📊 Stats: 📊 Stats' })).toBeInTheDocument();
  });
});

describe('the window on the screen', () => {
  const frame = () => helpWindow() as HTMLElement;

  it('opens at the place and size this device stored', async () => {
    storeWindowBox({ x: 40, y: 60, w: 420, h: 380 });
    await openWindow();
    expect(frame().style).toMatchObject({ left: '40px', top: '60px', width: '420px', height: '380px' });
  });

  it('opens at its default place when storage of the box is blocked', async () => {
    // Only the box's key: with every key blocked the settings read as defaults, and the Mascot's chrome shows.
    const blocked = (key: string) => key === 'formamorph.formaquestion.window';
    const { getItem, setItem } = Storage.prototype;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (blocked(key)) throw new DOMException('blocked', 'SecurityError');
      return getItem.call(this, key);
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (blocked(key)) throw new DOMException('blocked', 'SecurityError');
      setItem.call(this, key, value);
    });
    await openWindow();
    expect(frame().style.width).toBe(`${NARROW_WIDTH}px`);
    await userEvent.click(screen.getByRole('button', { name: 'Wide View' }));
    expect(frame().style.width).toBe(`${WIDE_WIDTH}px`);
  });

  it('orders the title bar controls Wide View, Menu, Close, and Wide View keeps one icon in both states', async () => {
    setScreenWidth(1600);
    vi.stubGlobal('innerHeight', 900);
    await openSearch();
    const header = frame().querySelector('header')!;
    const order = () => {
      const buttons = within(header).getAllByRole('button');
      return ['Wide View', 'More Actions', 'Close Formaquestion'].map((name) => buttons.indexOf(within(header).getByRole('button', { name })));
    };
    expect(order()).toEqual([0, 1, 2]);

    const wideView = within(header).getByRole('button', { name: 'Wide View' });
    const icon = wideView.querySelector('svg')!.getAttribute('class');
    await userEvent.click(wideView);
    expect(wideView).toHaveAttribute('aria-pressed', 'true');
    expect(wideView.querySelector('svg')!.getAttribute('class')).toBe(icon);
    expect(order()).toEqual([0, 1, 2]);
  });

  it('lists Clear Conversation, AI Context and Settings, and hangs from the corner of the button that has room', async () => {
    setScreenWidth(1600);
    vi.stubGlobal('innerHeight', 900);
    await openSearch();
    const button = within(frame().querySelector('header')!).getByRole('button', { name: 'More Actions' });
    const anchors: number[] = [];
    button.addEventListener('contextmenu', (event) => anchors.push(event.clientX));
    const at = (left: number) => vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left, right: left + 32, top: 8, bottom: 40, width: 32, height: 32, x: left, y: 8, toJSON: () => ({}) });

    at(100);
    await userEvent.click(button);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Clear Conversation', 'AI Context', 'Settings']);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    at(1500);
    await userEvent.click(button);
    await screen.findByRole('menu');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    // Room on the right: the button's left edge. No room: its right edge, so the menu opens leftward from it.
    expect(anchors).toEqual([100, 1532]);
  });

  it('does not start a window move from a press on a menu item', async () => {
    setScreenWidth(1600);
    vi.stubGlobal('innerHeight', 900);
    await openSearch();
    const header = frame().querySelector('header')!;
    const left = frame().style.left;
    await userEvent.click(within(header).getByRole('button', { name: 'More Actions' }));
    const item = await screen.findByRole('menuitem', { name: 'AI Context' });
    // The menu renders outside the title bar, but React routes its events through the title bar's handlers.
    fireEvent.pointerDown(item, { button: 0, pointerId: 1, clientX: 300, clientY: 100 });
    fireEvent.pointerMove(header, { pointerId: 1, clientX: 400, clientY: 160 });
    fireEvent.pointerUp(header, { pointerId: 1 });
    expect(frame().style.left).toBe(left);
  });

  it('swaps to the wide layout and back with Wide View, keeps the open section, and stores the width', async () => {
    setScreenWidth(1600);
    vi.stubGlobal('innerHeight', 900);
    await openSearch();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'panel' } });
    fireEvent.click(within(screen.getByRole('list', { name: 'Search Results' })).getByText('The Panel'));

    const wideView = screen.getByRole('button', { name: 'Wide View' });
    expect(wideView).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(wideView);

    expect(wideView).toHaveAttribute('aria-pressed', 'true');
    expect(frame().style.width).toBe(`${WIDE_WIDTH}px`);
    // Wide: no tabs, the search and the section side by side.
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByRole('searchbox', { name: 'Search the Guide' })).toHaveValue('panel');
    expect(screen.getByRole('article', { name: '📊 Stats: The Panel' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('formamorph.formaquestion.window')!).full.w).toBe(WIDE_WIDTH);

    await userEvent.click(wideView);
    expect(frame().style.width).toBe(`${NARROW_WIDTH}px`);
    expect(screen.getByRole('article', { name: '📊 Stats: The Panel' })).toBeInTheDocument();
  });

  it('keeps its place and size across a trip to a mobile-size screen', async () => {
    setScreenWidth(1600);
    vi.stubGlobal('innerHeight', 900);
    storeWindowBox({ x: 800, y: 200, w: 720, h: 560 });
    await openWindow();

    // The browser goes to a mobile width, where the window does not show, and comes back.
    vi.stubGlobal('innerWidth', 375);
    act(() => { window.dispatchEvent(new Event('resize')); });
    vi.stubGlobal('innerWidth', 1600);
    act(() => { window.dispatchEvent(new Event('resize')); });

    expect(frame().style).toMatchObject({ left: '800px', top: '200px', width: '720px', height: '560px' });
  });

  it('comes back inside the screen when the browser window gets smaller', async () => {
    setScreenWidth(1600);
    vi.stubGlobal('innerHeight', 900);
    storeWindowBox({ x: 1150, y: 300, w: 400, h: 560 });
    await openWindow();
    expect(frame().style.left).toBe('1150px');

    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 700);
    act(() => { window.dispatchEvent(new Event('resize')); });

    const { left, top, width, height } = frame().style;
    expect(parseFloat(left) + parseFloat(width)).toBeLessThanOrEqual(1000);
    expect(parseFloat(top) + parseFloat(height)).toBeLessThanOrEqual(700);
  });
});

describe('on a mobile-size screen', () => {
  beforeEach(() => setScreenWidth(375));

  it('opens a full-screen sheet from the Help tab, with no Wide View and no resize grip', async () => {
    await openWindow();
    const sheet = helpWindow() as HTMLElement;
    expect(sheet).toHaveAttribute('data-fq-sheet');
    expect(sheet.style.width).toBe('');
    expect(within(sheet).queryByRole('button', { name: 'Wide View' })).toBeNull();
    expect(sheet.querySelector('[data-fq-resize]')).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Formaquestion Parts' })).toBeInTheDocument();
  });

  it('puts focus on the sheet, not in a field, so no keyboard opens', async () => {
    await openWindow();
    await waitFor(() => expect(helpWindow()).toHaveFocus());
    expect(screen.getByRole('textbox', { name: 'Ask a Question' })).not.toHaveFocus();
  });

  it('hides the Help tab while the sheet is open', async () => {
    render(<Formaquestion loadIndex={loadFixture} />);
    await userEvent.click(helpTab()!);
    await screen.findByRole('textbox', { name: 'Ask a Question' });
    // A hidden tab leaves the accessibility tree.
    expect(helpTab()).toBeNull();
    expect(document.querySelector('[data-fq-launcher]')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    expect(helpTab()).toBeVisible();
    // Focus goes back to the tab that opened the sheet.
    expect(helpTab()).toHaveFocus();
  });

  it('leads from the contents to the reader and back in one column', async () => {
    await openWindow();
    await userEvent.click(screen.getByRole('tab', { name: 'Guide' }));
    const contents = screen.getByRole('navigation', { name: 'Guide Contents' });
    await userEvent.click(within(contents).getByRole('button', { name: '📊 Stats' }));
    await userEvent.click(within(contents).getByRole('button', { name: 'The Panel' }));
    expect(screen.getByRole('article', { name: '📊 Stats: The Panel' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Guide Contents' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Contents' }));
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Guide Contents' })).toBeInTheDocument();
  });
});

describe('the Help tab', () => {
  it('says how to move it with the keyboard', () => {
    render(<Formaquestion loadIndex={loadFixture} />);
    expect(helpTab()).toHaveAccessibleDescription('Press the arrow keys to move this tab');
  });

  it('moves along its edge on an arrow key and stores the place', () => {
    render(<Formaquestion loadIndex={loadFixture} />);
    expect(helpTab()).toHaveAttribute('data-fq-edge', 'right');
    fireEvent.keyDown(helpTab()!, { key: 'ArrowUp' });
    expect(JSON.parse(localStorage.getItem('formamorph.formaquestion.tab')!)).toEqual({ edge: 'right', at: 0.45 });
    expect(helpTab()!.style.top).toBe('45%');
  });

  it('goes to the opposite edge on an arrow away from its edge, and does not open the window', () => {
    render(<Formaquestion loadIndex={loadFixture} />);
    fireEvent.keyDown(helpTab()!, { key: 'ArrowLeft' });
    expect(helpTab()).toHaveAttribute('data-fq-edge', 'left');
    expect(helpTab()).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows at the place this device stored', () => {
    localStorage.setItem('formamorph.formaquestion.tab', JSON.stringify({ edge: 'top', at: 0.25 }));
    render(<Formaquestion loadIndex={loadFixture} />);
    expect(helpTab()).toHaveAttribute('data-fq-edge', 'top');
    expect(helpTab()!.style.left).toBe('25%');
  });
});

describe('a guide that does not load', () => {
  it('says so, and loads on Try Again', async () => {
    const loadIndex = vi.fn<() => Promise<DocsIndex>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockImplementation(loadFixture);
    render(<Formaquestion loadIndex={loadIndex} />);
    fireEvent.click(helpTab()!);
    expect(await screen.findByRole('alert')).toHaveTextContent('The guide did not load');
    expect(loadIndex).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('textbox', { name: 'Ask a Question' })).toBeInTheDocument();
    expect(loadIndex).toHaveBeenCalledTimes(2);
  });
});

describe('unmount', () => {
  it('removes every window listener it added', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    /** The keydown and resize listeners that are on the window now: added, and not removed since. */
    const live = () => {
      // The spy takes the type of the last overload, which names one event only.
      const calls = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls as [string, unknown][];
      const listeners = calls(add).filter(([type]) => type === 'keydown' || type === 'resize').map(([type, listener]) => ({ type, listener }));
      for (const [type, listener] of calls(remove)) {
        const at = listeners.findIndex((entry) => entry.type === type && entry.listener === listener);
        if (at >= 0) listeners.splice(at, 1);
      }
      return listeners.map((entry) => entry.type).sort();
    };

    const view = await openWindow();
    // F1, the window's screen fit and the tab's screen fit.
    expect(live()).toEqual(['keydown', 'resize', 'resize']);
    view.unmount();
    expect(live()).toEqual([]);
  });

  it('leaves no timer behind when it unmounts in the close animation', async () => {
    const view = await openWindow();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    // The window waits for its close animation, on a timed backstop.
    expect(helpWindow()).not.toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not open after it unmounts', async () => {
    const loadIndex = vi.fn(loadFixture);
    const view = render(<Formaquestion loadIndex={loadIndex} />);
    view.unmount();
    pressF1();
    expect(loadIndex).not.toHaveBeenCalled();
  });
});

describe('opening a docs heading from outside', () => {
  it('opens the closed window at the section that holds the heading, with the docs still loading', async () => {
    render(<Formaquestion loadIndex={loadFixture} />);
    expect(helpWindow()).toBeNull();
    act(() => { expect(openDocs({ page: 'Stats', anchor: 'fields' })).toBe(true); });
    expect(await screen.findByRole('article', { name: '📊 Stats: The Panel' })).toBeInTheDocument();
    expect(helpTab()).toHaveAttribute('aria-expanded', 'true');
  });

  it('moves an open window from its search to the section', async () => {
    await openWindow();
    act(() => { openDocs({ page: 'Traits' }); });
    expect(await screen.findByRole('article', { name: '🧬 Traits: 🧬 Traits' })).toBeInTheDocument();
  });

  it('opens the wiki page when the heading is not in the docs', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<Formaquestion loadIndex={loadFixture} />);
    act(() => { openDocs({ page: 'Stats', anchor: 'nope' }); });
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.stringContaining('/wiki/Stats#nope'), '_blank', 'noopener,noreferrer'));
  });

  it('drops a pending request when the docs fail to load', async () => {
    const loadIndex = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(loadFixture);
    render(<Formaquestion loadIndex={loadIndex} />);
    act(() => { openDocs({ page: 'Traits' }); });
    await userEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('textbox', { name: 'Ask a Question' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('is not reachable while suspended, so the link falls back to the wiki', () => {
    render(<Formaquestion suspended loadIndex={loadFixture} />);
    expect(openDocs({ page: 'Stats' })).toBe(false);
  });

  it('stops answering after unmount', () => {
    render(<Formaquestion loadIndex={loadFixture} />).unmount();
    expect(openDocs({ page: 'Stats' })).toBe(false);
  });
});
