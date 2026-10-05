import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { rowOf } from '@/test/landing';

/** The World Editor's header row: the `?` sits right of Find, the toolbar holds only the list's controls. */

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

// The Dictionary tab stands in for a tab whose help copy isn't written yet.
vi.mock('@/lib/helpTopics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/helpTopics')>();
  const { 'worldEditor.dictionary': _dropped, ...HELP_TOPICS } = actual.HELP_TOPICS;
  return {
    ...actual,
    HELP_TOPICS,
    worldEditorTopicId: (tab: string) => (HELP_TOPICS[`worldEditor.${tab}`] ? `worldEditor.${tab}` : undefined),
  };
});

const WORLD = benchEditorWorld({});

const findButton = () => screen.getByRole('button', { name: 'Find and replace' });
const helpButtons = () => screen.queryAllByRole('button', { name: /^About / });
/** The tab root: the desktop strip, whatever rows the tab adds, then the panels. The editor's tab
 *  list is read hidden too, since on mobile it waits behind the closed Sections bar. */
const panelsHost = () => {
  const tabs = screen.getByRole('tablist', { name: 'Editor Sections', hidden: true });
  const active = within(tabs).getByRole('tab', { selected: true, hidden: true });
  return document.getElementById(active.getAttribute('aria-controls')!)!.parentElement!;
};

let undoMobile: (() => void) | null = null;
beforeEach(() => { localStorage.clear(); });
afterEach(() => { undoMobile?.(); undoMobile = null; });

describe.each([['desktop'], ['mobile']])('World Editor header row (%s)', (layout) => {
  beforeEach(() => { if (layout === 'mobile') undoMobile = asMobile(); });

  it('puts the ? directly after Find, and keeps it out of the list toolbar', async () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'stats' });
    await waitFor(() => expect(rowOf('worldEditor.stats#list-toolbar')).not.toBeNull());
    const help = screen.getByRole('button', { name: 'About Stats' });
    expect(findButton().nextElementSibling).toBe(help);
    expect(within(rowOf('worldEditor.stats#list-toolbar')!).queryByRole('button', { name: /^About / })).toBeNull();
    expect(helpButtons()).toHaveLength(1);
  });

  it('renders no toolbar row on Overview, so the panel starts the card', async () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'overview' });
    await screen.findByRole('button', { name: 'About Overview' });
    // The desktop strip shares the tab root; past it, nothing but panels.
    const rows = Array.from(panelsHost().children).filter((row) => row.getAttribute('role') !== 'tablist');
    expect(rows.every((row) => row.getAttribute('role') === 'tabpanel')).toBe(true);
    expect(findButton().nextElementSibling).toBe(screen.getByRole('button', { name: 'About Overview' }));
  });

  it('follows the active tab, and hides on a tab with no topic', async () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'stats' });
    await screen.findByRole('button', { name: 'About Stats' });
    openEditorTab(/^Entities$/);
    await screen.findByRole('button', { name: 'About Entities' });
    expect(helpButtons()).toHaveLength(1);
    openEditorTab(/^Dictionary$/);
    await waitFor(() => expect(helpButtons()).toHaveLength(0));
  });
});
