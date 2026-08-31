import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChipInput from './ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder } from '@/types';

/**
 * Re-aiming a placed chip from its own pop-out: the picker opens on the path the chip already carries, and
 * whatever the author settles on moves that chip rather than replacing it. The two kinds of step read
 * differently — a variant names one branch, a slot routes through whichever value rolls — so the picker
 * keeps them apart and marks the slot a roll can miss.
 */

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });

const WORLD: Placeholder[] = [
  { id: 'molly', name: 'Molly', values: [chip('white'), chip('asian')] },
  { id: 'white', name: 'isWhite', roll: false, values: [chip('hair'), chip('eyes')] },
  { id: 'asian', name: 'isAsian', roll: false, values: [chip('hair'), 'dark brown eyes'] },
  { id: 'hair', name: 'Hair', values: ['brown', 'black'] },
  { id: 'eyes', name: 'Eyes', values: ['green'] },
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
    expect(within(picker()).getByText('Object Parts')).toBeInTheDocument();
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
    await user.type(within(picker()).getByLabelText('Filter Parts'), 'asian');
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
    await user.click(within(picker()).getByRole('button', { name: 'Show isWhite Parts' }));
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
    await user.type(within(picker()).getByLabelText('Filter Parts'), 'white');
    await user.click(within(picker()).getByRole('button', { name: 'Show isWhite Parts' }));
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
    await user.type(within(picker()).getByLabelText('Filter Parts'), 'Freckles');
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
