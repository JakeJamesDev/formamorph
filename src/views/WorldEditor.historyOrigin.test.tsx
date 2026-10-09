import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  benchEditorWorld, openEditorTab, openTraitFieldsTab, pickEditorMode, renderWorldEditorBench, shownEditorTab,
} from '@/test/worldEditorBench';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import type { World } from '@/types';

/** An edit made through a mirror returns the author to the tab and record they made it on. */

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

const linkTo = (id: string) =>
  ({ id, originalId: 't-paladin', kind: 'trait' as const, originalName: 'Paladin', groupId: null, order: 0 });

const WORLD: World = benchEditorWorld({
  stats: [{
    id: 's-mood', name: 'Mood', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [],
    code: 'return placeholders.Weather.text.length;',
  }],
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true },
    { id: 'docks', name: 'Docks', placeholderPins: [{ placeholderId: 'weather', value: 'fog' }] },
  ],
  entities: [
    {
      id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'],
      openings: [{ id: 'o-lamp', text: 'Wick trims a lamp.', kind: 'narration' }],
    },
    {
      id: 'ash', name: 'Ash', persona: true, playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
      traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null, maxPicks: 2 }],
      traits: [{ id: 't-tamed', name: 'Tamed', groupId: 'g-bond', statChanges: [] }],
      traitLinks: [linkTo('l-ash')],
      placeholders: [{ id: 'eyes', name: 'Eyes', values: [{ id: 'v-green', text: 'green' }] }],
    },
  ],
  traits: [{ id: 't-paladin', name: 'Paladin', statChanges: [], groupId: 'g-blueprints', order: 0 }],
  traitGroups: [{ id: 'g-blueprints', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' }],
  placeholders: [{ id: 'weather', name: 'Weather', values: [{ id: 'v-fog', text: 'fog' }] }],
  dictionaries: [{
    id: 'lore', name: 'Fen Lore', enabled: true,
    entries: [{ id: 'e-reeds', name: 'Reeds', key: ['reeds'], value: 'They whisper.' }],
    placeholders: [{ id: 'tide', name: 'Tide', values: [{ id: 'v-low', text: 'low' }] }],
  }],
} as Partial<World>);

/** One author action, then the event loop moves on as it does between two presses. */
const step = (action: () => void | Promise<void>) => act(async () => { await action(); });
const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
const redo = () => step(() => { fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true }); });

/** The record the open panel holds, read from its Name field. */
const openRecordName = () => screen.getByRole('textbox', { name: 'Name' }).textContent;

/** A Locations or Traits tree row, found by its drag grip, so the panel's own copy of the name never matches. */
const treeRow = (name: string) => {
  const row = screen.getAllByLabelText('Drag to reorder or nest')
    .map((grip) => grip.parentElement as HTMLElement)
    .find((r) => within(r).queryByText(name, { exact: true }));
  if (!row) throw new Error(`No tree row named ${name}`);
  return row;
};
/** The tree row a link draws under its bearer's node. */
const linkRow = (bearer: string) => {
  const rows = screen.getAllByLabelText('Drag to reorder or nest').map((grip) => grip.parentElement as HTMLElement);
  return rows[rows.findIndex((row) => within(row).queryByText(bearer, { exact: true })) + 1];
};

/** A Placeholders tree row by its label; the palette above the list draws the same name as a chip button. */
const placeholderRow = (name: string) => {
  const row = screen.getAllByText(name, { selector: 'span' }).find((el) => !el.closest('button'));
  if (!row) throw new Error(`No placeholder row named ${name}`);
  return row;
};

/** Undoes from another tab and checks the reveal, then redoes from that tab and checks it again. */
const expectReturnTo = async (away: RegExp, check: (move: 'undo' | 'redo') => void) => {
  openEditorTab(away);
  await undo();
  check('undo');
  openEditorTab(away);
  await redo();
  check('redo');
};
/** The placeholder the open panel holds, read from its Name field. */
const openPlaceholderName = () => {
  const field = screen.getByPlaceholderText('e.g. Eye Color');
  return field instanceof HTMLInputElement ? field.value : field.textContent;
};

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
});

