import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, clickFlask, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * Where the editor lands when something else picks the dictionary entry: a Find hit or a Bench finding.
 *
 * The entry panel hides its secondary keywords behind its own Matching tab, so text alone can no longer reach
 * a hit — whatever navigates has to open the owning tab first, and early enough that the reveal finds the
 * field mounted. These cases drive the real editor, so they fail the same way an author would see it.
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

/** Every searchable field of the first entry holds a word found nowhere else, so a query names its field.
 *  The second entry carries one Bench finding of its own: no keywords and not constant, so it can never
 *  fire and the rule pass reports it. */
const WORLD: World = benchEditorWorld({
  dictionaries: [{
    id: 'b1', name: 'Fen Lore', enabled: true,
    entries: [
      {
        id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'Peat-soaked lizards.',
        secondaryKeys: ['brackish'],
      },
      { id: 'e2', name: 'Quiet Folk', key: [], value: 'They keep to the water.' },
    ],
  }],
} as Partial<World>);

const setup = () => renderWorldEditorBench(WORLD, 'advanced');

/** The entry panel's own strip, named apart from the editor's top-level one. */
const panelStrip = () => screen.getByRole('tablist', { name: 'Entry Fields' });

const panelTab = (name: string) => within(panelStrip()).getByRole('tab', { name });

/** Which of the panel's tabs is showing. Radix marks it on the trigger. */
const shownPanelTab = () =>
  within(panelStrip()).getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

// These tabs switch on mouseDown, not click.
const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

/** Select the entry from the Dictionary tree, the way an author reaches its panel. */
const selectEntry = async (name = 'Hostile Forces') => {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: /Dictionary/ }));
  fireEvent.click(screen.getByText(name));
  await screen.findByRole('tablist', { name: 'Entry Fields' });
};

/** Open Find and wait for the bar to take focus. */
const openFind = async () => {
  fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
  await screen.findByRole('search', { name: 'Find and replace in world' });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Find')));
};

/** Type a query and wait for the bar to land on its first hit, which it does on its own. */
const findFirst = async (query: string) => {
  fireEvent.change(screen.getByLabelText('Find'), { target: { value: query } });
  await waitFor(() => expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument());
};

/** The element the reveal ringed, whichever kind of field it turned out to be. */
const ringed = async () =>
  await waitFor(() => {
    const el = document.querySelector('.editor-find-target');
    expect(el).not.toBeNull();
    return el as HTMLElement;
  });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('World Editor — a Find hit opens the tab holding it', () => {
  it('leaves Details for Matching when the hit is in a secondary keyword', async () => {
    setup();
    await selectEntry();
    expect(shownPanelTab()).toBe('Details');

    await openFind();
    await findFirst('brackish');

    await waitFor(() => expect(shownPanelTab()).toBe('Matching'));
    const chip = await ringed();
    expect(chip.textContent).toContain('brackish');
  });

  it('leaves Matching for Details when the hit is in the value', async () => {
    setup();
    await selectEntry();
    openPanelTab('Matching');
    await waitFor(() => expect(shownPanelTab()).toBe('Matching'));

    await openFind();
    await findFirst('Peat-soaked');

    await waitFor(() => expect(shownPanelTab()).toBe('Details'));
    expect((await ringed()).textContent).toContain('Peat-soaked');
  });

  it('stays put for a hit it cannot place, rather than snapping back to Details', async () => {
    setup();
    await selectEntry();
    openPanelTab('Matching');
    await waitFor(() => expect(shownPanelTab()).toBe('Matching'));

    // A hit outside the entry entirely: the editor moves to that tab, and the entry panel keeps its own
    // choice for when the author comes back.
    await openFind();
    await findFirst('Harbor Steps');
    await waitFor(() => expect(screen.queryByRole('tablist', { name: 'Entry Fields' })).toBeNull());

    await selectEntry();
    expect(shownPanelTab()).toBe('Matching');
  });
});

describe('World Editor — Simple mode has no Matching tab to open', () => {
  it('leaves an Advanced author on Details after a Simple-mode hit in a secondary keyword', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /Dictionary/ }));
    fireEvent.click(screen.getByText('Hostile Forces'));
    // One tab, so no strip: Simple has nowhere to put a secondary-keyword hit.
    await screen.findByText('Trigger Keywords');
    expect(screen.queryByRole('tablist', { name: 'Entry Fields' })).toBeNull();

    // Simple still finds the keyword; there is just no tab that holds it.
    await openFind();
    await findFirst('brackish');

    // The switch wears the hidden-data marker, whose own label joins its accessible name.
    fireEvent.click(screen.getByRole('radio', { name: /^Advanced/ }));
    // Naming Matching while it was unavailable would strand the author on it here.
    expect(shownPanelTab()).toBe('Details');
  });
});

describe('World Editor — a Bench finding keeps the author’s tab', () => {
  it('opens the finding’s entry on whichever tab the author was last on', async () => {
    setup();
    await selectEntry();
    openPanelTab('Matching');
    await waitFor(() => expect(shownPanelTab()).toBe('Matching'));

    await clickFlask();
    // The popover names the finding's entry on both its row and its dismiss control; the row is the first.
    fireEvent.click((await screen.findAllByRole('button', { name: 'Quiet Folk' }))[0]);

    await screen.findByRole('tablist', { name: 'Entry Fields' });
    expect(shownPanelTab()).toBe('Matching');
    // The finding's own entry is what opened, not the one the author had selected — which Details says,
    // since the name is not on the tab this landed on.
    openPanelTab('Details');
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveTextContent('Quiet Folk'));
  });
});
