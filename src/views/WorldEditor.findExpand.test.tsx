import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { benchEditorWorld, renderWorldEditorBench, searchWorldField } from '@/test/worldEditorBench';
import { phValues } from '@/test/placeholderValues';
import { TARGET_ATTRIBUTE, routeText } from '@/lib/surface/surfaceTargets';

/**
 * Guards Search World's expanded state on desktop: the full Find and Replace bar that grows over the app bar,
 * how focus follows each change of layout, and that replace works from it.
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

const WORLD = benchEditorWorld({
  placeholders: [{ id: 'weather', name: 'Weather', values: phValues(['fog']) }],
});

const setup = () => renderWorldEditorBench(WORLD, 'advanced');

const focusWorldName = async () => {
  const field = await screen.findByLabelText('World Name');
  field.focus();
  expect(document.activeElement).toBe(field);
  return field;
};

const pressShortcut = (withReplace = false) =>
  fireEvent.keyDown(window, { key: withReplace ? 'h' : 'f', ctrlKey: true });

const expandButton = () => screen.queryByRole('button', { name: 'Show options and replace' });
const replaceField = () => screen.queryByRole('textbox', { name: 'Replace with' });
const isExpanded = () => replaceField() !== null;

const expand = async () => {
  fireEvent.click(expandButton()!);
  await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
  expect(isExpanded()).toBe(true);
};

const counter = () => screen.getByText(/^\d+ \/ \d+$/).textContent;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getWorldMetadata.mockResolvedValue([]);
});

describe('Search World expanded (desktop)', () => {
  it('names the expand button and shows its shortcut in the tooltip', async () => {
    setup();
    const button = await screen.findByRole('button', { name: 'Show options and replace' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(isExpanded()).toBe(false);
  });

  it('expands from the button into the bar with the replace row and focuses its field', async () => {
    setup();
    await screen.findByLabelText('World Name');
    await expand();
    expect(screen.getByRole('button', { name: 'Collapse to search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Match options' })).toBeInTheDocument();
    // The app bar's other controls stay mounted beside it.
    expect(screen.getByRole('combobox', { name: 'Editor mode' })).toBeInTheDocument();
  });

  it('keeps the Take Me There target on the search while expanded', async () => {
    setup();
    await screen.findByLabelText('World Name');
    const target = () => document.querySelector(`[${TARGET_ATTRIBUTE}="${routeText('worldEditor', 'find-button')}"]`);
    expect(target()).toContainElement(searchWorldField());
    await expand();
    expect(target()).toContainElement(searchWorldField());
  });

  it('expands and focuses on Ctrl+H, and stays expanded on a later Ctrl+F', async () => {
    setup();
    await focusWorldName();
    pressShortcut(true);
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    expect(isExpanded()).toBe(true);

    replaceField()!.focus();
    pressShortcut();
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    expect(isExpanded()).toBe(true);
  });

  it('collapses with the query kept and focus in the collapsed field', async () => {
    setup();
    await screen.findByLabelText('World Name');
    await expand();
    fireEvent.change(searchWorldField(), { target: { value: 'lamp' } });
    await waitFor(() => expect(counter()).toBe('1 / 2'));

    fireEvent.click(screen.getByRole('button', { name: 'Collapse to search' }));

    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    expect(isExpanded()).toBe(false);
    expect(searchWorldField()).toHaveValue('lamp');
    expect(counter()).toBe('1 / 2');
  });

  it('keeps match options on after collapse, shows them, and expands from the indicator', async () => {
    setup();
    await screen.findByLabelText('World Name');
    expect(screen.queryByRole('button', { name: 'Show match options' })).toBeNull();
    await expand();
    fireEvent.change(searchWorldField(), { target: { value: 'LAMP' } });
    await waitFor(() => expect(counter()).toBe('1 / 2'));
    fireEvent.click(screen.getByRole('button', { name: 'Match case' }));
    await waitFor(() => expect(screen.getByText('No results')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Collapse to search' }));

    // Still filtering while collapsed, and the field says so.
    expect(screen.getByText('No results')).toBeInTheDocument();
    const indicator = screen.getByRole('button', { name: 'Show match options' });
    fireEvent.click(indicator);
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    expect(screen.getByRole('button', { name: 'Match case' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Match whole word' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows one icon for each option that is on', async () => {
    setup();
    await screen.findByLabelText('World Name');
    await expand();
    fireEvent.click(screen.getByRole('button', { name: 'Match case' }));
    fireEvent.click(screen.getByRole('button', { name: 'Match whole word' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse to search' }));

    expect(screen.getByRole('button', { name: 'Show match options' }).querySelectorAll('svg')).toHaveLength(2);
  });

  it('clears, collapses and returns focus to the earlier field on Clear search after Ctrl+H', async () => {
    setup();
    const field = await focusWorldName();
    pressShortcut(true);
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    // A hit on Overview, so taking it leaves the earlier field mounted.
    fireEvent.change(searchWorldField(), { target: { value: 'fen' } });
    await waitFor(() => expect(counter()).toBe('1 / 2'));

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    await waitFor(() => expect(isExpanded()).toBe(false));
    expect(document.activeElement).toBe(field);
    expect(searchWorldField()).toHaveValue('');
    expect(screen.queryByText(/^\d+ \/ \d+$/)).toBeNull();
  });

  it('leaves focus in the cleared field on Clear search when the author expanded by hand', async () => {
    setup();
    await focusWorldName();
    searchWorldField().focus();
    await expand();
    fireEvent.change(searchWorldField(), { target: { value: 'lamp' } });

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    expect(isExpanded()).toBe(false);
    expect(searchWorldField()).toHaveValue('');
  });

  it('keeps the earlier field across an expand after Ctrl+F', async () => {
    const user = userEvent.setup();
    setup();
    const field = await focusWorldName();
    pressShortcut();
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    // A real press moves focus from the field to the cell before its click.
    await user.click(expandButton()!);
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    expect(isExpanded()).toBe(true);

    fireEvent.keyDown(searchWorldField(), { key: 'Escape' });

    await waitFor(() => expect(isExpanded()).toBe(false));
    expect(document.activeElement).toBe(field);
  });

  it('drops the earlier field when focus leaves the expanded bar', async () => {
    setup();
    await focusWorldName();
    pressShortcut(true);
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    screen.getByRole('combobox', { name: 'Editor mode' }).focus();
    searchWorldField().focus();

    fireEvent.keyDown(searchWorldField(), { key: 'Escape' });

    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    expect(isExpanded()).toBe(false);
  });

  describe('replace', () => {
    it('replaces the current match', async () => {
      const { ctx } = setup();
      pressShortcut(true);
      await waitFor(() => expect(isExpanded()).toBe(true));
      fireEvent.change(searchWorldField(), { target: { value: 'lamps' } });
      await waitFor(() => expect(counter()).toBe('1 / 1'));
      fireEvent.change(replaceField()!, { target: { value: 'torches' } });

      fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

      await waitFor(() => expect(ctx().entities[0].aiDescription).toBe('Keeps the harbor torches lit.'));
    });

    it('asks before Replace All, and Escape in the question leaves the search open', async () => {
      const { ctx } = setup();
      const field = await focusWorldName();
      pressShortcut(true);
      await waitFor(() => expect(isExpanded()).toBe(true));
      // Overview's two fen fields, so the earlier field stays mounted through the replace.
      fireEvent.change(searchWorldField(), { target: { value: 'fen' } });
      await waitFor(() => expect(counter()).toBe('1 / 2'));
      fireEvent.change(replaceField()!, { target: { value: 'marsh' } });

      fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
      const question = await screen.findByRole('alertdialog');
      fireEvent.keyDown(question, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(searchWorldField()).toHaveValue('fen');
      expect(isExpanded()).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
      const again = await screen.findByRole('alertdialog');
      expect(within(again).getByText(/^Replace 2 matches across 2 fields\?/)).toBeInTheDocument();
      fireEvent.click(within(again).getByRole('button', { name: 'Replace All' }));

      await waitFor(() => expect(ctx().worldOverview.systemPrompt).toBe('Narrate the marsh.'));
      expect(ctx().worldOverview.readme).toBe('A marsh primer.');
      // The trip through the question is still inside the search, so Escape returns to the earlier field.
      fireEvent.keyDown(searchWorldField(), { key: 'Escape' });
      await waitFor(() => expect(isExpanded()).toBe(false));
      expect(document.activeElement).toBe(field);
    });

    it('replaces a match with a placeholder chip', async () => {
      const { ctx } = setup();
      pressShortcut(true);
      await waitFor(() => expect(isExpanded()).toBe(true));
      fireEvent.change(searchWorldField(), { target: { value: 'lamps' } });
      await waitFor(() => expect(counter()).toBe('1 / 1'));

      fireEvent.click(screen.getByRole('button', { name: 'Replace with a placeholder instead' }));
      fireEvent.click(screen.getByRole('button', { name: 'Choose Placeholder' }));
      const rows = await screen.findAllByTestId('placeholder-section-row');
      fireEvent.click(rows.find((row) => row.textContent?.includes('Weather'))!);
      fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

      await waitFor(() => expect(ctx().entities[0].aiDescription)
        .toMatch(/^Keeps the harbor \{\{ph:weather:world:[^}]+\}\} lit\.$/));
    });
  });
});

describe('the find dev route', () => {
  afterEach(() => {
    window.location.hash = '';
    fireEvent(window, new Event('hashchange'));
  });

  it('opens the World Editor with Search World expanded', async () => {
    window.location.hash = '#dev?find=expanded';
    fireEvent(window, new Event('hashchange'));
    setup();
    await waitFor(() => expect(isExpanded()).toBe(true));
  });
});
