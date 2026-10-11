import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { WIDE_WIDTH } from '@/lib/formaquestion/windowBox';

// The AI settings come from the app's providers. No test here asks a question.
vi.mock('./useHelpAi', () => import('@/test/idleHelpAi'));
import { storeFramedWindow, storeWindowBox } from '@/test/helpFixtures';
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Home: '# 🏠 Home\n\nWelcome. Read [Stats](Stats) first.\n',
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## The Panel\n\nThe panel shows each number.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Home](Home)\n- [Stats](Stats)\n- [Traits](Traits)\n' }));

const helpWindow = () => screen.getByRole('dialog', { name: 'Formaquestion' });
const guideScreen = () => screen.queryByRole('dialog', { name: 'Guide' });
const reading = (scope: HTMLElement, name: RegExp) => within(scope).queryByRole('article', { name });
const askField = () => screen.queryByRole('textbox', { name: 'Ask a Question' });

function setScreenWidth(width: number) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('matchMedia', (query: string) => {
    const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
    return { matches: query.includes('max-width') && width <= max, media: query, addEventListener: () => {}, removeEventListener: () => {} };
  });
}

/** Renders the app's one Formaquestion and opens the window in Wide View. */
async function openWideWindow() {
  setScreenWidth(1600);
  storeWindowBox({ x: 400, y: 100, w: WIDE_WIDTH, h: 600 });
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await screen.findByRole('textbox', { name: 'Ask a Question' });
}

/** Opens a row of a page in the contents list, opening the page first when it is shut. */
async function pick(scope: HTMLElement, page: RegExp, row: string) {
  const toggle = await within(scope).findByRole('button', { name: page });
  if (toggle.getAttribute('aria-expanded') !== 'true') await userEvent.click(toggle);
  await userEvent.click(within(toggle.parentElement!).getByRole('button', { name: row }));
}

const control = (scope: HTMLElement, name: 'Back' | 'Forward') => within(scope).getByRole('button', { name });
const press = (scope: HTMLElement, name: 'Back' | 'Forward') => userEvent.click(control(scope, name));

beforeEach(() => {
  localStorage.clear();
  storeFramedWindow();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('reader history in Wide View', () => {
  it('starts with both buttons off and has none outside Wide View', async () => {
    await openWideWindow();
    expect(control(helpWindow(), 'Back')).toBeDisabled();
    expect(control(helpWindow(), 'Forward')).toBeDisabled();
    expect(control(helpWindow(), 'Back')).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowLeft');

    await userEvent.click(screen.getByRole('button', { name: 'Wide View' }));
    expect(within(helpWindow()).queryByRole('button', { name: 'Back' })).toBeNull();
    expect(within(helpWindow()).queryByRole('button', { name: 'Forward' })).toBeNull();
  });

  it('moves Back and Forward through the sections and the conversation, and adds no entries doing it', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    await pick(helpWindow(), /Stats/, 'The Panel');
    expect(reading(helpWindow(), /The Panel/)).not.toBeNull();
    expect(control(helpWindow(), 'Forward')).toBeDisabled();

    await press(helpWindow(), 'Back');
    expect(reading(helpWindow(), /Traits/)).not.toBeNull();
    await press(helpWindow(), 'Back');
    expect(askField()).not.toBeNull();
    expect(control(helpWindow(), 'Back')).toBeDisabled();

    await press(helpWindow(), 'Forward');
    await press(helpWindow(), 'Forward');
    expect(reading(helpWindow(), /The Panel/)).not.toBeNull();
    expect(control(helpWindow(), 'Forward')).toBeDisabled();
    expect(control(helpWindow(), 'Back')).toBeEnabled();
  });

  it('drops the forward entries when a new section opens', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    await pick(helpWindow(), /Stats/, 'The Panel');
    await press(helpWindow(), 'Back');
    expect(control(helpWindow(), 'Forward')).toBeEnabled();

    await pick(helpWindow(), /Home/, 'Introduction');

    expect(control(helpWindow(), 'Forward')).toBeDisabled();
    await press(helpWindow(), 'Back');
    expect(reading(helpWindow(), /Traits/)).not.toBeNull();
  });

  it('counts a switch to the conversation as an entry', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'Back to Conversation' }));
    expect(askField()).not.toBeNull();

    await press(helpWindow(), 'Back');
    expect(reading(helpWindow(), /Traits/)).not.toBeNull();
  });

  it('does not add an entry for a section that is already open', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    await pick(helpWindow(), /Traits/, 'Introduction');

    await press(helpWindow(), 'Back');
    expect(askField()).not.toBeNull();
  });

  it('restores the scroll position of the entry Back returns to', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Stats/, 'The Panel');
    const viewport = () => helpWindow().querySelector<HTMLElement>('[data-fq-scroll="reader"]')!;
    viewport().scrollTop = 120;
    fireEvent.scroll(viewport());

    await pick(helpWindow(), /Traits/, 'Introduction');
    expect(viewport().scrollTop).toBe(0);
    await press(helpWindow(), 'Back');

    expect(reading(helpWindow(), /The Panel/)).not.toBeNull();
    expect(viewport().scrollTop).toBe(120);
    await press(helpWindow(), 'Forward');
    expect(viewport().scrollTop).toBe(0);
  });

  it('keeps its trail across a close and a reopen', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Formaquestion' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    await screen.findByRole('dialog', { name: 'Formaquestion' });

    await press(helpWindow(), 'Back');
    expect(askField()).not.toBeNull();
  });
});

