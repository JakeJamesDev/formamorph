import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * What the World Editor's dictionary entry panel puts on screen, driven through the real editor.
 *
 * The panel splits its fields across its own tabs, so a field that lands on the wrong tab, goes missing, or
 * turns up twice shows here as a changed label list. Matching is Advanced only, so Simple mode keeps one tab
 * and no strip at all.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

/** Two books, so the persistence case can cross a book boundary the way an author reviewing values does. */
const WORLD: World = benchEditorWorld({
  dictionaries: [
    {
      id: 'b1', name: 'Fen Lore', enabled: true,
      entries: [
        {
          id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'A big lizard.',
          secondaryKeys: ['scaled'], scanDepth: 3,
        },
        { id: 'e2', name: 'Quiet Folk', key: ['reed'], value: 'They keep to the water.' },
      ],
    },
    {
      id: 'b2', name: 'Harbor Lore', enabled: true,
      entries: [{ id: 'e3', name: 'Lamp Oil', key: ['lamp'], value: 'Burns blue.' }],
    },
  ],
} as Partial<World>);

/** The same books over a world that has a placeholder, so the keyword fields are chip-capable and the
 *  Regex switch has a vocabulary to take away. */
const CHIP_WORLD: World = benchEditorWorld({
  ...(WORLD as Partial<World>),
  placeholders: [{ id: 'p1', name: 'Hair Color', values: [{ id: 'v1', text: 'copper' }] }],
} as Partial<World>);

/** Whether a keyword field takes chips. `KeywordChips` swaps its plain input for a chip editor exactly when
 *  the vocabulary is on, and only the chip editor carries an accessible name. */
const takesChips = (name: string) => screen.queryByLabelText(name) !== null;

// These tabs switch on mouseDown, not click.
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

const FIELD_LABELS =
  /^(Name|Trigger Keywords \(Key\)|Value \(injected on keyword match\)|Scan depth \(messages\)|Secondary Keywords)$/;

/** Every field label the panel shows, in document order. The panel's own strip sits above them, so the
 *  match skips anything inside a tablist. */
const panelLabels = () =>
  screen.getAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);

/** The checkbox captions the panel shows, which are label text rather than labeled fields. */
const panelSwitches = () =>
  screen.queryAllByText(/^(Always inject|Regex|Recursive|Whole words|Case-sensitive|Require all|Exclude \(activate when absent\))$/)
    .map((el) => el.textContent);

/** The entry panel's own strip. The editor's top-level strip is on the same screen, so every read and click
 *  here is taken from the named strip rather than by tab name. */
const panelStrip = () => screen.queryByRole('tablist', { name: 'Entry Fields' });

const panelTabNames = () => {
  const strip = panelStrip();
  return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
};

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Entry Fields' })).getByRole('tab', { name });

const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

