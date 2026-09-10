import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, clickFlask, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * Where the editor lands when something else picks the trait: a Find hit, a Bench finding, or the rival
 * named in a conflict note.
 *
 * The trait panel hides its stat rows and its pins behind its own tabs, so text alone can no longer reach a
 * hit — whatever navigates has to open the owning tab first, and early enough that the reveal finds the field
 * mounted. These cases drive the real editor, so they fail the same way an author would see it.
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

/** Two traits claiming one stat's availability, so the conflict note has a rival to name. Every searchable
 *  field of the first holds a word found nowhere else, so a query names its field. */
const WORLD: World = benchEditorWorld({
  stats: [
    { id: 's1', name: 'Warmth', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] },
    { id: 's2', name: 'Damp', type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [] },
  ],
  placeholders: [{ id: 'p1', name: 'Hair Color', values: [{ id: 'v1', text: 'copper' }] }],
  traits: [
    {
      id: 't1', name: 'Sedge-Born', playerDescription: 'Fen-raised.',
      aiDescription: 'Grew up thawed by peat fires.',
      statChanges: [], statToggles: [{ statId: 's2', enabled: true }],
      placeholderPins: [{ placeholderId: 'p1', value: 'burnished' }],
    },
    {
      // The rival: it claims the same stat, and it carries one Bench finding of its own — a pin naming a
      // placeholder that no longer exists, which the rule pass reports against this trait.
      id: 't2', name: 'Marsh-Wed', statChanges: [], statToggles: [{ statId: 's2', enabled: false }],
      placeholderPins: [{ placeholderId: 'gone', value: 'sable' }],
    },
  ],
} as Partial<World>);

const setup = () => renderWorldEditorBench(WORLD, 'advanced');

/** The trait panel's own strip, named apart from the editor's top-level one. */
const panelStrip = () => screen.getByRole('tablist', { name: 'Trait Fields' });

const panelTab = (name: string) => within(panelStrip()).getByRole('tab', { name });

/** Which of the panel's tabs is showing. Radix marks it on the trigger. */
const shownPanelTab = () =>
  within(panelStrip()).getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

// These tabs switch on mouseDown, not click.
const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

/** Select the trait from the Traits list, the way an author reaches its panel. */
const selectTrait = async (name = 'Sedge-Born') => {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: /Traits/ }));
  fireEvent.click(screen.getByText(name));
  await screen.findByRole('tablist', { name: 'Trait Fields' });
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
  it('leaves Stats for Details when the hit is in the AI-Facing Description', async () => {
    setup();
    await selectTrait();
    openPanelTab('Stats');
    await waitFor(() => expect(shownPanelTab()).toBe('Stats'));

    await openFind();
    await findFirst('thawed');

    await waitFor(() => expect(shownPanelTab()).toBe('Details'));
    // The description is a labeled wrapper around its chip editor, so the ring lands on the text itself.
    expect((await ringed()).textContent).toContain('thawed');
  });

  it('leaves Details for Pins when the hit is in a pinned value', async () => {
    setup();
    await selectTrait();
    expect(shownPanelTab()).toBe('Details');

    await openFind();
    await findFirst('burnished');

    await waitFor(() => expect(shownPanelTab()).toBe('Pins'));
    const field = await ringed();
    expect((field as HTMLInputElement).value ?? field.textContent).toContain('burnished');
  });

  it('stays put for a hit it cannot place, rather than snapping back to Details', async () => {
    setup();
    await selectTrait();
    openPanelTab('Pins');
    await waitFor(() => expect(shownPanelTab()).toBe('Pins'));

    // A hit outside the trait entirely: the editor moves to that tab, and the trait panel keeps its own
    // choice for when the author comes back.
    await openFind();
    await findFirst('Harbor Steps');
    await waitFor(() => expect(screen.queryByRole('tablist', { name: 'Trait Fields' })).toBeNull());

    await selectTrait();
    expect(shownPanelTab()).toBe('Pins');
  });
});

describe('World Editor — a Bench finding keeps the author’s tab', () => {
  it('opens the finding’s trait on whichever tab the author was last on', async () => {
    setup();
    await selectTrait();
    openPanelTab('Stats');
    await waitFor(() => expect(shownPanelTab()).toBe('Stats'));

    await clickFlask();
    // The popover names the finding's trait on both its row and its dismiss control; the row is the first.
    fireEvent.click((await screen.findAllByRole('button', { name: 'Marsh-Wed' }))[0]);

    await screen.findByRole('tablist', { name: 'Trait Fields' });
    expect(shownPanelTab()).toBe('Stats');
    // The finding's own trait is what opened, not the one the author had selected — which Details says,
    // since the name is not on the tab this landed on.
    openPanelTab('Details');
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveTextContent('Marsh-Wed'));
  });
});

describe('World Editor — a conflict note opens its rival', () => {
  it('lands on the rival trait with the Stats tab the author was reading it from', async () => {
    setup();
    await selectTrait();
    openPanelTab('Stats');
    await waitFor(() => expect(shownPanelTab()).toBe('Stats'));

    const note = screen.getByText(/The lowest in the trait list wins/);
    fireEvent.click(within(note).getAllByRole('button', { name: 'Marsh-Wed' })[0]);

    await waitFor(() => expect(shownPanelTab()).toBe('Stats'));
    openPanelTab('Details');
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveTextContent('Marsh-Wed'));
  });
});