describe('reader history keys and mouse buttons', () => {
  it('steps on Alt+Left and Alt+Right while the input is in the window', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    helpWindow().focus();

    fireEvent.keyDown(helpWindow(), { key: 'ArrowLeft', altKey: true });
    expect(askField()).not.toBeNull();
    fireEvent.keyDown(helpWindow(), { key: 'ArrowRight', altKey: true });
    expect(reading(helpWindow(), /Traits/)).not.toBeNull();
  });

  it('steps once for a held key', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    await pick(helpWindow(), /Stats/, 'The Panel');
    helpWindow().focus();

    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, repeat: true, bubbles: true, cancelable: true });
    act(() => { helpWindow().dispatchEvent(event); });

    expect(event.defaultPrevented).toBe(true);
    expect(reading(helpWindow(), /The Panel/)).not.toBeNull();
  });

  it('leaves the keys alone when the input is outside the window, or Alt is not the only modifier', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');

    helpWindow().focus();
    fireEvent.keyDown(helpWindow(), { key: 'ArrowLeft', altKey: true, shiftKey: true });
    expect(reading(helpWindow(), /Traits/)).not.toBeNull();

    (document.activeElement as HTMLElement).blur();
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true });
    act(() => { document.body.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    expect(reading(helpWindow(), /Traits/)).not.toBeNull();
  });

  it('steps on the mouse back and forward buttons over the window and keeps them from the browser', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    // The section under the pointer leaves the page on a step, so the events go to the window itself.
    const over = helpWindow();

    const prevented = (type: string, button: number) => {
      const event = new MouseEvent(type, { button, bubbles: true, cancelable: true });
      act(() => { over.dispatchEvent(event); });
      return event.defaultPrevented;
    };
    expect(prevented('mousedown', 3)).toBe(true);
    expect(reading(helpWindow(), /Traits/)).not.toBeNull();
    expect(prevented('mouseup', 3)).toBe(true);
    expect(askField()).not.toBeNull();
    // At the start there is nowhere to go, and the browser still gets nothing.
    expect(prevented('mouseup', 3)).toBe(true);
    expect(askField()).not.toBeNull();

    expect(prevented('mouseup', 4)).toBe(true);
    expect(reading(helpWindow(), /Traits/)).not.toBeNull();
    expect(prevented('auxclick', 4)).toBe(true);
  });

  it('leaves the mouse buttons to the browser outside the window', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    const event = new MouseEvent('mouseup', { button: 3, bubbles: true, cancelable: true });
    act(() => { document.body.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    expect(reading(helpWindow(), /Traits/)).not.toBeNull();
  });
});