describe('an undo of an edit made through a mirror', () => {
  it('returns to the location whose roster changed, not to the entity', async () => {
    const user = userEvent.setup();
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);
    fireEvent.click(within(treeRow('Docks')).getByText('Docks'));
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Location Fields' })).getByRole('tab', { name: 'Presence' }));
    await user.click(screen.getByRole('combobox', { name: /Select entities/ }));
    await user.click(await screen.findByRole('option', { name: 'Odd Wick, not selected' }));
    await user.keyboard('{Escape}');
    expect(ctx().entities.find((e) => e.id === 'resident')!.locations).toEqual(['harbor', 'docks']);

    await expectReturnTo(/Stats/, () => {
      expect(shownEditorTab()).toMatch(/Locations/);
      fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Location Fields' })).getByRole('tab', { name: 'Details' }));
      expect(openRecordName()).toBe('Docks');
    });
  });

  it('returns to the Overview tab for an entity opening added there', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    fireEvent.click(screen.getByRole('radio', { name: 'Openings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Opening to Odd Wick' }));
    expect(ctx().entities[0].openings).toHaveLength(2);

    await expectReturnTo(/Stats/, () => expect(shownEditorTab()).toMatch(/Overview/));
  });

  it('returns to the Traits tab for an entity-owned trait group', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);
    fireEvent.click(treeRow('Bond'));
    fireEvent.change(screen.getByLabelText('At Most'), { target: { value: '1' } });
    expect(ctx().entities.find((e) => e.id === 'ash')!.traitGroups![0].maxPicks).toBe(1);

    await expectReturnTo(/Locations/, () => {
      expect(shownEditorTab()).toMatch(/Traits/);
      expect(screen.getByRole('textbox', { name: 'Group Name' }).textContent).toBe('Bond');
    });
  });

  it('returns to the Traits tab for a Link override', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);
    fireEvent.click(within(linkRow('Ash')).getByText('Paladin'));
    openTraitFieldsTab('Availability');
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'In Game' })).getByRole('radio', { name: 'Toggleable' }));
    expect(ctx().entities.find((e) => e.id === 'ash')!.traitLinks![0].overrides).toBeDefined();

    // Only Ash's link carries the override, so Toggleable after the redo shows the link is the open row.
    await expectReturnTo(/Locations/, (move) => {
      expect(shownEditorTab()).toMatch(/Traits/);
      expect(within(screen.getByRole('radiogroup', { name: 'In Game' })).getByRole('radio', { name: 'Toggleable' }))
        .toHaveAttribute('aria-checked', move === 'redo' ? 'true' : 'false');
    });
  });

  it('returns to the Placeholders tab for an entity-scoped placeholder', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(placeholderRow('Eyes'));
    const name = screen.getByPlaceholderText('e.g. Eye Color');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Gaze' } });
    fireEvent.blur(name);
    expect(ctx().entities.find((e) => e.id === 'ash')!.placeholders![0].name).toBe('Gaze');

    await expectReturnTo(/Stats/, (move) => {
      expect(shownEditorTab()).toMatch(/Placeholders/);
      expect(openPlaceholderName()).toBe(move === 'undo' ? 'Eyes' : 'Gaze');
    });
  });

  it('returns to the Placeholders tab for a book-scoped placeholder, not to the Dictionary tab', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(placeholderRow('Tide'));
    const name = screen.getByPlaceholderText('e.g. Eye Color');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Current' } });
    fireEvent.blur(name);
    expect(ctx().dictionaries[0].placeholders![0].name).toBe('Current');

    await expectReturnTo(/Stats/, (move) => {
      expect(shownEditorTab()).toMatch(/Placeholders/);
      expect(openPlaceholderName()).toBe(move === 'undo' ? 'Tide' : 'Current');
    });
  });

  it('returns to the tab where the rename offer was accepted, not to the Stats tab', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(placeholderRow('Weather'));
    const name = screen.getByPlaceholderText('e.g. Eye Color');
    fireEvent.focus(name);
    await step(() => { fireEvent.change(name, { target: { value: 'Sky' } }); });
    await step(() => { fireEvent.blur(name); });
    // Apply is a later press, so it records its own Step on the stat.
    await step(() => { fireEvent.click(screen.getByRole('button', { name: 'Update Code' })); });
    expect(ctx().stats[0].code).toBe('return placeholders.Sky.text.length;');

    await expectReturnTo(/Locations/, (move) => {
      expect(ctx().stats[0].code).toBe(`return placeholders.${move === 'undo' ? 'Weather' : 'Sky'}.text.length;`);
      expect(shownEditorTab()).toMatch(/Placeholders/);
      expect(openPlaceholderName()).toBe('Sky');
    });
  });

  it('returns to the Placeholders tab for a pin removed there, not to the pinning location', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(placeholderRow('Weather'));
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Placeholder Fields' })).getByRole('tab', { name: 'Pins' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pin' }));
    expect(ctx().locations.find((l) => l.id === 'docks')!.placeholderPins ?? []).toHaveLength(0);

    await expectReturnTo(/Locations/, (move) => {
      expect(shownEditorTab()).toMatch(/Placeholders/);
      expect(screen.queryAllByRole('button', { name: 'Remove Pin' })).toHaveLength(move === 'undo' ? 1 : 0);
    });
  });

  it('returns to the stat whose prompt holds the chip, not to the Placeholders tab', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Mood' }));
    // The chip popover's write: the placeholder, through the shared store.
    await step(() => ctx().updatePlaceholder({ ...ctx().placeholders[0], values: [{ id: 'v-fog', text: 'mist' }] }));

    await expectReturnTo(/Locations/, () => {
      expect(shownEditorTab()).toMatch(/Stats/);
      expect(openRecordName()).toBe('Mood');
    });
  });
});

describe('when the Origin cannot be shown', () => {
  it('reveals the touched record on its own tab when the mode hides the Origin tab', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(placeholderRow('Eyes'));
    const name = screen.getByPlaceholderText('e.g. Eye Color');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Gaze' } });
    fireEvent.blur(name);
    pickEditorMode('Simple');
    openEditorTab(/Locations/);

    await undo();
    expect(ctx().entities.find((e) => e.id === 'ash')!.placeholders![0].name).toBe('Eyes');
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(openRecordName()).toBe('Ash');
  });

  it('reveals the touched record when the Origin record is gone', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);
    fireEvent.click(treeRow('Tamed'));
    fireEvent.click(within(treeRow('Tamed')).getByRole('button', { name: 'Delete' }));
    expect(ctx().entities.find((e) => e.id === 'ash')!.traits ?? []).toHaveLength(0);

    openEditorTab(/Locations/);
    await undo();
    expect(shownEditorTab()).toMatch(/Traits/);
    expect(openRecordName()).toBe('Tamed');
    // The redo removes Tamed again, so the Origin holds nothing and the entity it lived on opens.
    openEditorTab(/Locations/);
    await redo();
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(openRecordName()).toBe('Ash');
  });
});
