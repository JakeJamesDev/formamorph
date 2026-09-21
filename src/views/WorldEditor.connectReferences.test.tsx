import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { Dictionary, Entity, World } from '@/types';

/**
 * Connecting what linked content expects to what the receiving world holds, through the real World Editor.
 *
 * A library item names the world Placeholder or location it needs by the id its own world gave it, which
 * means nothing here. These tests drive the step that settles each one, and read what the editor wrote onto
 * the world rather than only what it drew.
 */

const library = vi.hoisted(() => ({
  dictionaries: new Map<string, { id: string; name: string; data: Dictionary; createdAt?: string }>(),
  entities: new Map<string, { id: string; name: string; data: Entity; createdAt?: string }>(),
}));

const meta = (record: { id: string; name: string; createdAt?: string; data: Dictionary | Entity }) => ({
  id: record.id,
  name: record.name,
  createdAt: record.createdAt,
  entryCount: 'entries' in record.data ? record.data.entries.length : 0,
});

vi.mock('@/services/DictionaryStorageService', () => ({
  default: {
    getDictionaryMetadata: () => Promise.resolve([...library.dictionaries.values()].map(meta)),
    getDictionaryData: (id: string) => {
      const found = library.dictionaries.get(id);
      return found ? Promise.resolve(found.data) : Promise.reject(new Error('Dictionary not found'));
    },
    storeDictionary: (record: { id: string; name: string; data: Dictionary; createdAt?: string }) => {
      library.dictionaries.set(record.id, { ...library.dictionaries.get(record.id), ...record });
      return Promise.resolve();
    },
  },
}));

vi.mock('@/services/EntityStorageService', () => ({
  default: {
    getEntityMetadata: () => Promise.resolve([...library.entities.values()].map(meta)),
    getEntityData: (id: string) => {
      const found = library.entities.get(id);
      return found ? Promise.resolve(found.data) : Promise.reject(new Error('Entity not found'));
    },
    storeEntity: (record: { id: string; name: string; data: Entity; createdAt?: string }) => {
      library.entities.set(record.id, { ...library.entities.get(record.id), ...record });
      return Promise.resolve();
    },
  },
}));

vi.mock('@/services/AuthService', () => ({
  default: { getCurrentUser: () => ({ id: 'me', username: 'Fen' }) },
}));

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

/** A chip placement in stored token form, so the re-aiming can be read straight off the world's text. */
const chip = (id: string) => `{{ph:${id}:world:pl-1}}`;

const values = (texts: string[]) => texts.map((text, index) => ({ id: `v${index}`, text }));

/** A library book whose one entry places a chip at the world Placeholder it expects. */
const seedBook = (shared: { id: string; name: string; values: string[] }[]) => {
  const data: Dictionary = {
    id: 'lib-a',
    name: 'Court Terms',
    entries: [{
      id: 'k1', name: 'Throne', key: ['throne'],
      value: `The seat of ${shared.map((s) => chip(s.id)).join(' and ')}.`,
    }],
    sharedPlaceholders: shared.map((s) => ({ id: s.id, name: s.name, values: values(s.values) })),
  };
  library.dictionaries.set('lib-a', { id: 'lib-a', name: 'Court Terms', createdAt: '2026-01-01T00:00:00.000Z', data });
};

/** A library entity that stood somewhere in the world it left. */
const seedEntity = (locationRefs: { id: string; name: string }[]) => {
  const data: Entity = {
    id: 'lib-e', name: 'Marla', playerDescription: 'A courier.', aiDescription: 'Carries the post.', locationRefs,
  };
  library.entities.set('lib-e', { id: 'lib-e', name: 'Marla', createdAt: '2026-01-01T00:00:00.000Z', data });
};

const worldWith = (over: Partial<World>): World => benchEditorWorld({
  dictionaries: [{ id: 'b1', name: 'Marsh Lore', entries: [] }],
  ...over,
});

const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));
const clickButton = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const confirmPicker = (name: string) =>
  fireEvent.click(within(screen.getByRole('dialog', { name })).getByRole('button', { name }));
