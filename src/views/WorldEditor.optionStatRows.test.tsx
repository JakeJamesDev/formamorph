import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { Stat, World, WorldOption } from '@/types';

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

const stats: Stat[] = [
  { id: 'gold', name: 'Gold', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [] },
  { id: 'hunger', name: 'Hunger', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [] },
];
const options: WorldOption[] = [
  { id: 'diff', name: 'Difficulty', type: 'choice', shownToPlayer: true, midGame: true, values: [{ id: 'easy', name: 'Easy' }, { id: 'hard', name: 'Hard' }], default: 'easy' },
  { id: 'hc', name: 'Hardcore', type: 'boolean', shownToPlayer: true, midGame: true, default: false },
  { id: 'size', name: 'Size', type: 'number', shownToPlayer: true, midGame: false, min: 0, max: 5, default: 0 },
];
const WORLD: World = benchEditorWorld({ options, stats } as Partial<World>);

/** Pick a Select's option by keyboard: a click needs pointer capture, which jsdom lacks. */
const pickOption = (trigger: HTMLElement, name: string) => {
  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.keyDown(screen.getByRole('option', { name }), { key: 'Enter' });
};
const combo = (name: string) => screen.getByRole('combobox', { name });

beforeEach(() => { localStorage.clear(); });

describe('stat rows on the Options tab', () => {
  it('adds a stat change and a stat toggle to a choice value', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Options/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Difficulty' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Stat Change' })[1]);
    pickOption(combo('Hard Stat Change 1 Stat'), 'Gold');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Hard Stat Change 1 Amount' }), { target: { value: '-50' } });
    pickOption(combo('Hard Stat Change 1 Facet'), 'Regen');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Stat Availability' })[1]);
    pickOption(combo('Hard Stat Availability 1 Stat'), 'Hunger');

    const hard = () => {
      const option = bench.ctx().options.find((o) => o.id === 'diff');
      return option?.type === 'choice' ? option.values.find((v) => v.id === 'hard') : undefined;
    };
    expect(hard()).toEqual({
      id: 'hard', name: 'Hard',
      statChanges: [{ statId: 'gold', value: -50, type: 'regen' }], statToggles: [{ statId: 'hunger', enabled: true }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Hard Stat Availability 1' }));
    expect(hard()?.statToggles).toBeUndefined();
  });

  it('adds a stat change to a boolean’s Off state only', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Options/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Hardcore' }));
    expect(screen.getByText('Stat Changes When On')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Stat Change' })[1]);
    pickOption(combo('Off Stat Change 1 Stat'), 'Gold');
    pickOption(combo('Off Stat Change 1 Facet'), 'Starting Value');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Off Stat Change 1 Amount' }), { target: { value: '100' } });

    expect(bench.ctx().options.find((o) => o.id === 'hc')).toMatchObject({
      offStatChanges: [{ statId: 'gold', value: 100, type: 'starting' }],
    });
    expect(bench.ctx().options.find((o) => o.id === 'hc')).not.toHaveProperty('onStatChanges', expect.anything());
  });

  it('offers no stat rows on a number Option, and no toggles outside Advanced', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openEditorTab(/Options/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Difficulty' }));
    expect(screen.getAllByRole('button', { name: 'Add Stat Change' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Add Stat Availability' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Select Size' }));
    expect(screen.queryByRole('button', { name: 'Add Stat Change' })).toBeNull();
  });
});
