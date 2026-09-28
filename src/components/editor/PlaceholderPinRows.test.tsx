import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder, PlaceholderPin } from '@/types';
import { PlaceholderPinRows } from './PlaceholderPinRows';

const garb: Placeholder = { id: 'garb', name: 'Class Garb', values: phValues(['Robe', 'Plate']) };
const boots: Placeholder = { id: 'boots', name: 'Boots', values: phValues(['Sandals']) };

/** One trait's pin rows whose edits land, so a test reads what the author sees next. */
function Harness({ start }: { start: PlaceholderPin }) {
  const [pins, setPins] = useState([start]);
  return (
    <>
      <PlaceholderPinRows
        pins={pins} onChange={setPins} source={{ kind: 'trait', id: 'paladin' }} world={null}
        placeholders={[garb, boots]}
      />
      <output data-testid="stored">{JSON.stringify(pins)}</output>
    </>
  );
}
const stored = () => JSON.parse(screen.getByTestId('stored').textContent!) as PlaceholderPin[];
const sectionRow = (name: string) => screen.getAllByTestId('placeholder-section-row').find((row) => row.textContent === name)!;

describe('PlaceholderPinRows — the pin target', () => {
  it('re-aims a pin at another placeholder by id, keeping the typed value and dropping the old value id', async () => {
    render(<Harness start={{ placeholderId: 'garb', value: 'Plate', valueId: garb.values[1].id }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Class Garb' }));
    await userEvent.click(sectionRow('Boots'));
    expect(stored()).toEqual([{ placeholderId: 'boots', value: 'Plate' }]);
    expect(screen.getByRole('button', { name: 'Boots' })).toBeInTheDocument();
  });

  it("picks a value off the target's list and stores its id", async () => {
    render(<Harness start={{ placeholderId: 'garb', value: '' }} />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Pinned Value' }));
    await userEvent.click(screen.getByRole('button', { name: 'Robe' }));
    expect(stored()).toEqual([{ placeholderId: 'garb', value: 'Robe', valueId: garb.values[0].id }]);
  });

  it('removes a pin', async () => {
    render(<Harness start={{ placeholderId: 'garb', value: 'Plate' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Pin' }));
    expect(stored()).toEqual([]);
  });
});
