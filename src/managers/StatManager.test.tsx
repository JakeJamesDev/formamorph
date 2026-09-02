import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Placeholder, Stat } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import StatManager from './StatManager';

// Ten rockets banded in the stat's own units — the case the unit toggle exists for.
const rockets = {
  id: 's1', name: 'Rockets', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0,
  descriptors: [
    { id: 'd1', threshold: 3, description: 'low' },
    { id: 'd2', threshold: 6, description: 'stocked' },
    { id: 'd3', threshold: 10, description: 'full' },
  ],
} as unknown as Stat;

const store: { stat: Stat; placeholders: Placeholder[]; writes: Stat[]; rerender: () => void } = {
  stat: rockets, placeholders: [], writes: [], rerender: () => {},
};

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({
    stats: [store.stat],
    placeholders: store.placeholders,
    placementLetters: new Map(),
    placeholderOwners: new Map(),
    updateStat: (next: Stat) => {
      store.writes.push(next);
      store.stat = next;
      store.rerender();
    },
  }),
}));
// Neither the chip field nor the morph picker is under test; both pull in editors this test has no use for.
vi.mock('@/components/prompt/PlaceholderField', () => ({
  PlaceholderNameField: (props: { value: string; ariaLabel?: string }) => (
    <input readOnly value={props.value} aria-label={props.ariaLabel} data-chip-field="" />
  ),
}));
vi.mock('@/lib/useBodyMorphNames', () => ({ useBodyMorphSources: () => ({ sources: [], loading: false, load: () => {} }) }));

/** Renders the manager against the live store, re-rendering whenever it writes. */
const Harness = () => {
  const [, setTick] = useState(0);
  store.rerender = () => setTick((n) => n + 1);
  return <StatManager stat={store.stat} />;
};

const renderManager = () => render(
  <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
    <Harness />
  </EditorModeContext.Provider>,
);

beforeEach(() => {
  store.stat = { ...rockets, descriptors: rockets.descriptors.map((d) => ({ ...d })) };
  store.placeholders = [];
  store.writes = [];
});

describe('the descriptor unit control', () => {
  it('converts every threshold in one write, so no row is lost to a stale draft', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('radio', { name: '% of Max' }));

    // One write, carrying the new unit AND all three converted thresholds. Two writes would each merge
    // into the draft they were built with, and only the last would survive.
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0].thresholdUnit).toBe('percent');
    expect(store.writes[0].descriptors.map((d) => d.threshold)).toEqual([30, 60, 100]);
  });

  it('leaves the bands covering exactly what they covered before the switch', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('radio', { name: '% of Max' }));
    expect(screen.getByText('covers 0 – 3 of 10')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Raw Unit' }));
    expect(store.writes).toHaveLength(2);
    expect(store.writes[1].descriptors.map((d) => d.threshold)).toEqual([3, 6, 10]);
    expect(screen.getByText('covers 0 – 3')).toBeInTheDocument();
  });

  it('tags every threshold input with the unit it is written in', async () => {
    renderManager();
    expect(screen.getAllByText('of 10').length).toBe(4); // three bands plus the add row
    await userEvent.click(screen.getByRole('radio', { name: '% of Max' }));
    expect(screen.getAllByText('%').length).toBe(4);
  });

  it('offers no unit choice on a Percentage stat, where the two readings are the same number', () => {
    store.stat = { ...rockets, type: 'percentage', min: 0, max: 100 };
    renderManager();
    expect(screen.queryByRole('radio', { name: '% of Max' })).toBeNull();
    expect(screen.getAllByText('%').length).toBe(4);
  });
});

describe('the coverage bar', () => {
  /** Every bar segment as [label, bold?] — each segment raises its own range on hover, and Base UI
   *  stamps every live trigger, so that attribute is what the segments have in common. */
  const segments = () => [...document.querySelectorAll('div[data-base-ui-tooltip-trigger]')]
    .map((el) => [el.textContent, el.className.includes('font-semibold')]);

  it('bolds the band a fresh game opens in', () => {
    renderManager(); // starts at 4 of 10 → the 6 band
    expect(segments()).toEqual([['low', false], ['stocked', true], ['full', false]]);
  });

  it('follows the start value to another band', () => {
    store.stat = { ...store.stat, value: 9 };
    renderManager();
    expect(segments()).toEqual([['low', false], ['stocked', false], ['full', true]]);
  });

  it('bolds the uncovered zone when the start lands where no band covers it', () => {
    store.stat = { ...store.stat, max: 20, value: 15 };
    renderManager();
    expect(segments()).toEqual([['low', false], ['stocked', false], ['full', false], ['no status', true]]);
  });

  it('reads the opening band through the stat’s own unit', () => {
    // Percent thresholds put the bands at 0.3 / 0.6 / 1 rocket, so a start of 4 clears every one of them.
    store.stat = { ...store.stat, thresholdUnit: 'percent' };
    renderManager();
    expect(segments()).toEqual([['low', false], ['stocked', false], ['full', false], ['no status', true]]);
  });

  it('reads a chip in a band by its placeholder name', () => {
    const TOWN: Placeholder = { id: 'ph-town', name: 'Town Name', values: phValues(['Sedge', 'Marrow']) };
    store.placeholders = [TOWN];
    const chip = encodePlaceholderToken({ id: TOWN.id, mode: 'world', placementId: 'p1' });
    store.stat = { ...store.stat, descriptors: [{ id: 'd1', threshold: 10, description: `Far from ${chip}` }] };
    renderManager();
    expect(segments()).toEqual([['Far from {Town Name}', true]]);
    expect(screen.getByLabelText('Threshold for Far from {Town Name}')).toBeInTheDocument();
  });
});

describe('the stat text fields', () => {
  it('offers the chip field for the description and for every descriptor row, the new one included', () => {
    renderManager();
    const chipFields = document.querySelectorAll('[data-chip-field]');
    expect(Array.from(chipFields).map((el) => (el as HTMLInputElement).value))
      .toEqual(['Rockets', '', 'low', 'stocked', 'full', '']);
    expect(screen.getByLabelText('New Description')).toHaveAttribute('data-chip-field');
  });
});
