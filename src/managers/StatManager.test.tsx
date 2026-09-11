import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Placeholder, Stat } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValueId, phValues } from '@/test/placeholderValues';
import type { StatPanelTab } from '@/views/statPanelTabs';
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
    traits: [],
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

/** Renders the manager against the live store, re-rendering whenever it writes. The panel's tab belongs to
 *  the editor, so the harness stands in for that slot and opens on whichever tab a case is about. */
const Harness = ({ initialTab = 'descriptors' }: { initialTab?: StatPanelTab }) => {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<StatPanelTab>(initialTab);
  store.rerender = () => setTick((n) => n + 1);
  return <StatManager stat={store.stat} tab={tab} onTabChange={setTab} />;
};

const renderManager = (initialTab: StatPanelTab = 'descriptors') => render(
  <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
    <Harness initialTab={initialTab} />
  </EditorModeContext.Provider>,
);

/** Every chip field the open tab renders, by value, in document order. */
const chipFieldValues = () =>
  Array.from(document.querySelectorAll('[data-chip-field]')).map((el) => (el as HTMLInputElement).value);

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

    await userEvent.click(screen.getByRole('radio', { name: 'Raw' }));
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

describe('the tab strip', () => {
  it('drops the Code tab for a stat with no numeric value, rather than offering an empty one', () => {
    // A type no editor writes any more. `migrateWorld` retypes it on the way in, so the editor never shows
    // one — but the panel takes whatever it is handed, and a tab whose body renders nothing is worse than
    // no tab. Rendered here rather than through the editor for exactly that reason.
    store.stat = { ...rockets, type: 'list' } as unknown as Stat;
    renderManager('details');
    const strip = screen.getByRole('tablist', { name: 'Stat Fields' });
    expect(within(strip).getAllByRole('tab').map((el) => el.textContent)).toEqual(['Details', 'Descriptors']);
  });

  it('offers all three tabs for a numeric stat', () => {
    renderManager('details');
    const strip = screen.getByRole('tablist', { name: 'Stat Fields' });
    expect(within(strip).getAllByRole('tab').map((el) => el.textContent)).toEqual(['Details', 'Descriptors', 'Code']);
  });
});

describe('the stat text fields', () => {
  it('offers the chip field for the name and the description on Details', () => {
    renderManager('details');
    expect(chipFieldValues()).toEqual(['Rockets', '']);
  });

  it('offers the chip field for every descriptor row, the new one included', () => {
    renderManager();
    expect(chipFieldValues()).toEqual(['low', 'stocked', 'full', '']);
    expect(screen.getByLabelText('New Description')).toHaveAttribute('data-chip-field');
  });
});

describe('the descriptor pin button', () => {
  const TOWN: Placeholder = { id: 'ph-town', name: 'Town Name', values: phValues(['Sedge', 'Marrow']) };
  const pinned = () => {
    store.placeholders = [TOWN];
    store.stat = {
      ...store.stat,
      descriptors: [
        { id: 'd1', threshold: 3, description: 'low', placeholderPins: [{ placeholderId: TOWN.id, value: 'Sedge' }] },
        { id: 'd2', threshold: 6, description: 'stocked' },
      ],
    };
  };

  it('counts the row’s pins on the badge, and opens them in a popover', async () => {
    pinned();
    renderManager();
    const low = screen.getByRole('button', { name: 'Pins for low' });
    expect(low.textContent).toBe('1');
    expect(screen.getByRole('button', { name: 'Pins for stocked' }).textContent).toBe('');
    await userEvent.click(low);
    expect(screen.getByRole('textbox', { name: 'Pinned Value' })).toHaveValue('Sedge');
  });

  it('writes the popover’s rows onto that descriptor, and nothing else', async () => {
    pinned();
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: 'Pins for low' }));
    // A value picked off the list lands on this descriptor's pin, named by id.
    await userEvent.click(screen.getByRole('textbox', { name: 'Pinned Value' }));
    await userEvent.click(screen.getByRole('button', { name: 'Marrow' }));
    expect(store.writes.at(-1)!.descriptors[0].placeholderPins)
      .toEqual([{ placeholderId: TOWN.id, value: 'Marrow', valueId: phValueId('Marrow') }]);
    await userEvent.click(screen.getByRole('button', { name: 'Add Placeholder Pin' }));
    const last = store.writes.at(-1)!.descriptors;
    expect(last[0].placeholderPins).toEqual([
      { placeholderId: TOWN.id, value: 'Marrow', valueId: phValueId('Marrow') }, { placeholderId: '', value: '' },
    ]);
    expect(last[1].placeholderPins).toBeUndefined();
    // Emptying the list drops the field rather than leaving an empty array behind.
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove Pin' })[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Pin' }));
    expect(store.writes.at(-1)!.descriptors[0].placeholderPins).toBeUndefined();
  });

  it('shows no pin button in Simple mode, pins or no pins', () => {
    pinned();
    render(
      <EditorModeContext.Provider value={{ mode: 'simple', advanced: false, setMode: () => {} }}>
        <Harness />
      </EditorModeContext.Provider>,
    );
    expect(screen.queryByRole('button', { name: /^Pins for/ })).toBeNull();
  });
});
