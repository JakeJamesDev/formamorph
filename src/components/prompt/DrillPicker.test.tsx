import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChipInput from './ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder } from '@/types';

import { phValues } from '@/test/placeholderValues';
/**
 * Re-aiming a placed chip from its own pop-out: the picker opens on the path the chip already carries, and
 * whatever the author settles on moves that chip rather than replacing it. The two kinds of step read
 * differently — a variant names one branch, a slot routes through whichever value rolls — so the picker
 * keeps them apart and marks the slot a roll can miss.
 */

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });

const WORLD: Placeholder[] = [
  { id: 'molly', name: 'Molly', values: phValues([chip('white'), chip('asian')]) },
  { id: 'white', name: 'isWhite', roll: false, values: phValues([chip('hair'), chip('eyes')]) },
  { id: 'asian', name: 'isAsian', roll: false, values: phValues([chip('hair'), 'dark brown eyes']) },
  { id: 'hair', name: 'Hair', values: phValues(['brown', 'black']) },
  { id: 'eyes', name: 'Eyes', values: phValues(['green']) },
];

/** One placed chip in a field, under a store an inline create can write to. */
function Harness({ token }: { token: string }) {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>(WORLD);
  const [value, setValue] = useState(token);
  return (
    <PlaceholderStoreProvider value={placeholderStore(placeholders, setPlaceholders)}>
      <Field value={value} onChange={setValue} placeholders={placeholders} />
      <div data-testid="value">{value}</div>
      <div data-testid="names">{placeholders.map((p) => p.name).join(',')}</div>
    </PlaceholderStoreProvider>
  );
}

function Field({ value, onChange, placeholders }: {
  value: string;
  onChange: (v: string) => void;
  placeholders: Placeholder[];
}) {
  return (
    <ChipInput value={value} onChange={onChange} vocabulary={usePlaceholderChipVocabulary(placeholders)} ariaLabel="Name" />
  );
}

const value = () => screen.getByTestId('value').textContent ?? '';
const picker = () => screen.getByTestId('drill-picker');
const rowNames = () => within(picker()).getAllByTestId('drill-picker-row').map((r) => r.textContent ?? '');

/** Open the placed chip's pop-out and walk into its picker. A Unique chip says so in its own label, so the
 *  chip is found by what its path reads as rather than by the whole pill. */
