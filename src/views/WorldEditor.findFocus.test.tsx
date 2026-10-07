import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { asMobile, benchEditorWorld, renderWorldEditorBench, searchWorldField } from '@/test/worldEditorBench';
import { collectSearchTargets } from '@/lib/worldSearch';

/**
 * Guards Search World on desktop and the floating Find bar on mobile: what a search reaches, when it costs
 * anything, and where focus goes around it.
 *
 * Neither bar owns focus return. Each one only reports that it closed; the editor records where focus was
 * before the shortcut and puts it back, so an author who searched mid-sentence keeps typing after Escape.
 */

const getWorldMetadata = vi.fn();

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: () => getWorldMetadata(),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(),
  parseJsonText: vi.fn(),
  terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

// The real collector, watched, so a test can tell when the editor pays for it.
vi.mock('@/lib/worldSearch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/worldSearch')>();
  return { ...actual, collectSearchTargets: vi.fn(actual.collectSearchTargets) };
});

const WORLD = benchEditorWorld({});

const setup = () => renderWorldEditorBench(WORLD, 'advanced');

/** Focus the Overview name field, the way an author is mid-edit when the shortcut lands. */
const focusWorldName = async () => {
  const field = await screen.findByLabelText('World Name');
  field.focus();
  expect(document.activeElement).toBe(field);
  return field;
};

/** Fire the editor's own shortcut; `withReplace` picks Ctrl+H over Ctrl+F. */
const pressShortcut = (withReplace = false) =>
  fireEvent.keyDown(window, { key: withReplace ? 'h' : 'f', ctrlKey: true });

/** The match counter's text, once the debounced search has run. */
const counter = () => screen.getByText(/^\d+ \/ \d+$/).textContent;

const markedHit = () => document.querySelector('.editor-find-target');

const floatingBar = () => screen.queryByRole('search', { name: 'Find and replace in world' });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getWorldMetadata.mockResolvedValue([]);
});

