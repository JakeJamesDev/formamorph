import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder, PlaceholderPin } from '@/types';
import { PlaceholderPinRows } from './PlaceholderPinRows';

const garb: Placeholder = { id: 'garb', name: 'Class Garb', values: phValues(['Robe', 'Plate']) };

/** One trait's pin rows whose edits land, so a test reads what the author sees next. */
function Harness({ start, bearerNames }: { start: PlaceholderPin; bearerNames?: string[] }) {
  const [pins, setPins] = useState([start]);
  return (
    <>
      <PlaceholderPinRows
        pins={pins} onChange={setPins} source={{ kind: 'trait', id: 'paladin' }} world={null}
        placeholders={[garb]} bearerNames={bearerNames}
      />
      <output data-testid="stored">{JSON.stringify(pins[0])}</output>
    </>
  );
}
const stored = () => JSON.parse(screen.getByTestId('stored').textContent!) as PlaceholderPin;

describe('PlaceholderPinRows — the pin target', () => {
  it("aims a trait pin at the bearer's own placeholder by name, and back at a placeholder by id", async () => {
    render(<Harness start={{ placeholderId: 'garb', value: 'Plate' }} bearerNames={['Class Garb']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Class Garb' }));
    expect(screen.getByText("Bearer's Own")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('placeholder-name-row'));
    expect(stored()).toEqual({ placeholderId: '', value: 'Plate', valueId: garb.values[1].id, bearerPlaceholder: 'Class Garb' });
    expect(screen.getByRole('button', { name: "Bearer's Class Garb" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: "Bearer's Class Garb" }));
    await userEvent.click(screen.getByTestId('placeholder-section-row'));
    expect(stored()).toEqual({ placeholderId: 'garb', value: 'Plate', valueId: garb.values[1].id });
  });

  it('picks a bearer-relative pin’s own value from the world placeholder’s list', async () => {
    render(<Harness start={{ placeholderId: '', value: '', bearerPlaceholder: 'Class Garb' }} bearerNames={['Class Garb']} />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Pinned Value' }));
    await userEvent.click(screen.getByRole('button', { name: 'Robe' }));
    expect(stored()).toEqual({ placeholderId: '', value: 'Robe', valueId: garb.values[0].id, bearerPlaceholder: 'Class Garb' });
  });

  it('offers no bearer-relative target where the host gives no names', async () => {
    render(<Harness start={{ placeholderId: 'garb', value: '' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Class Garb' }));
    expect(screen.queryByText("Bearer's Own")).toBeNull();
  });
});
