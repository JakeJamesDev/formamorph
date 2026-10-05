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
/** The Tabs root: the editor's tab strip, then whatever rows the tab adds above its panels. */
const tabsRoot = () => {
  const strip = screen.getByRole('tab', { name: 'Overview' }).closest('[role="tablist"]')!;
  return strip.closest('[data-orientation]:not([role="tablist"])')!;
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

  it('renders no toolbar row on Overview, so the panel follows the tab strip', async () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'overview' });
    await screen.findByRole('button', { name: 'About Overview' });
    const rows = Array.from(tabsRoot().children);
    expect(rows.slice(1).every((row) => row.getAttribute('role') === 'tabpanel')).toBe(true);
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
