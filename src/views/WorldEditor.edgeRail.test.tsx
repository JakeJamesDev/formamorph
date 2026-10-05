import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { asMobile, benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';

/** The World Editor's top-level navigation: the Edge Rail on desktop, the Sections bar on mobile. */

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

const editorTabs = () => screen.getByRole('tablist', { name: 'Editor Sections' });
const tabNames = () => within(editorTabs()).getAllByRole('tab').map((tab) => tab.textContent);
/** The list panel: the resizable panel that holds the editor's active tab panel. */
const listCard = () => {
  const active = within(editorTabs()).getByRole('tab', { selected: true });
  return document.getElementById(active.getAttribute('aria-controls')!)!.closest<HTMLElement>('[data-panel-id="editor-list"]')!;
};

beforeEach(() => { localStorage.clear(); });

describe('World Editor rail (desktop)', () => {
  it('draws seven tabs in Advanced mode, outside the list card, which has no strip of its own', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    expect(tabNames()).toEqual(['Overview', 'Stats', 'Entities', 'Locations', 'Traits', 'Dictionary', 'Placeholders']);
    expect(listCard().contains(editorTabs())).toBe(false);
    expect(within(listCard()).queryByRole('tablist')).toBeNull();
  });

  it('draws six tabs in Simple mode', () => {
    renderWorldEditorBench(WORLD, 'simple');
    expect(tabNames()).toEqual(['Overview', 'Stats', 'Entities', 'Locations', 'Traits', 'Dictionary']);
  });

  it('opens a tab\'s list from the rail, and moves along it with the arrow keys', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    // jsdom gives the resize handles zero-size boxes that claim every pointerdown, so the click is a mouseDown.
    const stats = within(editorTabs()).getByRole('tab', { name: 'Stats' });
    fireEvent.mouseDown(stats);
    expect(within(editorTabs()).getByRole('tab', { selected: true })).toHaveTextContent('Stats');
    expect(screen.getByPlaceholderText('Search or add new stats')).toBeInTheDocument();
    act(() => stats.focus());
    await user.keyboard('{ArrowDown}');
    expect(within(editorTabs()).getByRole('tab', { selected: true })).toHaveTextContent('Entities');
  });
});

describe('World Editor Sections bar (mobile)', () => {
  let undo: (() => void) | null = null;
  beforeEach(() => { undo = asMobile(); });
  afterEach(() => { undo?.(); undo = null; });

  const sections = () => screen.getByRole('button', { name: /^Sections/ });

  it('names the current tab and keeps the list inert while closed', () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'stats' });
    expect(sections()).toHaveAttribute('aria-expanded', 'false');
    expect(sections()).toHaveTextContent('Stats');
    expect(screen.queryByRole('tablist', { name: 'Editor Sections' })).toBeNull();
    expect(document.getElementById('world-editor-sections')).toHaveAttribute('inert');
  });

  it('lists the grouped tabs with captions when open, and closes on a pick', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    await user.click(sections());
    expect(sections()).toHaveAttribute('aria-expanded', 'true');
    expect(tabNames()).toEqual(['Overview', 'Stats', 'Entities', 'Locations', 'Traits', 'Dictionary', 'Placeholders']);
    const body = document.getElementById('world-editor-sections')!;
    expect(body).not.toHaveAttribute('inert');
    expect(within(body).getByText('World')).toBeInTheDocument();
    expect(within(body).getByText('Text')).toBeInTheDocument();

    await user.click(within(editorTabs()).getByRole('tab', { name: 'Entities' }));
    expect(sections()).toHaveAttribute('aria-expanded', 'false');
    expect(sections()).toHaveTextContent('Entities');
    expect(sections()).toHaveFocus();
    expect(screen.getByPlaceholderText('Search or add new entities')).toBeInTheDocument();
  });

  it('draws no horizontal tab strip', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    fireEvent.click(sections());
    expect(screen.getAllByRole('tablist', { name: 'Editor Sections' })).toHaveLength(1);
    expect(editorTabs()).toHaveAttribute('aria-orientation', 'vertical');
  });
});
