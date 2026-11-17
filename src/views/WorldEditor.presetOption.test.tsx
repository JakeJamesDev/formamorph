import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World, WorldOption } from '@/types';

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

const options: WorldOption[] = [
  { id: 'size', name: 'Size', type: 'choice', shownToPlayer: true, midGame: false, values: [{ id: 'small', name: 'Small' }, { id: 'big', name: 'Big' }], default: 'small' },
  { id: 'secret', name: 'Secret', type: 'boolean', shownToPlayer: false, midGame: false, default: false },
  { id: 'start', name: 'Start', type: 'choice', shownToPlayer: true, midGame: false, values: [{ id: 'a', name: 'A' }], default: 'a' },
];
const traits = [
  { id: 'brave', name: 'Brave', statChanges: [] },
  { id: 'blessed', name: 'Blessed', statChanges: [], mode: 'alwaysOn' },
];
const wolf = { id: 'wolf', name: 'Wolf', traits: [{ id: 'feral', name: 'Feral', statChanges: [] }] };
const WORLD: World = benchEditorWorld({ options, traits, entities: [wolf] } as Partial<World>);

/** Pick a Select's option by keyboard: a click needs pointer capture, which jsdom lacks. */
const pickOption = (trigger: HTMLElement, name: string) => {
  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.keyDown(screen.getByRole('option', { name }), { key: 'Enter' });
};

beforeEach(() => { localStorage.clear(); });

