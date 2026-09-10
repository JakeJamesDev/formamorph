import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, clickFlask, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * Where the editor lands when something else picks the stat: a Find hit or a Bench finding.
 *
 * The stat panel hides its descriptors and its code behind its own tabs, so text alone can no longer reach a
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

vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; ariaLabel: string }) => (
    <textarea aria-label={props.ariaLabel} defaultValue={props.value} />
  ),
}));

/** One stat whose every searchable field holds a word found nowhere else, so a query names its field. */
const WORLD: World = benchEditorWorld({
  stats: [{
    id: 's1', name: 'Warmth', type: 'number', description: 'How thawed the traveler is.',
    min: 0, max: 10, value: 4, regen: 0, code: 'return 4;',
    descriptors: [{ id: 'd1', threshold: 3, description: 'chilled to the marrow' }],
  }, {
    // A second stat carrying one Bench finding of its own: it starts outside its own range, which the rule
    // pass warns about. That finding is what the Bench case opens.
    id: 's2', name: 'Damp', type: 'number', description: 'How wet the traveler is.',
    min: 0, max: 10, value: 50, regen: 0, descriptors: [],
  }],
} as Partial<World>);

const setup = () => renderWorldEditorBench(WORLD, 'advanced');

/** The stat panel's own strip, named apart from the editor's top-level one. */
const panelStrip = () => screen.getByRole('tablist', { name: 'Stat Fields' });

const panelTab = (name: string) => within(panelStrip()).getByRole('tab', { name });

/** Which of the panel's tabs is showing. Radix marks it on the trigger. */
const shownPanelTab = () =>
  within(panelStrip()).getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

// These tabs switch on mouseDown, not click.
const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

/** Select the stat from the Stats list, the way an author reaches its panel. */
const selectStat = async (name = 'Warmth') => {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: /Stats/ }));
  fireEvent.click(screen.getByText(name));
  await screen.findByRole('tablist', { name: 'Stat Fields' });
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
  it('leaves Details for Descriptors when the hit is in a descriptor band', async () => {
    setup();
    await selectStat();
    expect(shownPanelTab()).toBe('Details');

    await openFind();
    await findFirst('marrow');

    await waitFor(() => expect(shownPanelTab()).toBe('Descriptors'));
    const field = await ringed();
    expect((field as HTMLInputElement).value ?? field.textContent).toContain('marrow');
  });

  it('leaves Code for Details when the hit is in the Description', async () => {
    setup();
    await selectStat();
    openPanelTab('Code');
    await waitFor(() => expect(shownPanelTab()).toBe('Code'));

    await openFind();
    await findFirst('thawed');

    await waitFor(() => expect(shownPanelTab()).toBe('Details'));
    // The chip field carries its own label rather than sitting in a labeled wrapper.
    expect((await ringed()).getAttribute('aria-label')).toBe('Description');
  });

  it('stays put for a hit it cannot place, rather than snapping back to Details', async () => {
    setup();
    await selectStat();
    openPanelTab('Descriptors');
    await waitFor(() => expect(shownPanelTab()).toBe('Descriptors'));

    // A hit outside the stat entirely: the editor moves to that tab, and the stat panel keeps its own choice
    // for when the author comes back. The bar stays open, so the hint is still live — it names another
    // item's field, which is not this panel's to answer.
    await openFind();
    await findFirst('Harbor Steps');
    await waitFor(() => expect(screen.queryByRole('tablist', { name: 'Stat Fields' })).toBeNull());

    await selectStat();
    expect(shownPanelTab()).toBe('Descriptors');
  });
});

describe('World Editor — a Bench finding keeps the author’s tab', () => {
  it('opens the finding’s stat on whichever tab the author was last on', async () => {
    setup();
    await selectStat();
    openPanelTab('Descriptors');
    await waitFor(() => expect(shownPanelTab()).toBe('Descriptors'));

    await clickFlask();
    // The popover names the finding's stat on both its row and its dismiss control; the row is the first.
    fireEvent.click((await screen.findAllByRole('button', { name: 'Damp' }))[0]);

    await screen.findByRole('tablist', { name: 'Stat Fields' });
    expect(shownPanelTab()).toBe('Descriptors');
    // The finding's own stat is what opened, not the one the author had selected — which Details says, since
    // the name is not on the tab this landed on.
    openPanelTab('Details');
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveTextContent('Damp'));
  });
});
