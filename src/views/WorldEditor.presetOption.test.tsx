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
const WORLD: World = benchEditorWorld({ options } as Partial<World>);

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

    const target = screen.getByRole('combobox', { name: 'Big Start Row 1 Option' });
    fireEvent.keyDown(target, { key: 'Enter' });
    const offered = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(offered).toEqual(['Size']);
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
});