describe('Search World (desktop)', () => {
  it('does not take focus when the editor opens', async () => {
    setup();
    await screen.findByLabelText('World Name');
    expect(document.activeElement).not.toBe(searchWorldField());
  });

  it('lands on the first hit as you type, shows the count, and steps with the arrows and Enter', async () => {
    setup();
    // "lamp" is in the resident's player and AI descriptions, both on the Entities tab.
    fireEvent.change(searchWorldField(), { target: { value: 'lamp' } });

    await waitFor(() => expect(counter()).toBe('1 / 2'));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument());
    await waitFor(() => expect(markedHit()).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(counter()).toBe('2 / 2');
    fireEvent.click(screen.getByRole('button', { name: 'Previous match' }));
    expect(counter()).toBe('1 / 2');
    fireEvent.keyDown(searchWorldField(), { key: 'Enter' });
    expect(counter()).toBe('2 / 2');
    fireEvent.keyDown(searchWorldField(), { key: 'Enter', shiftKey: true });
    expect(counter()).toBe('1 / 2');
    // Enter on a step cell is that cell's own press, not the field's step forward.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Previous match' }), { key: 'Enter' });
    expect(counter()).toBe('1 / 2');
  });

  it('collects search targets only while the field holds text', async () => {
    setup();
    const worldName = await screen.findByLabelText('World Name');
    // A world edit with the field empty costs no collection.
    fireEvent.change(worldName, { target: { value: 'Sedge Landing East' } });
    await screen.findByDisplayValue('Sedge Landing East');
    expect(collectSearchTargets).not.toHaveBeenCalled();

    fireEvent.change(searchWorldField(), { target: { value: 'Sedge' } });
    await waitFor(() => expect(collectSearchTargets).toHaveBeenCalled());

    fireEvent.keyDown(searchWorldField(), { key: 'Escape' });
    vi.mocked(collectSearchTargets).mockClear();
    fireEvent.change(screen.getByLabelText('World Name'), { target: { value: 'Sedge Landing West' } });
    await screen.findByDisplayValue('Sedge Landing West');
    expect(collectSearchTargets).not.toHaveBeenCalled();
  });

  it('clears the search and the match marker on Escape', async () => {
    setup();
    fireEvent.change(searchWorldField(), { target: { value: 'Odd Wick' } });
    await waitFor(() => expect(markedHit()).not.toBeNull());

    fireEvent.keyDown(searchWorldField(), { key: 'Escape' });

    expect(searchWorldField()).toHaveValue('');
    await waitFor(() => expect(markedHit()).toBeNull());
  });

  it('focuses the field on Ctrl+F and returns focus to the earlier field on Escape', async () => {
    setup();
    const field = await focusWorldName();
    pressShortcut();
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));

    fireEvent.keyDown(searchWorldField(), { key: 'Escape' });

    expect(document.activeElement).toBe(field);
  });

  it('focuses the field on Ctrl+H and records the earlier field', async () => {
    setup();
    const field = await focusWorldName();
    pressShortcut(true);
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    expect(floatingBar()).toBeNull();

    fireEvent.keyDown(searchWorldField(), { key: 'Escape' });

    expect(document.activeElement).toBe(field);
  });

  it('keeps the earlier field when Ctrl+F is pressed again inside the search', async () => {
    setup();
    const field = await focusWorldName();
    pressShortcut();
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    // The second press must not record the search field itself.
    pressShortcut();

    fireEvent.keyDown(searchWorldField(), { key: 'Escape' });

    expect(document.activeElement).toBe(field);
  });

  it('leaves focus in the cleared field when the author clicked into it', async () => {
    setup();
    await focusWorldName();
    searchWorldField().focus();
    fireEvent.change(searchWorldField(), { target: { value: 'Sedge' } });

    fireEvent.keyDown(searchWorldField(), { key: 'Escape' });

    expect(searchWorldField()).toHaveValue('');
    expect(document.activeElement).toBe(searchWorldField());
  });

  it('drops the earlier field once focus leaves the search', async () => {
    setup();
    await focusWorldName();
    pressShortcut();
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    // The author moves on, then comes back to the field by hand.
    screen.getByRole('combobox', { name: 'Editor mode' }).focus();
    searchWorldField().focus();

    fireEvent.keyDown(searchWorldField(), { key: 'Escape' });

    expect(document.activeElement).toBe(searchWorldField());
  });

  it('stays in the cleared field when the hit unmounted the earlier field', async () => {
    setup();
    await focusWorldName();
    pressShortcut();
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    // A hit on another tab: taking it switches tabs, which unmounts the field focus was in.
    fireEvent.change(searchWorldField(), { target: { value: 'Odd Wick' } });
    await waitFor(() => expect(screen.queryByLabelText('World Name')).toBeNull());

    fireEvent.keyDown(searchWorldField(), { key: 'Escape' });

    expect(document.activeElement).toBe(searchWorldField());
  });

  describe('resized to mobile', () => {
    // useIsMobile reads the media query on change, so this one reports a narrow window on demand.
    const realMatchMedia = window.matchMedia;
    const realWidth = window.innerWidth;
    let narrow = false;
    const listeners = new Set<() => void>();
    beforeEach(() => {
      narrow = false;
      window.matchMedia = ((query: string) => ({
        get matches() { return narrow && query.includes('max-width: 767px'); },
        media: query, onchange: null,
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
        addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    });
    afterEach(() => {
      window.matchMedia = realMatchMedia;
      window.innerWidth = realWidth;
      listeners.clear();
    });

    it('does not open the floating bar for a search started on desktop', async () => {
      setup();
      await focusWorldName();
      pressShortcut();
      await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
      fireEvent.change(searchWorldField(), { target: { value: 'Sedge' } });
      await waitFor(() => expect(counter()).toMatch(/^1 \//));

      narrow = true;
      window.innerWidth = 400;
      act(() => { listeners.forEach((listener) => listener()); });

      await screen.findByRole('button', { name: 'Find and replace' });
      expect(floatingBar()).toBeNull();
    });
  });
});

describe('Find (mobile)', () => {
  let restoreViewport: () => void;
  beforeEach(() => { restoreViewport = asMobile(); });
  afterEach(() => restoreViewport());

  /** Open the floating bar and wait for it to take focus, so a restore case starts from a field that lost it. */
  const openFloating = async (withReplace = false) => {
    pressShortcut(withReplace);
    const bar = await screen.findByRole('search', { name: 'Find and replace in world' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Find')));
    return bar;
  };
  const floatingIsGone = () => waitFor(() => expect(floatingBar()).toBeNull());

  it('returns focus to the field the author was in when Escape closes Find', async () => {
    setup();
    const field = await focusWorldName();
    await openFloating();

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await floatingIsGone();
    expect(document.activeElement).toBe(field);
  });

  it('returns focus to that field when the Close action closes Find', async () => {
    setup();
    const field = await focusWorldName();
    await openFloating();

    fireEvent.click(screen.getByLabelText('Close find'));

    await floatingIsGone();
    expect(document.activeElement).toBe(field);
  });

  it('returns focus to the field when Find and Replace opens with its own shortcut', async () => {
    setup();
    const field = await focusWorldName();
    await openFloating(true);
    // Ctrl+H opens the bar with the replace row already showing.
    expect(screen.getByLabelText('Hide replace')).toBeTruthy();

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await floatingIsGone();
    expect(document.activeElement).toBe(field);
  });

  it('keeps the first opener when Ctrl+H reaches an already open bar', async () => {
    setup();
    const field = await focusWorldName();
    await openFloating();
    // The second shortcut adds the replace row. It must not re-record the opener as the bar's own field.
    await openFloating(true);
    expect(screen.getByLabelText('Hide replace')).toBeTruthy();

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await floatingIsGone();
    expect(document.activeElement).toBe(field);
  });

  it('returns focus to the header button when Find is opened by clicking it', async () => {
    setup();
    const opener = await screen.findByRole('button', { name: 'Find and replace' });
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Find')));

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await floatingIsGone();
    expect(document.activeElement).toBe(opener);
  });

  it('falls back to the editor container when navigating to a hit unmounts the field', async () => {
    setup();
    await focusWorldName();
    const bar = await openFloating();
    // The bar is a child of the container Find falls back to, which is how the test names it without
    // reaching for a test-only attribute.
    const editorRoot = bar.parentElement as HTMLElement;

    // A hit on another tab: taking it switches tabs, which unmounts the field focus was in.
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'Odd Wick' } });
    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Enter' });
    await waitFor(() => expect(screen.queryByLabelText('World Name')).toBeNull());

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await floatingIsGone();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(editorRoot);
  });
});

describe('World Editor find reveal on unmount', () => {
  it('stops looking for the hit once the editor is gone', async () => {
    setup();
    await focusWorldName();
    // The row lookup asks for the selected row by this attribute, so the query names it.
    const lookups = vi.spyOn(HTMLElement.prototype, 'querySelector');
    const rowLookups = () => lookups.mock.calls.filter(([selector]) => selector === '[data-editor-row-selected]').length;

    // A hit on Overview, which has no tree: the row lookup finds nothing and keeps retrying.
    fireEvent.change(searchWorldField(), { target: { value: 'Sedge' } });
    await waitFor(() => expect(rowLookups()).toBeGreaterThan(1));

    cleanup();
    const atUnmount = rowLookups();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(rowLookups()).toBe(atUnmount);
    lookups.mockRestore();
  });
});