async function openPicker(user: ReturnType<typeof userEvent.setup>, path: string) {
  await user.click(screen.getByText(new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( \\(Unique\\))?$`)));
  await user.click(screen.getByRole('button', { name: 'Re-Pick…' }));
}

/** The rows under one section heading, by the heading's own text. */
function sectionRows(heading: string): string[] {
  const head = within(picker()).getByText(heading);
  const section = head.parentElement as HTMLElement;
  return within(section).getAllByTestId('drill-picker-row').map((r) => r.textContent ?? '');
}

describe('DrillPicker — what a level offers', () => {
  it('opens on the level the chip already points at', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, 'Molly');
    expect(within(picker()).getByRole('button', { name: 'Molly' })).toBeInTheDocument();
    expect(rowNames().join(' ')).toContain('isWhite');
  });

  it('separates the variants it names outright from the slots a roll routes to', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, 'Molly');
    expect(sectionRows('Wildcard Variants')).toEqual(['isWhite', 'isAsian']);
    expect(sectionRows('Slots').map((r) => r.replace('not in every value', '').trim())).toEqual(['Hair', 'Eyes']);
  });

  it('names the section by what the level is', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1', path: [{ kind: 'val', ref: 'white' }] })} />);
    await openPicker(user, 'Molly › isWhite');
    expect(within(picker()).getByText('Object Values')).toBeInTheDocument();
    // An Object applies every value, so nothing routes through a roll and there are no slots to offer.
    expect(within(picker()).queryByText('Slots')).not.toBeInTheDocument();
  });

  it('marks the slot a roll can miss, and leaves the one every value holds unmarked', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, 'Molly');
    const [hair, eyes] = sectionRows('Slots');
    expect(hair).toBe('Hair');
    expect(eyes).toContain('not in every value'); // isAsian describes its eyes as prose
  });

  it('counts the values no path can address', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1', path: [{ kind: 'val', ref: 'asian' }] })} />);
    await openPicker(user, 'Molly › isAsian');
    expect(within(picker()).getByText('1 plain value — not addressable.')).toBeInTheDocument();
  });

  it('filters the level it is on', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, 'Molly');
    await user.type(within(picker()).getByLabelText('Filter Placeholders'), 'asian');
    expect(rowNames()).toEqual(['isAsian']);
  });
});

describe('DrillPicker — re-picking a placed chip', () => {
  it('rewrites the chip’s path and keeps its mode and placement', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'unique', placementId: 'p9' })} />);
    await openPicker(user, 'Molly');
    await user.click(within(picker()).getByRole('button', { name: 'isWhite' }));
    const d = decodePlaceholderToken(value())!;
    expect(d.path).toEqual([{ kind: 'val', ref: 'white' }]);
    expect(d.mode).toBe('unique');
    expect(d.placementId).toBe('p9');
  });

  it('places a slot as a slot, not as the variant it happens to sit in', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, 'Molly');
    await user.click(within(picker()).getByRole('button', { name: /^Hair/ }));
    expect(decodePlaceholderToken(value())?.path).toEqual([{ kind: 'slot', name: 'Hair' }]);
  });

  it('walks deeper and places the whole path it walked', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, 'Molly');
    await user.click(within(picker()).getByRole('button', { name: 'Drill Into isWhite' }));
    await user.click(within(picker()).getByRole('button', { name: 'Eyes' }));
    expect(decodePlaceholderToken(value())?.path).toEqual([
      { kind: 'val', ref: 'white' },
      { kind: 'val', ref: 'eyes' },
    ]);
  });

  it('backs out to the whole world and re-aims the chip at another placeholder', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'unique', placementId: 'p9' })} />);
    await openPicker(user, 'Molly');
    await user.click(within(picker()).getByRole('button', { name: 'All Placeholders' }));
    await user.click(within(picker()).getByRole('button', { name: 'Hair' }));
    const d = decodePlaceholderToken(value())!;
    expect(d.id).toBe('hair');
    expect(d.path).toBeUndefined();
    expect(d.placementId).toBe('p9'); // the placement is the chip's own, not the row it was picked from
  });

  it('drops the filter on the way into a level, so each is searched on its own terms', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, 'Molly');
    await user.type(within(picker()).getByLabelText('Filter Placeholders'), 'white');
    await user.click(within(picker()).getByRole('button', { name: 'Drill Into isWhite' }));
    expect(rowNames()).toEqual(['Hair', 'Eyes']);
  });

  it('opens on where the chip points now, not where the last walk ended', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, 'Molly');
    await user.click(within(picker()).getByRole('button', { name: 'isWhite' }));
    await openPicker(user, 'Molly › isWhite');
    expect(rowNames()).toEqual(['Hair', 'Eyes']);
  });
});

describe('DrillPicker — a chip whose path the world cannot walk', () => {
  it('opens where the slot was chosen, so the sibling slots are there to pick instead', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1', path: [{ kind: 'slot', name: 'Hair' }] })} />);
    await openPicker(user, 'Molly › Hair');
    // Molly's level, not the whole world: a slot names no one target, so the level that offered it is where
    // re-aiming belongs.
    expect(within(picker()).getByText('Wildcard Variants')).toBeInTheDocument();
    await user.click(within(picker()).getByRole('button', { name: /^Eyes/ }));
    expect(decodePlaceholderToken(value())?.path).toEqual([{ kind: 'slot', name: 'Eyes' }]);
  });

  it('opens on the whole world when the placeholder itself is gone', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'ghost', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, '(missing)');
    await user.click(within(picker()).getByRole('button', { name: 'Molly' }));
    expect(decodePlaceholderToken(value())?.id).toBe('molly');
  });
});

describe('DrillPicker — making a placeholder that is not there yet', () => {
  it('mints one from the root list and aims the chip at it', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'unique', placementId: 'p9' })} />);
    await openPicker(user, 'Molly');
    await user.click(within(picker()).getByRole('button', { name: 'All Placeholders' }));
    await user.type(within(picker()).getByLabelText('Filter Placeholders'), 'Freckles');
    await user.click(screen.getByTestId('drill-picker-create'));
    expect(screen.getByTestId('names').textContent).toContain('Freckles');
    const d = decodePlaceholderToken(value())!;
    expect(d.path).toBeUndefined();
    expect(d.placementId).toBe('p9'); // still this placement's chip, now naming the new placeholder
  });

  it('offers nothing to make inside a level, where a new placeholder would be no part of it', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, 'Molly');
    await user.type(within(picker()).getByLabelText('Filter Placeholders'), 'Freckles');
    expect(screen.queryByTestId('drill-picker-create')).not.toBeInTheDocument();
  });

  it('offers nothing to make before anything is typed', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })} />);
    await openPicker(user, 'Molly');
    await user.click(within(picker()).getByRole('button', { name: 'All Placeholders' }));
    expect(screen.queryByTestId('drill-picker-create')).not.toBeInTheDocument();
  });
});

describe('DrillPicker — where re-pick is not on offer', () => {
  it('stays away from a read-only field, which has nothing to rewrite', async () => {
    const user = userEvent.setup();
    function ReadOnly() {
      return (
        <ChipInput
          value={encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })}
          onChange={() => {}}
          vocabulary={usePlaceholderChipVocabulary(WORLD)}
          ariaLabel="Name"
          readOnly
        />
      );
    }
    render(<ReadOnly />);
    await user.click(screen.getByText('Molly'));
    expect(screen.queryByRole('button', { name: 'Re-Pick…' })).not.toBeInTheDocument();
  });
});

/**
 * A placeholder another one owns is private to it. The picker still lists it — hiding a name the author
 * already knows would make re-aiming a guessing game — but refuses to aim a chip there, and offers to
 * promote it instead.
 */
describe('DrillPicker — an owned target', () => {
  /** The same world with Molly's two variants taken privately. */
  const OWNED: Placeholder[] = WORLD.map((p) =>
    (p.id === 'white' || p.id === 'asian' ? { ...p, ownerId: 'molly' } : p));

  function OwnedHarness() {
    const [placeholders, setPlaceholders] = useState<Placeholder[]>(OWNED);
    const [value, setValue] = useState(chip('hair'));
    return (
      <PlaceholderStoreProvider value={placeholderStore(placeholders, setPlaceholders)}>
        <Field value={value} onChange={setValue} placeholders={placeholders} />
        <div data-testid="value">{value}</div>
        <div data-testid="owners">{placeholders.map((p) => `${p.name}:${p.ownerId ?? '-'}`).join(',')}</div>
      </PlaceholderStoreProvider>
    );
  }
  const owners = () => screen.getByTestId('owners').textContent ?? '';
  /** The picker seeds on the level the chip stands at; every case here is about the root list. */
  const toRoot = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(within(picker()).getByRole('button', { name: 'All Placeholders' }));

  it('lists an owned placeholder at the root, named by its owner', async () => {
    const user = userEvent.setup();
    render(<OwnedHarness />);
    await openPicker(user, 'Hair');
    await toRoot(user);
    // The row says it is owned right there, which is the only warning the author gets before the refusal.
    expect(rowNames()).toEqual(['Molly', 'Molly › isWhiteowned', 'Molly › isAsianowned', 'Hair', 'Eyes']);
  });

  it('refuses to aim the chip there, and says whose it is', async () => {
    const user = userEvent.setup();
    render(<OwnedHarness />);
    await openPicker(user, 'Hair');
    await toRoot(user);
    const before = value();
    await user.click(within(picker()).getAllByTestId('drill-picker-row')[1]);
    expect(screen.getByTestId('drill-picker-owned')).toHaveTextContent('belongs to another placeholder');
    expect(value()).toBe(before);
  });

  it('offers the way through: promote it, then aim there', async () => {
    const user = userEvent.setup();
    render(<OwnedHarness />);
    await openPicker(user, 'Hair');
    await toRoot(user);
    await user.click(within(picker()).getAllByTestId('drill-picker-row')[1]);
    await user.click(screen.getByRole('button', { name: 'Promote And Use' }));
    expect(owners()).toContain('isWhite:-');
    expect(decodePlaceholderToken(value())?.id).toBe('white');
  });

  it('leaves the placeholder exactly where it was when the refusal is dismissed', async () => {
    const user = userEvent.setup();
    render(<OwnedHarness />);
    await openPicker(user, 'Hair');
    await toRoot(user);
    await user.click(within(picker()).getAllByTestId('drill-picker-row')[1]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('drill-picker-owned')).not.toBeInTheDocument();
    expect(owners()).toContain('isWhite:molly');
  });

  it('drops the refusal when the filter moves the list out from under it', async () => {
    // The panel names one row and its button writes to that row. Leaving it up over a list that no longer
    // shows the row would promote something the author has stopped looking at.
    const user = userEvent.setup();
    render(<OwnedHarness />);
    await openPicker(user, 'Hair');
    await toRoot(user);
    await user.click(within(picker()).getAllByTestId('drill-picker-row')[1]);
    expect(screen.getByTestId('drill-picker-owned')).toBeInTheDocument();
    await user.type(within(picker()).getByLabelText('Filter Placeholders'), 'Eyes');
    expect(screen.queryByTestId('drill-picker-owned')).not.toBeInTheDocument();
    expect(owners()).toContain('isWhite:molly');
  });

  it('still takes a drill step into the owner, which is how an owned row is meant to be reached', async () => {
    const user = userEvent.setup();
    render(<OwnedHarness />);
    await openPicker(user, 'Hair');
    await toRoot(user);
    await user.click(within(picker()).getByRole('button', { name: 'Drill Into Molly' }));
    await user.click(within(picker()).getAllByTestId('drill-picker-row')[0]);
    expect(decodePlaceholderToken(value())?.path).toEqual([{ kind: 'val', ref: 'white' }]);
  });
});

/**
 * The root list is sectioned like every other placeholder surface: an entity's or a book's own rows sit
 * under a heading of quiet text and that owner's icon, and read bare because the heading says whose they
 * are. The whole path is still what the author types to find one.
 */
describe('DrillPicker — owner headings', () => {
  const mood: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['sour']) };
  const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge']) };

  /** A placed Town chip in a world whose entity or book carries Mood, the owner named as authored. */
  function mount(ownerName: string, kind: 'entities' | 'dictionaries' = 'entities') {
    const lists = {
      placeholders: [town], placeholderGroups: [], entities: [], dictionaries: [],
      [kind]: [{ id: 'keeper', name: ownerName, placeholders: [mood] }],
    };
    const all = allPlaceholders(lists);
    const store = { ...placeholderStore(all, () => {}), lists, owners: placeholderOwners(lists) };
    function OwnedHarness() {
      const [text, setText] = useState(chip('town'));
      return (
        <PlaceholderStoreProvider value={store}>
          <Field value={text} onChange={setText} placeholders={all} />
          <div data-testid="value">{text}</div>
        </PlaceholderStoreProvider>
      );
    }
    render(<OwnedHarness />);
  }

  const heading = (name: string) => within(picker()).getByRole('img', { name }).parentElement!;
  /** Open the placed chip's picker and back out to the whole world, which is the sectioned list. */
  async function toRoot(user: ReturnType<typeof userEvent.setup>) {
    await openPicker(user, 'Town');
    await user.click(within(picker()).getByRole('button', { name: 'All Placeholders' }));
  }

  it('heads the owner’s rows with its name and the entity icon, and reads them bare', async () => {
    const user = userEvent.setup();
    mount('Keeper');
    await toRoot(user);
    // The name is what a reader hears; the shape is what an author sees. Both, or a swapped icon passes.
    expect(within(picker()).getByRole('img', { name: 'Entity' })).toHaveClass('lucide-user');
    expect(heading('Entity')).toHaveTextContent('Keeper');
    expect(rowNames()).toEqual(['Town', 'Mood']);
  });

  it('carries the book icon for a dictionary owner', async () => {
    const user = userEvent.setup();
    mount('Fen', 'dictionaries');
    await toRoot(user);
    expect(within(picker()).getByRole('img', { name: 'Dictionary' })).toHaveClass('lucide-book-open');
    expect(heading('Dictionary')).toHaveTextContent('Fen');
  });

  it('wears no chip surface, so a heading never looks like something to pick', async () => {
    const user = userEvent.setup();
    mount('Keeper');
    await toRoot(user);
    const head = heading('Entity');
    expect(head).toHaveClass('text-meta', 'text-muted-foreground');
    expect([...head.classList].filter((c) => c.startsWith('bg-') || c === 'border')).toEqual([]);
  });

  it('draws an owner named with a placeholder as a neutral pill, not the accent the row wears', async () => {
    const user = userEvent.setup();
    mount(`Ma ${chip('town')}`);
    await toRoot(user);
    const pill = heading('Entity').querySelector<HTMLElement>('[data-chip-token]')!;
    expect(pill).toHaveTextContent('Town');
    // Accented, it would read as a row to aim the chip at — which the row below it actually is.
    expect(pill.style.backgroundColor).toBe('');
    const row = within(picker()).getAllByTestId('drill-picker-row').find((b) => b.textContent === 'Town')!;
    expect(row.querySelector<HTMLElement>('span')!.style.backgroundColor).not.toBe('');
  });

  it('finds a bare row by its whole path, however the author spells the separator', async () => {
    const user = userEvent.setup();
    mount('Keeper');
    await toRoot(user);
    const box = within(picker()).getByLabelText('Filter Placeholders');
    for (const query of ['keeper.mood', 'keeper mood', 'keeper>mood', 'keeper › mood']) {
      await user.clear(box);
      await user.type(box, query);
      expect(rowNames(), query).toEqual(['Mood']);
    }
  });

  it('leaves a folder heading as text, which is what tells it from an owner’s', async () => {
    const user = userEvent.setup();
    const lists = {
      placeholders: [town, { ...mood, groupId: 'looks' }],
      placeholderGroups: [{ id: 'looks', name: 'Looks', parentId: null }], entities: [], dictionaries: [],
    };
    const all = allPlaceholders(lists);
    const store = { ...placeholderStore(all, () => {}), lists, owners: placeholderOwners(lists) };
    function Foldered() {
      const [text, setText] = useState(chip('town'));
      return (
        <PlaceholderStoreProvider value={store}>
          <Field value={text} onChange={setText} placeholders={all} />
        </PlaceholderStoreProvider>
      );
    }
    render(<Foldered />);
    await toRoot(user);
    expect(within(picker()).getByText('Looks')).toBeInTheDocument();
    expect(within(picker()).queryByRole('img', { name: 'Entity' })).not.toBeInTheDocument();
  });
});