const selectEntry = (name: string) => {
  openTab(/Dictionary/);
  fireEvent.click(screen.getByText(name));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor dictionary entry panel tabs', () => {
  it('offers two tabs in Advanced mode and opens on Details', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntry('Hostile Forces');
    expect(panelTabNames()).toEqual(['Details', 'Matching']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
  });

  it('puts the name, the keywords with their two switches, and the value on Details', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntry('Hostile Forces');
    expect(panelLabels()).toEqual(['Name', 'Trigger Keywords (Key)', 'Value (injected on keyword match)']);
    expect(panelSwitches()).toEqual(['Whole words', 'Case-sensitive']);
  });

  it('puts the set-once rules on Matching, with the secondary gate whole', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntry('Hostile Forces');
    openPanelTab('Matching');
    expect(panelLabels()).toEqual(['Scan depth (messages)', 'Secondary Keywords']);
    expect(panelSwitches()).toEqual([
      'Always inject', 'Regex', 'Recursive', 'Require all', 'Exclude (activate when absent)',
    ]);
    // The gate's plain-English line reads off the entry's own modes, as it did before the split.
    expect(screen.getByText('Fires when a keyword and at least one secondary appear.')).toBeInTheDocument();
  });

  it('leaves Simple mode one tab, so no strip and no matching rules at all', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectEntry('Hostile Forces');
    expect(panelStrip()).toBeNull();
    expect(panelLabels()).toEqual(['Name', 'Trigger Keywords (Key)', 'Value (injected on keyword match)']);
    expect(panelSwitches()).toEqual(['Whole words', 'Case-sensitive']);
  });

  it('keeps the chosen tab when the author selects another entry, book or not', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntry('Hostile Forces');
    openPanelTab('Matching');
    fireEvent.click(screen.getByText('Quiet Folk'));
    expect(panelTab('Matching')).toHaveAttribute('aria-selected', 'true');

    // Lamp Oil sits in the second book, so this crosses a book boundary as well as an entry.
    fireEvent.click(screen.getByText('Lamp Oil'));
    expect(panelTab('Matching')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual(['Scan depth (messages)', 'Secondary Keywords']);
  });

  it('lands on Details when Simple mode takes Matching away, and restores the strip', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntry('Hostile Forces');
    openPanelTab('Matching');

    fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
    expect(panelStrip()).toBeNull();
    expect(panelLabels()).toEqual(['Name', 'Trigger Keywords (Key)', 'Value (injected on keyword match)']);

    // The switch wears the hidden-data marker, whose own label joins its accessible name.
    fireEvent.click(screen.getByRole('radio', { name: /^Advanced/ }));
    expect(panelTabNames()).toEqual(['Details', 'Matching']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
  });

  it('drops the comma split from both keyword fields once Regex is on', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntry('Quiet Folk');
    // With Regex off the offer is there to lose: a comma-bearing keyword is offered as a list.
    const before = screen.getByPlaceholderText('Add keyword...');
    fireEvent.change(before, { target: { value: 'wyrm, drake' } });
    fireEvent.keyDown(before, { key: 'Enter' });
    expect(screen.getByRole('button', { name: /^Split/ })).toBeInTheDocument();

    openPanelTab('Matching');
    fireEvent.click(screen.getByText('Regex'));
    const secondary = screen.getByPlaceholderText('e.g. red');
    fireEvent.change(secondary, { target: { value: 'green, blue' } });
    fireEvent.keyDown(secondary, { key: 'Enter' });
    expect(screen.queryByRole('button', { name: /^Split/ })).toBeNull();

    openPanelTab('Details');
    const keywords = screen.getByPlaceholderText('Add keyword...');
    fireEvent.change(keywords, { target: { value: 'adder, asp' } });
    fireEvent.keyDown(keywords, { key: 'Enter' });
    expect(screen.queryByRole('button', { name: /^Split/ })).toBeNull();
  });

  it('drops the chip vocabulary from both keyword fields once Regex is on', () => {
    renderWorldEditorBench(CHIP_WORLD, 'advanced');
    selectEntry('Quiet Folk');
    expect(takesChips('Add keyword')).toBe(true);

    openPanelTab('Matching');
    expect(takesChips('e.g. red')).toBe(true);
    fireEvent.click(screen.getByText('Regex'));
    expect(takesChips('e.g. red')).toBe(false);
    expect(screen.getByPlaceholderText('e.g. red')).toBeInTheDocument();

    openPanelTab('Details');
    expect(takesChips('Add keyword')).toBe(false);
    expect(screen.getByPlaceholderText('Add keyword...')).toBeInTheDocument();
  });

  it('puts the placeholder palette bar above the strip, so chips insert on either tab', () => {
    renderWorldEditorBench(CHIP_WORLD, 'advanced');
    selectEntry('Hostile Forces');
    const palette = screen.getByRole('button', { name: 'Placeholders' });
    // Ahead of the strip in document order, which is what "above" means to the author.
    expect(palette.compareDocumentPosition(panelStrip()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a book its own panel with no strip', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Dictionary/);
    fireEvent.click(screen.getByText('Fen Lore'));
    expect(panelStrip()).toBeNull();
    // The book panel's own first field, which the Label sits over rather than labels.
    expect(screen.getByPlaceholderText('Notes about this dictionary (not sent to the AI).')).toBeInTheDocument();
  });
});