/**
 * Radix marks the dialog `aria-hidden` while a Select inside it is open, which takes the whole subtree out of
 * the accessibility tree — so once a row has been opened, the dialog's own controls are reached by their
 * names across the document rather than through it.
 */
const connectControl = (role: string, name: string) => screen.getByRole(role, { name, hidden: true });

/** Open the library picker for one kind and confirm the one seeded item. */
const addFromLibrary = async (kind: 'dictionary' | 'entity') => {
  openTab(kind === 'dictionary' ? /Dictionary/ : /Entities/);
  clickButton(kind === 'dictionary' ? /Add Dictionary/ : /Add Entity/);
  fireEvent.click(await screen.findByText(kind === 'dictionary' ? 'Court Terms' : 'Marla'));
  confirmPicker(kind === 'dictionary' ? 'Add Dictionary' : 'Add Entity');
};

/**
 * Open one row's selector. Radix opens a Select on pointerdown, and inside the editor's live tree that is the
 * event that reaches it; the options then render in their own portal, outside the modal, so a role query has
 * to look past `aria-hidden` to see them.
 */
const openSelect = async (rowName: string) => {
  const trigger = connectControl('combobox', `Use in This World for ${rowName}`);
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
};

const option = (name: string) => screen.findByRole('option', { name, hidden: true });

/** Radix takes a Select item on Enter as well as on a pointer, and only the key event is dependable here. */
const pick = async (name: string) => fireEvent.keyDown(await option(name), { key: 'Enter' });

const choose = async (rowName: string, name: string) => {
  await openSelect(rowName);
  await pick(name);
};

beforeEach(() => {
  localStorage.clear();
  library.dictionaries.clear();
  library.entities.clear();
});

describe('Content whose references the world already answers', () => {
  it('goes in with no connection step at all', async () => {
    seedBook([{ id: 'src-cap', name: 'Capital', values: ['Sedge'] }]);
    const { ctx } = renderWorldEditorBench(worldWith({
      placeholders: [{ id: 'w-cap', name: 'Capital', values: values(['Sedge']) }],
    }), 'advanced');

    await addFromLibrary('dictionary');

    await waitFor(() => expect(ctx().dictionaries).toHaveLength(2));
    expect(screen.queryByRole('dialog', { name: 'Connect World References' })).toBeNull();
    // The world gained no second Capital: the copy's chip points at the one it already had.
    expect(ctx().placeholders.filter((p) => p.name === 'Capital')).toHaveLength(1);
    expect(ctx().dictionaries.find((b) => b.name === 'Court Terms')!.entries[0].value).toContain('w-cap');
  });
});

describe('One unresolved Placeholder', () => {
  const renderOneRow = () => {
    seedBook([{ id: 'src-cap', name: 'Capital', values: ['Aldreth'] }]);
    return renderWorldEditorBench(worldWith({
      placeholders: [{ id: 'w-cap', name: 'Capital', values: values(['Sedge']) }],
    }), 'advanced');
  };

  it('opens the step on the single clear match, previewing what each side holds', async () => {
    renderOneRow();
    await addFromLibrary('dictionary');

    const dialog = await screen.findByRole('dialog', { name: 'Connect World References' });
    // What the content expects, and what this world would supply for it.
    // The two columns the step is built from, each named where the author reads it.
    expect(within(dialog).getByText('Reference')).toBeTruthy();
    expect(within(dialog).getByText('Aldreth')).toBeTruthy();
    expect(within(dialog).getByText('Use in This World')).toBeTruthy();
    const trigger = within(dialog).getByRole('combobox', { name: 'Use in This World for Capital' });
    expect(trigger).toHaveTextContent('Capital');
    expect(trigger).toHaveTextContent('Sedge');
    expect(within(dialog).getByRole('button', { name: 'Connect & Add' })).toBeEnabled();
  });

  it('inserts nothing until the step is confirmed, then stores the connection on the copy', async () => {
    const { ctx } = renderOneRow();
    await addFromLibrary('dictionary');
    await screen.findByRole('dialog', { name: 'Connect World References' });

    // The picker is done with, and the world still holds only the book it started with.
    expect(ctx().dictionaries).toHaveLength(1);

    fireEvent.click(connectControl('button', 'Connect & Add'));

    await waitFor(() => expect(ctx().dictionaries).toHaveLength(2));
    const added = ctx().dictionaries.find((b) => b.name === 'Court Terms')!;
    expect(added.link?.connections).toEqual({ 'src-cap': 'w-cap' });
    // The world keeps its own value, and the copy's chip resolves to it.
    expect(added.entries[0].value).toBe(`The seat of ${chip('w-cap')}.`);
    expect(ctx().placeholders.filter((p) => p.name === 'Capital')).toHaveLength(1);
  });

  it('creates a Placeholder of its own when the author asks for a new one', async () => {
    const { ctx } = renderOneRow();
    await addFromLibrary('dictionary');
    await screen.findByRole('dialog', { name: 'Connect World References' });
    await choose('Capital', 'Create New…');
    fireEvent.click(connectControl('button', 'Connect & Add'));

    await waitFor(() => expect(ctx().dictionaries).toHaveLength(2));
    const capitals = ctx().placeholders.filter((p) => p.name === 'Capital');
    expect(capitals).toHaveLength(2);
    const minted = capitals.find((p) => p.id !== 'w-cap')!;
    expect(minted.values.map((v) => v.text)).toEqual(['Aldreth']);
    expect(ctx().dictionaries.find((b) => b.name === 'Court Terms')!.link?.connections)
      .toEqual({ 'src-cap': minted.id });
  });
});