describe('a Preset Option on the Options tab', () => {
  it('is made by the type switch, takes a mode, and holds a named value that sets a shown Option', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Options/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Start' }));
    pickOption(screen.getByRole('combobox', { name: 'Type' }), 'Preset');
    const preset = () => bench.ctx().options.find((o) => o.id === 'start')!;
    expect(preset()).toMatchObject({ type: 'preset', mode: 'snapshot' });
    expect(screen.queryByRole('checkbox', { name: 'Shown to Player' })).toBeNull();

    fireEvent.click(screen.getAllByRole('radio', { name: 'Keep as Set' })[0]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Value 1 Name' }), { target: { value: 'Big Start' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Big Start Description' }), { target: { value: 'Everything is big' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Row' })[0]);

    const target = screen.getByRole('combobox', { name: 'Big Start Row 1 Target' });
    fireEvent.keyDown(target, { key: 'Enter' });
    const offered = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(offered).toEqual(['Size', 'Starting Location', 'Brave', 'Wolf: Feral']);
    fireEvent.keyDown(screen.getByRole('option', { name: 'Size' }), { key: 'Enter' });
    pickOption(screen.getByRole('combobox', { name: 'Big Start Row 1 Value' }), 'Big');

    expect(preset()).toEqual({
      id: 'start', name: 'Start', type: 'preset', mode: 'overlay',
      values: [
        { id: expect.any(String), name: 'Big Start', description: 'Everything is big', rows: [{ kind: 'option', optionId: 'size', value: 'big' }] },
        { id: expect.any(String), name: 'Value 2', description: '', rows: [] },
      ],
    });
  });

  it('turns a root or an entity-owned trait on or off', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Options/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Start' }));
    pickOption(screen.getByRole('combobox', { name: 'Type' }), 'Preset');
    const rows = () => (bench.ctx().options.find((o) => o.id === 'start') as Extract<WorldOption, { type: 'preset' }>).values[0].rows;

    fireEvent.click(screen.getAllByRole('button', { name: 'Add Row' })[0]);
    pickOption(screen.getByRole('combobox', { name: 'Value 1 Row 1 Target' }), 'Brave');
    expect(rows()).toEqual([{ kind: 'trait', traitId: 'brave', on: true }]);

    fireEvent.click(screen.getAllByRole('button', { name: 'Add Row' })[0]);
    pickOption(screen.getByRole('combobox', { name: 'Value 1 Row 2 Target' }), 'Wolf: Feral');
    pickOption(screen.getByRole('combobox', { name: 'Value 1 Row 2 Value' }), 'Off');
    expect(rows()).toEqual([
      { kind: 'trait', traitId: 'brave', on: true },
      { kind: 'trait', traitId: 'feral', ownerId: 'wolf', on: false },
    ]);
  });

  it('sets a world persona and a Starting Location', () => {
    const place = (id: string, isStarting = false) => ({ id, name: id, description: '', isStarting });
    const world = benchEditorWorld({
      options,
      entities: [
        { id: 'knight', name: 'Knight', persona: true, locations: ['keep'] },
        { id: 'hermit', name: 'Hermit', customPersona: true },
        wolf,
      ],
      locations: [place('town', true), place('keep'), place('cave')],
    } as Partial<World>);
    const bench = renderWorldEditorBench(world, 'advanced');
    openEditorTab(/Options/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Start' }));
    pickOption(screen.getByRole('combobox', { name: 'Type' }), 'Preset');
    const rows = () => (bench.ctx().options.find((o) => o.id === 'start') as Extract<WorldOption, { type: 'preset' }>).values[0].rows;
    const offered = (name: string) => {
      fireEvent.keyDown(screen.getByRole('combobox', { name }), { key: 'Enter' });
      const names = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
      return names;
    };

    fireEvent.click(screen.getAllByRole('button', { name: 'Add Row' })[0]);
    pickOption(screen.getByRole('combobox', { name: 'Value 1 Row 1 Target' }), 'Persona');
    // Marked personas and the Custom Persona only: the Wolf is no persona, and library personas are the player's.
    expect(offered('Value 1 Row 1 Value')).toEqual(['Knight', 'Hermit']);
    pickOption(screen.getByRole('combobox', { name: 'Value 1 Row 1 Value' }), 'Hermit');

    fireEvent.click(screen.getAllByRole('button', { name: 'Add Row' })[0]);
    pickOption(screen.getByRole('combobox', { name: 'Value 1 Row 2 Target' }), 'Starting Location');
    // Starting locations and every persona's start places.
    expect(offered('Value 1 Row 2 Value')).toEqual(['town', 'keep']);
    pickOption(screen.getByRole('combobox', { name: 'Value 1 Row 2 Value' }), 'keep');

    expect(rows()).toEqual([{ kind: 'persona', entityId: 'hermit' }, { kind: 'location', locationId: 'keep' }]);
  });

  it('warns on a value with rows that can’t apply, and names each row', () => {
    const preset: WorldOption = {
      id: 'start', name: 'Start', type: 'preset', mode: 'snapshot', values: [
        { id: 'bad', name: 'Bad', description: '', rows: [
          { kind: 'trait', traitId: 'brave', on: true },
          { kind: 'trait', traitId: 'blessed', on: false },
          { kind: 'trait', traitId: 'gone', on: true },
          { kind: 'trait', traitId: 'feral', ownerId: 'wolf', on: true },
          { kind: 'option', optionId: 'secret', value: true },
          { kind: 'trait', traitId: 'gone-too', ownerId: 'wolf', on: false },
          { kind: 'location', locationId: 'nowhere' },
        ] },
        { id: 'good', name: 'Good', description: '', rows: [{ kind: 'trait', traitId: 'feral', ownerId: 'wolf', on: true }] },
      ],
    };
    renderWorldEditorBench(benchEditorWorld({ options: [options[0], options[1], preset], traits, entities: [wolf] } as Partial<World>), 'advanced');
    openEditorTab(/Options/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Start' }));
    // Only the bad value warns.
    expect(screen.getAllByText(/^Can't apply/).map((s) => s.textContent)).toEqual([
      "Can't apply: Blessed, Secret: On, 2 deleted traits, a deleted location",
    ]);
  });

  it('names a persona or location row by its value', () => {
    const preset: WorldOption = {
      id: 'start', name: 'Start', type: 'preset', mode: 'overlay', values: [{ id: 'v', name: 'V', description: '', rows: [
        { kind: 'persona', entityId: 'wolf' },
        { kind: 'location', locationId: 'cave' },
      ] }],
    };
    const world = benchEditorWorld({
      options: [preset], entities: [wolf], locations: [{ id: 'cave', name: 'Cave', description: '', isStarting: false }],
    } as Partial<World>);
    renderWorldEditorBench(world, 'advanced');
    openEditorTab(/Options/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Start' }));
    // The Wolf is no persona, and the Cave is no starting location.
    expect(screen.getByText(/^Can't apply/).textContent).toBe("Can't apply: Persona: Wolf, Starting Location: Cave");
  });
});
