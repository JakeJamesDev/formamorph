import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, editorModeSelect, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { rowOf } from '@/test/landing';

/** The World Editor's mobile header row: back, the mode, the Test Bench and Find, and nothing in the list toolbar. */

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

const WORLD = benchEditorWorld({});

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const helpButtons = () => screen.queryAllByRole('button', { name: /^About / });
/** True when each element comes after the one before it in the document. */
const inOrder = (elements: HTMLElement[]) => elements.every((el, i) => i === 0
  || (elements[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
/** The tab root: whatever rows the tab adds, then the panels. The editor's tab list is read hidden, since
 *  it waits behind the closed Sections bar. */
const panelsHost = () => {
  const tabs = screen.getByRole('tablist', { name: 'Editor Sections', hidden: true });
  const active = within(tabs).getByRole('tab', { selected: true, hidden: true });
  return document.getElementById(active.getAttribute('aria-controls')!)!.parentElement!;
};

let undoMobile: (() => void) | null = null;
beforeEach(() => { localStorage.clear(); undoMobile = asMobile(); });
afterEach(() => { undoMobile?.(); undoMobile = null; });

describe('World Editor header row (mobile)', () => {
  it('reads back, the Mode Select, Test Bench and Find, with no ? on any tab', async () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'stats' });
    await waitFor(() => expect(rowOf('worldEditor.stats#list-toolbar')).not.toBeNull());
    const header = [button('Back'), editorModeSelect(), button(/^Test Bench/), button('Find and replace')];
    expect(inOrder(header)).toBe(true);
    expect(editorModeSelect()).toHaveTextContent('Advanced');
    expect(helpButtons()).toHaveLength(0);

    for (const tab of [/^Overview$/, /^Entities$/, /^Dictionary$/]) {
      openEditorTab(tab);
      expect(helpButtons()).toHaveLength(0);
    }
  });

  it('keeps the header controls out of the list toolbar', async () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'stats' });
    await waitFor(() => expect(rowOf('worldEditor.stats#list-toolbar')).not.toBeNull());
    const toolbar = within(rowOf('worldEditor.stats#list-toolbar')!);
    expect(toolbar.queryByRole('button', { name: 'Find and replace' })).toBeNull();
    expect(toolbar.queryByRole('combobox', { name: 'Editor mode' })).toBeNull();
  });

  it('renders no toolbar row on Overview, so the panel starts the card', () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'overview' });
    // The Sections bar's list shares the tab root; past it, nothing but panels.
    const rows = Array.from(panelsHost().children).filter((row) => row.getAttribute('role') !== 'tablist');
    expect(rows.every((row) => row.getAttribute('role') === 'tabpanel')).toBe(true);
  });

  it('keeps Save and its menu in the footer in Simple, with no Export World icon and no Optimize Images', () => {
    renderWorldEditorBench(WORLD, 'simple', { initialTab: 'overview' });
    expect(screen.queryByRole('button', { name: 'Export World' })).toBeNull();
    expect(button('Save options')).toBeInTheDocument();
    expect(button('Save')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Optimize Images' })).toBeNull();
  });
});
