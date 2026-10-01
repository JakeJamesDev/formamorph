import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex, type DocsIndex } from '@/lib/docs/docsIndex';
import { NARROW_WIDTH, WIDE_WIDTH } from '@/lib/formaquestion/windowBox';
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
  await screen.findByRole('searchbox', { name: 'Search the Guide' });
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

beforeEach(() => localStorage.clear());
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
    await screen.findByRole('searchbox', { name: 'Search the Guide' });
    expect(loadIndex).toHaveBeenCalledTimes(1);
  });

  it('F1 opens the window and puts the cursor in the search field', async () => {
    render(<Formaquestion loadIndex={loadFixture} />);
    pressF1();
    const field = await screen.findByRole('searchbox', { name: 'Search the Guide' });
    await waitFor(() => expect(field).toHaveFocus());
  });

  it('F1 moves the cursor into an open window first, and closes the window on the next press', async () => {
    render(<><input aria-label="Outside" /><Formaquestion loadIndex={loadFixture} /></>);
    pressF1();
    const field = await screen.findByRole('searchbox', { name: 'Search the Guide' });
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
    await openWindow();
    const field = screen.getByRole('searchbox', { name: 'Search the Guide' });
    fireEvent.change(field, { target: { value: 'stat' } });
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    field.dispatchEvent(escape);
    expect(helpWindow()).not.toBeNull();
    expect(helpTab()).toHaveAttribute('aria-expanded', 'true');
    // A search field clears on Escape unless the key is prevented.
    expect(escape.defaultPrevented).toBe(true);
  });

  it('keeps the search text and the open section across a close', async () => {
    await openWindow();
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

  it('shows no tab and ignores F1 on a mobile-size screen', () => {
    setScreenWidth(600);
    render(<Formaquestion loadIndex={loadFixture} />);
    expect(helpTab()).toBeNull();
    pressF1();
    expect(helpWindow()).toBeNull();
  });

  it('hides an open window while suspended and shows it again with its state', async () => {
    const view = await openWindow();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'trait' } });

    view.rerender(<Formaquestion suspended loadIndex={loadFixture} />);
    expect(helpWindow()).toBeNull();
    expect(helpTab()).toBeNull();

    view.rerender(<Formaquestion loadIndex={loadFixture} />);
    expect(screen.getByRole('searchbox', { name: 'Search the Guide' })).toHaveValue('trait');
  });
});

describe('search', () => {
  it('asks for two letters before it searches', async () => {
    await openWindow();
    expect(screen.getByText('Type two or more letters')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 's' } });
    expect(screen.getByText('Type two or more letters')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Search Results' })).toBeNull();
  });

  it('shows ranked sections, each with its heading, its page and the start of its text', async () => {
    await openWindow();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'add a trait' } });
    const rows = within(screen.getByRole('list', { name: 'Search Results' })).getAllByRole('button');
    // The heading match leads; a section that only names traits in its text follows.
    expect(rows[0]).toHaveTextContent('How to Add a Trait');
    expect(rows[0]).toHaveTextContent('🧬 Traits');
    expect(rows[0]).toHaveTextContent('Select Add on the Traits tab.');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('shows an empty state when no section matches', async () => {
    await openWindow();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'zeppelin' } });
    expect(screen.getByRole('status')).toHaveTextContent('No sections match “zeppelin”');
    expect(screen.queryByRole('list', { name: 'Search Results' })).toBeNull();
  });

  it('opens a result in the reader', async () => {
    await openWindow();
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
    localStorage.setItem('formamorph.formaquestion.window', JSON.stringify({ x: 40, y: 60, w: 420, h: 380 }));
    await openWindow();
    expect(frame().style).toMatchObject({ left: '40px', top: '60px', width: '420px', height: '380px' });
  });

  it('opens at its default place when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    await openWindow();
    expect(frame().style.width).toBe(`${NARROW_WIDTH}px`);
    await userEvent.click(screen.getByRole('button', { name: 'Wide View' }));
    expect(frame().style.width).toBe(`${WIDE_WIDTH}px`);
  });

  it('swaps to the wide layout and back with Wide View, keeps the open section, and stores the width', async () => {
    setScreenWidth(1600);
    vi.stubGlobal('innerHeight', 900);
    await openWindow();
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
    expect(JSON.parse(localStorage.getItem('formamorph.formaquestion.window')!).w).toBe(WIDE_WIDTH);

    await userEvent.click(wideView);
    expect(frame().style.width).toBe(`${NARROW_WIDTH}px`);
    expect(screen.getByRole('article', { name: '📊 Stats: The Panel' })).toBeInTheDocument();
  });

  it('comes back inside the screen when the browser window gets smaller', async () => {
    setScreenWidth(1600);
    vi.stubGlobal('innerHeight', 900);
    localStorage.setItem('formamorph.formaquestion.window', JSON.stringify({ x: 1150, y: 300, w: 400, h: 560 }));
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
    expect(await screen.findByRole('searchbox', { name: 'Search the Guide' })).toBeInTheDocument();
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