describe('Two Placeholders of the same name', () => {
  it('preselects neither, says so, and holds the confirm until one is picked', async () => {
    seedBook([{ id: 'src-cap', name: 'Capital', values: ['Aldreth'] }]);
    const { ctx } = renderWorldEditorBench(worldWith({
      placeholders: [
        { id: 'w-north', name: 'Capital', values: values(['Sedge']) },
        { id: 'w-south', name: 'Capital', values: values(['Harrow']) },
      ],
    }), 'advanced');

    await addFromLibrary('dictionary');
    const dialog = await screen.findByRole('dialog', { name: 'Connect World References' });

    expect(within(dialog).getByText('This world has more than one item with this name. Select the one to use.')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Connect & Add' })).toBeDisabled();

    // The two candidates read apart by the values each supplies, so the author picks a specific one.
    await choose('Capital', 'Capital Harrow');
    expect(connectControl('button', 'Connect & Add')).toBeEnabled();
    fireEvent.click(connectControl('button', 'Connect & Add'));

    await waitFor(() => expect(ctx().dictionaries).toHaveLength(2));
    // The copy follows the one the author picked, and the world gains no third Capital.
    expect(ctx().dictionaries.find((b) => b.name === 'Court Terms')!.link?.connections)
      .toEqual({ 'src-cap': 'w-south' });
    expect(ctx().placeholders.filter((p) => p.name === 'Capital')).toHaveLength(2);
  });
});

describe('A location the entity stood in', () => {
  it('offers this world’s locations, and Create New adds one the entity then stands in', async () => {
    seedEntity([{ id: 'src-inn', name: 'The Inn' }]);
    const { ctx } = renderWorldEditorBench(worldWith({}), 'advanced');

    await addFromLibrary('entity');
    await screen.findByRole('dialog', { name: 'Connect World References' });
    // The world's own location is on offer beside Create New.
    await openSelect('The Inn');
    expect(await option('Harbor Steps')).toBeTruthy();
    await pick('Create New…');
    fireEvent.click(connectControl('button', 'Connect & Add'));

    await waitFor(() => expect(ctx().entities).toHaveLength(2));
    const inn = ctx().locations.find((l) => l.name === 'The Inn')!;
    expect(inn).toBeTruthy();
    const added = ctx().entities.find((e) => e.name === 'Marla')!;
    expect(added.locations).toEqual([inn.id]);
    expect(added.locationRefs).toBeUndefined();
  });

  it('places the entity at the location the author picked instead', async () => {
    seedEntity([{ id: 'src-inn', name: 'The Inn' }]);
    const { ctx } = renderWorldEditorBench(worldWith({}), 'advanced');

    await addFromLibrary('entity');
    await screen.findByRole('dialog', { name: 'Connect World References' });
    await choose('The Inn', 'Harbor Steps');
    fireEvent.click(connectControl('button', 'Connect & Add'));

    await waitFor(() => expect(ctx().entities).toHaveLength(2));
    expect(ctx().locations).toHaveLength(1);
    const added = ctx().entities.find((e) => e.name === 'Marla')!;
    expect(added.locations).toEqual(['harbor']);
    expect(added.link?.connections).toEqual({ 'src-inn': 'harbor' });
  });
});

describe('Save Connections', () => {
  it('reconnects a copy whose Placeholder the world deleted, and follows its chips over', async () => {
    seedBook([{ id: 'src-cap', name: 'Capital', values: ['Aldreth'] }]);
    // The copy is in the world already, still pointing at a Placeholder that has since been deleted.
    const { ctx } = renderWorldEditorBench(benchEditorWorld({
      placeholders: [{ id: 'w-seat', name: 'Royal Seat', values: values(['Sedge']) }],
      dictionaries: [{
        id: 'b1', name: 'Court Terms',
        entries: [{ id: 'k1', name: 'Throne', key: ['throne'], value: `The seat of ${chip('w-gone')}.` }],
        // Holding the library item's current revision, so nothing syncs and the repair is what runs.
        link: {
          libraryId: 'lib-a', sourceName: 'Court Terms', sourceRevision: '2026-01-01T00:00:00.000Z',
          connections: { 'src-cap': 'w-gone' },
        },
      }],
    }), 'advanced');

    openTab(/Dictionary/);
    fireEvent.click(screen.getByText('Court Terms'));
    fireEvent.click(screen.getByRole('button', { name: 'More library actions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save Connections…' }));

    await screen.findByRole('dialog', { name: 'Connect World References' });
    // A different name entirely: the author connects it, which a name match never could.
    await choose('Capital', 'Royal Seat Sedge');
    fireEvent.click(connectControl('button', 'Save Connections'));

    await waitFor(() => expect(ctx().dictionaries[0].link?.connections).toEqual({ 'src-cap': 'w-seat' }));
    // The copy's own chip moves with the connection, so the entry resolves again.
    expect(ctx().dictionaries[0].entries[0].value).toBe(`The seat of ${chip('w-seat')}.`);
  });
});

describe('Back', () => {
  it('returns to the picker with the pick and the answer both still made', async () => {
    seedBook([
      { id: 'src-cap', name: 'Capital', values: ['Aldreth'] },
      { id: 'src-weather', name: 'Weather', values: ['Rain'] },
    ]);
    const { ctx } = renderWorldEditorBench(worldWith({
      placeholders: [
        { id: 'w-north', name: 'Capital', values: values(['Sedge']) },
        { id: 'w-south', name: 'Capital', values: values(['Harrow']) },
      ],
    }), 'advanced');

    await addFromLibrary('dictionary');
    await screen.findByRole('dialog', { name: 'Connect World References' });
    await choose('Capital', 'Capital Harrow');
    await choose('Weather', 'Create New…');

    fireEvent.click(connectControl('button', 'Back'));

    // The picker is back with the book still checked, so confirming again needs no re-picking.
    const picker = await screen.findByRole('dialog', { name: 'Add Dictionary' });
    // The book's own row and the link choice, both as the author left them.
    expect(within(picker).getAllByRole('checkbox', { checked: true })).toHaveLength(2);
    confirmPicker('Add Dictionary');

    await screen.findByRole('dialog', { name: 'Connect World References' });
    // Both answers survived the trip: neither row needs answering again and the confirm is live.
    const confirm = connectControl('button', 'Connect & Add');
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(ctx().dictionaries).toHaveLength(2));
    const added = ctx().dictionaries.find((b) => b.name === 'Court Terms')!;
    expect(added.link?.connections?.['src-cap']).toBe('w-south');
    expect(ctx().placeholders.find((p) => p.name === 'Weather')).toBeTruthy();
  });
});