describe('reader history in the full-screen Guide', () => {
  /** Opens the full screen from the title bar. */
  async function openGuide() {
    await userEvent.click(screen.getByRole('button', { name: 'Open Guide' }));
    return screen.findByRole('dialog', { name: 'Guide' });
  }

  it('carries the trail from Wide View and back', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    await pick(helpWindow(), /Stats/, 'The Panel');

    const box = await openGuide();
    expect(control(box, 'Forward')).toBeDisabled();
    await press(box, 'Back');
    expect(reading(box, /Traits/)).not.toBeNull();

    await userEvent.click(within(box).getByRole('button', { name: 'Close Guide' }));
    await waitFor(() => expect(guideScreen()).toBeNull());
    expect(reading(helpWindow(), /Traits/)).not.toBeNull();
    expect(control(helpWindow(), 'Forward')).toBeEnabled();
  });

  it('passes over conversation entries and disables a direction with only conversation left', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'Back to Conversation' }));
    await pick(helpWindow(), /Stats/, 'The Panel');

    // Trail: conversation, Traits, conversation, The Panel.
    const box = await openGuide();
    await press(box, 'Back');
    expect(reading(box, /Traits/)).not.toBeNull();
    expect(control(box, 'Back')).toBeDisabled();
    await press(box, 'Forward');
    expect(reading(box, /The Panel/)).not.toBeNull();

    await userEvent.click(within(box).getByRole('button', { name: 'Close Guide' }));
    await waitFor(() => expect(guideScreen()).toBeNull());
    // The cursor sits on The Panel, so Wide View shows it, and Back lands on the conversation entry before it.
    await press(helpWindow(), 'Back');
    expect(askField()).not.toBeNull();
  });

  it('opens on the conversation entry without a step that changes nothing', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'Back to Conversation' }));

    // The full screen shows Traits, the section the conversation entry follows, so Back has no other section to show.
    const box = await openGuide();
    expect(reading(box, /Traits/)).not.toBeNull();
    expect(control(box, 'Back')).toBeDisabled();

    // The key finds no other section either, so the cursor stays on the conversation.
    fireEvent.keyDown(box, { key: 'ArrowLeft', altKey: true });
    await userEvent.click(within(box).getByRole('button', { name: 'Close Guide' }));
    await waitFor(() => expect(guideScreen()).toBeNull());
    expect(askField()).not.toBeNull();
  });

  it('takes no input while the Formaquestion is suspended', async () => {
    setScreenWidth(1600);
    storeWindowBox({ x: 400, y: 100, w: WIDE_WIDTH, h: 600 });
    const view = render(<Formaquestion loadIndex={loadFixture} />);
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    await screen.findByRole('textbox', { name: 'Ask a Question' });
    await openGuide();

    view.rerender(<Formaquestion loadIndex={loadFixture} suspended />);
    const event = new MouseEvent('mouseup', { button: 3, bubbles: true, cancelable: true });
    act(() => { document.body.dispatchEvent(event); });

    expect(event.defaultPrevented).toBe(false);
  });

  it('moves on Alt+Left and the mouse back button inside the full screen', async () => {
    await openWideWindow();
    await pick(helpWindow(), /Traits/, 'Introduction');
    await pick(helpWindow(), /Stats/, 'The Panel');
    const box = await openGuide();

    fireEvent.keyDown(box, { key: 'ArrowLeft', altKey: true });
    expect(reading(box, /Traits/)).not.toBeNull();

    const event = new MouseEvent('mouseup', { button: 4, bubbles: true, cancelable: true });
    act(() => { box.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(reading(box, /The Panel/)).not.toBeNull();
  });
});
