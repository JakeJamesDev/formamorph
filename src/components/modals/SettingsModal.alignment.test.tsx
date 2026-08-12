// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEffect, useRef } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { SETTINGS_TABS, type SettingsTabId } from './settingsTabs';

/**
 * Every settings row aligns its label to its control by one rule, checked against the row as rendered
 * rather than against how its call site was written.
 *
 * It exists because the alignment was a per-row boolean: fixing a dropdown meant flipping a flag on that
 * row, and nothing noticed when the flag was wrong on the row above it. This walks all of them at once, so
 * a row that disagrees with the rule fails here rather than being spotted in a screenshot.
 */

vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

/** A `Row`'s grid: two columns at `sm`, and the label cell first. `CheckRow` shares the shape. */
const ROW_SELECTOR = '[class*="minmax(0,1fr)"]';

/**
 * Which rows legitimately pin their label to the first line instead of centering it: a control taller than
 * a line or two (a textarea), a segmented control that stacks its option help beneath itself, or a control
 * that stacks its own status line under it. All three make the control cell taller than the control, which
 * is what drops a centered label below the control's midline.
 *
 * The last is marked rather than detected, because the status line it stacks is conditional — a row that
 * grows only sometimes must be aligned for both states, so the DOM at any one moment can't decide it.
 */
function expectsTopAlignment(controlCell: Element): boolean {
  return !!controlCell.querySelector('textarea')
    || !!controlCell.querySelector('.col-start-1.row-start-1')
    || !!controlCell.querySelector('[data-row-stacked]');
}

/** The modal is a portalled Dialog, so its rows land in `document.body`, never in render's container. */
const openAdvanced = (initialTab?: SettingsTabId) => {
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab={initialTab} />
      </SettingsProvider>
    </ThemeProvider>,
  );
  return document.body;
};

/** Every labelled row currently on screen, as `[label, labelCell, controlCell]`. */
function visibleRows(container: HTMLElement) {
  return [...container.querySelectorAll(ROW_SELECTOR)].flatMap((grid) => {
    const [labelCell, controlCell] = [...grid.children] as HTMLElement[];
    if (!labelCell || !controlCell) return [];
    const label = labelCell.textContent?.trim();
    // A row with no label holds its column open with an empty span; there is nothing to align.
    if (!label) return [];
    return [{ label, labelCell, controlCell }];
  });
}

/** Applies settings through the context on mount, so a test can reach a row that only exists in some
 *  configuration without hand-writing that configuration into storage. */
function Configure({ apply }: { apply: (s: ReturnType<typeof useSettings>) => void }) {
  const settings = useSettings();
  const done = useRef(false);
  useEffect(() => { if (!done.current) { done.current = true; apply(settings); } });
  return null;
}

/** Every row on every tab. Radix unmounts the panel you leave, so each tab gets its own mount and the
 *  results are pooled — one assertion then covers the whole modal instead of whichever tab opened first. */
function everyRow() {
  return SETTINGS_TABS.flatMap((tab) => {
    const rows = visibleRows(openAdvanced(tab.value)).map((r) => ({ ...r, tab: tab.label }));
    cleanup();
    return rows;
  });
}

beforeEach(() => localStorage.clear());

describe('settings row alignment', () => {
  it('aligns every row to its own control', () => {
    const rows = everyRow();
    // Guards the guard: a selector that stopped matching would make every assertion below vacuous.
    expect(rows.length).toBeGreaterThan(30);

    const wrong = rows.filter(({ labelCell, controlCell }) =>
      labelCell.className.includes('self-start') !== expectsTopAlignment(controlCell));
    expect(wrong.map((r) => `${r.tab} → ${r.label}`)).toEqual([]);
  });

  it('covers a row of each kind, so the rule is not asserted over dropdowns alone', () => {
    const rows = everyRow();
    const has = (sel: string) => rows.some(({ controlCell }) => controlCell.querySelector(sel));
    expect({
      dropdown: has('[role=combobox]'),
      textbox: has('input[type=text], input[type=number], input[type=password]'),
      slider: has('[role=slider]'),
      segmented: has('.col-start-1.row-start-1'),
      checkbox: has('[role=checkbox]'),
    }).toEqual({ dropdown: true, textbox: true, slider: true, segmented: true, checkbox: true });
  });

  it('keeps the hint out of the control cell on every row', () => {
    const rows = everyRow();
    // A hint nested beside the control is what made a centered label sit low, so no row may hold one there
    // — the grid's own third cell is where it belongs.
    const nested = rows.filter(({ controlCell }) =>
      [...controlCell.children].some((c) => c.className.includes('sm:col-start-2')));
    expect(nested.map((r) => `${r.tab} → ${r.label}`)).toEqual([]);
  });

  it('pins the label of the multi-line workflow editor to its first line', async () => {
    // The only textarea row in Settings, and it needs the world state that reveals it: image generation on
    // and the ComfyUI provider picked. Set through the context, the way the provider dropdown sets it —
    // without this the rule above passes over a tab that happens to contain no textarea at all.
    render(
      <ThemeProvider>
        <SettingsProvider>
          <Configure apply={(s) => { s.setImageGenDisabled(false); s.setImageProvider('comfyui'); }} />
          <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="endpoints" />
        </SettingsProvider>
      </ThemeProvider>,
    );
    // Radix's sub-tabs respond to a real pointer sequence, not a bare click event.
    await userEvent.click(screen.getByRole('tab', { name: 'Image' }));

    const rows = visibleRows(document.body).filter(({ controlCell }) => controlCell.querySelector('textarea'));
    expect(rows.map((r) => r.label)).not.toEqual([]);
    expect(rows.filter(({ labelCell }) => !labelCell.className.includes('self-start')).map((r) => r.label)).toEqual([]);
  });

  it('centers a checkbox on the line of text beside it', () => {
    const container = openAdvanced();
    const boxes = [...container.querySelectorAll('button[role=checkbox]')];
    expect(boxes.length).toBeGreaterThan(0);

    const unsleeved = boxes.filter((b) => {
      // Checkboxes inside a row's own flex control (a cap plus its number) are already on the control's
      // center line; only the ones CheckRow lays out beside a hint need the sleeve.
      const beside = b.parentElement?.parentElement?.className.includes('items-start');
      return beside && !b.parentElement?.className.includes('h-[1lh]');
    });
    expect(unsleeved).toHaveLength(0);
  });
});
