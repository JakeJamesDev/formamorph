import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { asMobile, benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { RAIL_ROOM_PX } from './worldEditorTabs';

/** The World Editor's top-level navigation: the Nav Rail on desktop, the Sections bar on mobile. */

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

/** The tab list read top to bottom: each tab's name, `|` for a line between groups, and `?` for anything else,
 *  a caption included. */
const listRows = (separator: string) => Array.from(editorTabs().children).map((row) =>
  (row.getAttribute('role') === 'tab' ? row.textContent : row.hasAttribute(separator) ? '|' : '?'));
const railRows = () => listRows('data-rail-separator');
const sectionRows = () => listRows('data-sections-separator');
const railToggle = () => screen.getByRole('button', { name: /^(Collapse|Expand)$/ });

// Only this spy: restoring every mock would also wipe the storage mock's resolved values.
let undoSizing: (() => void) | null = null;
afterEach(() => { undoSizing?.(); undoSizing = null; });

/** The list card answers with `width`; every other box stays unmeasured. Returns a way to resize it. */
const sizeListCard = (width: number) => {
  let current = width;
  const inListCard = (node: Element) => !!node.parentElement?.closest('[data-panel-id="editor-list"]');
  const deliveries: Array<() => void> = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(private readonly callback: (entries: unknown[]) => void) {}
    observe(target: Element) {
      if (inListCard(target)) deliveries.push(() => this.callback([{ target, contentRect: { width: current } }]));
    }
    unobserve() {}
    disconnect() {}
  });
  const spy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return inListCard(this) ? current : 0;
  });
  undoSizing = () => { spy.mockRestore(); vi.unstubAllGlobals(); };
  return (next: number) => { current = next; act(() => deliveries.forEach((deliver) => deliver())); };
};

describe('World Editor rail (desktop)', () => {
  it('draws seven tabs in Advanced mode, grouped by lines, inside the list card', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    expect(railRows()).toEqual(['Overview', '|', 'Stats', 'Entities', 'Locations', 'Traits', '|', 'Dictionary', 'Placeholders']);
    expect(editorTabs()).toHaveAttribute('aria-orientation', 'vertical');
    expect(listCard().contains(editorTabs())).toBe(true);
    expect(screen.getAllByRole('tablist', { name: 'Editor Sections' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Sections/ })).toBeNull();
  });

  it('draws six tabs in Simple mode, without Placeholders', () => {
    renderWorldEditorBench(WORLD, 'simple');
    expect(railRows()).toEqual(['Overview', '|', 'Stats', 'Entities', 'Locations', 'Traits', '|', 'Dictionary']);
  });

  it('opens the list of a tab picked on the rail', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    // jsdom gives the resize handles zero-size boxes that claim every pointerdown, so the click is a mouseDown.
    fireEvent.mouseDown(within(editorTabs()).getByRole('tab', { name: 'Stats' }));
    expect(within(editorTabs()).getByRole('tab', { selected: true })).toHaveTextContent('Stats');
    expect(screen.getByPlaceholderText('Filter Stats')).toBeInTheDocument();
  });

  it('starts expanded and remembers a collapse on this device', () => {
    const first = renderWorldEditorBench(WORLD, 'advanced');
    expect(railToggle()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(railToggle());
    expect(railToggle()).toHaveAttribute('aria-expanded', 'false');

    first.unmount();
    renderWorldEditorBench(WORLD, 'advanced');
    expect(railToggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('draws collapsed while the list card is narrow, and restores the stored choice when it widens', () => {
    const resize = sizeListCard(RAIL_ROOM_PX + 200);
    renderWorldEditorBench(WORLD, 'advanced');
    expect(railToggle()).toHaveAttribute('aria-expanded', 'true');

    resize(RAIL_ROOM_PX - 1);
    expect(railToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(railToggle()).toBeDisabled();

    resize(RAIL_ROOM_PX);
    expect(railToggle()).toHaveAttribute('aria-expanded', 'true');
    expect(railToggle()).toBeEnabled();
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

  it('draws the rail\'s order and lines, with no captions, in both modes', () => {
    for (const mode of ['simple', 'advanced'] as const) {
      undo?.();
      const desktop = renderWorldEditorBench(WORLD, mode);
      const rail = railRows();
      desktop.unmount();

      undo = asMobile();
      const mobile = renderWorldEditorBench(WORLD, mode);
      fireEvent.click(sections());
      expect(sectionRows()).toEqual(rail);
      mobile.unmount();
    }
  });

  it('lists the grouped tabs when open, and closes on a pick', async () => {
    const user = userEvent.setup();
    renderWorldEditorBench(WORLD, 'advanced');
    await user.click(sections());
    expect(sections()).toHaveAttribute('aria-expanded', 'true');
    expect(tabNames()).toEqual(['Overview', 'Stats', 'Entities', 'Locations', 'Traits', 'Dictionary', 'Placeholders']);
    expect(document.getElementById('world-editor-sections')).not.toHaveAttribute('inert');

    await user.click(within(editorTabs()).getByRole('tab', { name: 'Entities' }));
    expect(sections()).toHaveAttribute('aria-expanded', 'false');
    expect(sections()).toHaveTextContent('Entities');
    expect(sections()).toHaveFocus();
    expect(screen.getByPlaceholderText('Filter Entities')).toBeInTheDocument();
  });

  it('fills the selected row with the primary color, with no edge bar, and hovers with the accent fill', () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'stats' });
    fireEvent.click(sections());
    const selected = within(editorTabs()).getByRole('tab', { selected: true });
    expect(selected).toHaveClass('data-[state=active]:bg-primary', 'data-[state=active]:text-primary-foreground', 'data-[state=active]:font-medium');
    expect(selected).not.toHaveClass('data-[state=active]:bg-muted', 'data-[state=active]:font-semibold');
    expect(editorTabs().querySelector('[data-rail-accent]')).toBeNull();
    expect(within(editorTabs()).getByRole('tab', { name: 'Entities' })).toHaveClass('hover:bg-accent', 'hover:text-foreground');
  });

  it('draws no horizontal tab strip', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    fireEvent.click(sections());
    expect(screen.getAllByRole('tablist', { name: 'Editor Sections' })).toHaveLength(1);
    expect(editorTabs()).toHaveAttribute('aria-orientation', 'vertical');
  });
});
