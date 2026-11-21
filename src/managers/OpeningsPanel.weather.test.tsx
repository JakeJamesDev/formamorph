import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Opening } from '@/types';
import { allowedWeatherKinds } from '@/lib/weather';
import { ownerOpeningRows } from '@/lib/openings';
import { OpeningsList } from './OpeningsPanel';

// The Lexical editor is not under test; the card's own controls ride in its `leading` slot.
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: (props: { leading?: React.ReactNode }) => <div>{props.leading}</div>,
}));

const owner = { openings: [{ id: 'a', text: 'Start.', kind: 'action' } as Opening] };

const mount = (weatherKinds?: ReturnType<typeof allowedWeatherKinds>) => render(
  <OpeningsList owner={owner} rows={ownerOpeningRows(owner)} onChange={() => {}} placeholders={[]} empty={null} weatherKinds={weatherKinds} />,
);

describe("an Opening's Weather picker", () => {
  it('offers World Default, Clear and the allowed kinds, never a kind the world leaves out', async () => {
    mount(allowedWeatherKinds({ on: true, allowed: ['rain', 'storm'] }));
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Weather, Opening 1' }));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['World Default', 'Clear', 'Rain', 'Storm']);
  });

  it('is hidden while Weather is off', () => {
    mount(undefined);
    expect(screen.queryByRole('combobox', { name: /^Weather/ })).toBeNull();
    expect(screen.getByRole('combobox', { name: /^Time/ })).toBeTruthy();
  });
});
