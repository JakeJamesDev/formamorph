import { useMemo, useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { phValues } from '@/test/placeholderValues';
import type { PinEditorWorld } from '@/lib/placeholderPins';
import type { Placeholder, PlaceholderPin } from '@/types';
import { PlaceholderPinRows } from './PlaceholderPinRows';

// The value box is the heaviest part of a row, so its draws stand for the row's: one stub per pin counts them.
const draws = vi.hoisted(() => new Map<string, number>());
vi.mock('./PinValueField', () => ({
  PinValueField: ({ pin, onChange }: { pin: PlaceholderPin; onChange: (next: PlaceholderPin) => void }) => {
    draws.set(pin.placeholderId, (draws.get(pin.placeholderId) ?? 0) + 1);
    return <button type="button" onClick={() => onChange({ ...pin, value: `${pin.value}!` })}>{`Edit ${pin.placeholderId}`}</button>;
  },
}));

const placeholders: Placeholder[] = ['garb', 'boots', 'cloak', 'ring'].map((id) => ({ id, name: id, values: phValues(['One', 'Two']) }));

function Harness({ start }: { start: PlaceholderPin[] }) {
  const [pins, setPins] = useState(start);
  // The pins live in the world, so every edit hands the rows a new world object, as the editors do.
  const world = useMemo<PinEditorWorld>(
    () => ({ placeholders, traits: [{ id: 'paladin', name: 'Paladin', statChanges: [], placeholderPins: pins }] }),
    [pins],
  );
  return (
    <>
      {/* A new source object on every render, as the editors pass it. */}
      <PlaceholderPinRows pins={pins} onChange={setPins} source={{ kind: 'trait', id: 'paladin' }} world={world} placeholders={placeholders} />
      <output data-testid="stored">{JSON.stringify(pins)}</output>
    </>
  );
}

describe('PlaceholderPinRows — what an edit draws', () => {
  beforeEach(() => draws.clear());
  const pins: PlaceholderPin[] = [
    { placeholderId: 'garb', value: 'One' }, { placeholderId: 'boots', value: 'One' }, { placeholderId: 'cloak', value: 'One' },
  ];

  it("draws only the edited pin's row again", async () => {
    render(<Harness start={pins} />);
    expect([...draws.values()]).toEqual([1, 1, 1]);
    await userEvent.click(screen.getByRole('button', { name: 'Edit boots' }));
    expect(JSON.parse(screen.getByTestId('stored').textContent!)[1].value).toBe('One!');
    expect(Object.fromEntries(draws)).toEqual({ garb: 1, boots: 2, cloak: 1 });
  });

  it('draws only the new row when a pin is added', async () => {
    render(<Harness start={pins} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Placeholder Pin' }));
    expect(Object.fromEntries(draws)).toEqual({ garb: 1, boots: 1, cloak: 1, '': 1 });
  });
});
