import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, clickFlask, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * Where the editor lands when something else picks the entity: a Find hit, a Bench finding, or the
 * Placeholders tab's owner node.
 *
 * The entity panel hides most of its fields behind its own tabs, so text alone can no longer reach a hit —
 * whatever navigates has to open the owning tab first, and early enough that the reveal finds the field
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

/** One entity whose every searchable field holds a word found nowhere else, so a query names its field. */
const WORLD: World = benchEditorWorld({
  entities: [{
    id: 'e1',
    name: 'Wren',
    aliases: ['Lamplighter'],
    type: 'Fenfolk',
    imageTags: 'oilskin, lantern',
    playerDescription: 'The keeper of the steps.',
    aiDescription: 'Tends the harbor beacons after dusk.',
    aiSummary: 'The Lamplighter minds the causeway.',
    locations: ['harbor'],
    placeholders: [{ id: 'p1', name: 'Mood', values: [{ id: 'v1', text: 'wry' }] }],
  }, {
    // A second entity carrying one Bench finding of its own: its alias opens with an article, which the
    // matcher warns about. That finding is what the Bench case opens.
    id: 'e2', name: 'Marsh Tom', aliases: ['The Ferryman'], locations: ['harbor'],
    aiDescription: 'Poles the flat across.',
  }],
});

const setup = (mode: 'advanced' | 'simple' = 'advanced') => renderWorldEditorBench(WORLD, mode);

/** The entity panel's own strip, named apart from the editor's top-level one. */
const panelStrip = () => screen.getByRole('tablist', { name: 'Entity Fields' });

const panelTab = (name: string) => within(panelStrip()).getByRole('tab', { name });

/** Which of the panel's tabs is showing. Radix marks it on the trigger. */
const shownPanelTab = () =>
  within(panelStrip()).getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

// These tabs switch on mouseDown, not click.
const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

/** One row of a tree. The entity's name is also drawn as meta elsewhere on the page, so the row is picked
 *  as the match sitting inside a clickable list row. */
const treeRow = (name: string) => {
  const row = screen.getAllByText(name)
    .map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]'))
    .find(Boolean);
  if (!row) throw new Error(`No tree row named ${name}`);
  return row;
};

/** Select the entity from the Entities list, the way an author reaches its panel. */
const selectEntity = async () => {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: /Entities/ }));
  fireEvent.click(treeRow('Wren'));
  await screen.findByRole('tablist', { name: 'Entity Fields' });
};

/** Open Find (Ctrl+H for the replace row) and wait for the bar to take focus. */
const openFind = async (withReplace = false) => {
  fireEvent.keyDown(window, { key: withReplace ? 'h' : 'f', ctrlKey: true });
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
  it('leaves Profile for Descriptions when the hit is in the AI-Facing Description', async () => {
    setup();
    await selectEntity();
    expect(shownPanelTab()).toBe('Profile');

    await openFind();
    await findFirst('beacons');

    await waitFor(() => expect(shownPanelTab()).toBe('Descriptions'));
    expect((await ringed()).closest('[data-find-field]')?.getAttribute('data-find-field')).toMatch(/AI-Facing Description/);
  });

  it('leaves Descriptions for Profile when the hit is in Image Tags', async () => {
    setup();
    await selectEntity();
    openPanelTab('Descriptions');
    await waitFor(() => expect(shownPanelTab()).toBe('Descriptions'));

    await openFind();
    await findFirst('oilskin');

    await waitFor(() => expect(shownPanelTab()).toBe('Profile'));
    const field = await ringed();
    expect((field as HTMLInputElement).value ?? field.textContent).toContain('oilskin');
  });

  it('leaves Descriptions for Profile and rings the chip when the hit is an alias', async () => {
    setup();
    await selectEntity();
    openPanelTab('Descriptions');
    await waitFor(() => expect(shownPanelTab()).toBe('Descriptions'));

    await openFind();
    await findFirst('Lamplighter');

    await waitFor(() => expect(shownPanelTab()).toBe('Profile'));
    // An alias is one entry of a chip list, so the marker lands on the chip rather than on a text box.
    const chip = await ringed();
    expect(chip.hasAttribute('data-chip') || chip.closest('[data-chip]') !== null).toBe(true);
    expect(chip.textContent).toContain('Lamplighter');
  });

  it('stays put for a hit it cannot place, rather than snapping back to Profile', async () => {
    setup();
    await selectEntity();
    openPanelTab('Descriptions');
    await waitFor(() => expect(shownPanelTab()).toBe('Descriptions'));

    // A hit outside the entity entirely: the editor moves to that tab, and the entity panel keeps its own
    // choice for when the author comes back. The bar stays open, so the hint is still live — it names
    // another item's field, which is not this panel's to answer.
    await openFind();
    await findFirst('Harbor Steps');
    await waitFor(() => expect(screen.queryByRole('tablist', { name: 'Entity Fields' })).toBeNull());

    await selectEntity();
    expect(shownPanelTab()).toBe('Descriptions');
  });
});

describe('World Editor — Replace reaches a field on a tab that is not showing', () => {
  it('changes the record for a match the panel never mounted', async () => {
    const { ctx } = setup();
    await selectEntity();
    expect(shownPanelTab()).toBe('Profile');

    // 'Lamplighter' is an alias, which is on Profile, and a word of the summary, which is on Descriptions.
    // The first hit keeps the panel where it is, so the summary is replaced without ever being rendered.
    await openFind(true);
    await findFirst('Lamplighter');
    await waitFor(() => expect(shownPanelTab()).toBe('Profile'));

    fireEvent.change(screen.getByRole('textbox', { name: 'Replace with' }), { target: { value: 'Wickman' } });
    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Replace All' }));

    await waitFor(() => expect(ctx().entities[0].aiSummary).toBe('The Wickman minds the causeway.'));
    expect(ctx().entities[0].aliases).toEqual(['Wickman']);
    // The panel never left Profile, so Descriptions was never mounted for that edit.
    expect(shownPanelTab()).toBe('Profile');
  });
});

describe('World Editor — the other ways in pick a tab', () => {
  it('lands the owner node Open on the entity Placeholders tab', async () => {
    setup();
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /^Placeholders/ }));
    // The owner node for the entity that owns a scoped placeholder.
    await screen.findAllByText('Mood');
    fireEvent.click(treeRow('Wren'));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Entity' }));

    await screen.findByRole('tablist', { name: 'Entity Fields' });
    await waitFor(() => expect(shownPanelTab()).toBe('Placeholders'));
  });

  it('leaves a Bench finding on whichever tab the author was last on', async () => {
    setup();
    await selectEntity();
    openPanelTab('Descriptions');
    await waitFor(() => expect(shownPanelTab()).toBe('Descriptions'));

    await clickFlask();
    // The popover names the finding's entity on both its row and its dismiss control; the row is the first.
    fireEvent.click((await screen.findAllByRole('button', { name: 'Marsh Tom' }))[0]);

    await screen.findByRole('tablist', { name: 'Entity Fields' });
    expect(shownPanelTab()).toBe('Descriptions');
    // The finding's own entity is what opened, not the one the author had selected. Read from the tab that
    // is showing, since Profile holds the name and Profile is not the tab this landed on.
    expect(screen.getByText('Poles the flat across.')).toBeInTheDocument();
  });
});
