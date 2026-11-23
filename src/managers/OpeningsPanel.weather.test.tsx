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
    mount(allowedWeatherKinds({ allowed: ['clear', 'rain', 'storm'] }));
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Weather, Opening 1' }));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['World Default', 'Clear', 'Rain', 'Storm']);
  });

  const collapsedWith = async (weatherKinds?: ReturnType<typeof allowedWeatherKinds>) => {
    const stormy = { openings: [{ id: 'a', text: 'Start.', kind: 'action', weather: 'storm' } as Opening] };
    render(<OpeningsList owner={stormy} rows={ownerOpeningRows(stormy)} onChange={() => {}} placeholders={[]} empty={null} weatherKinds={weatherKinds} />);
    const collapse = screen.queryByRole('button', { name: 'Collapse Opening 1' });
    if (collapse) await userEvent.setup().click(collapse);
    expect(screen.getByRole('button', { name: 'Expand Opening 1' })).toBeTruthy();
  };

  it('marks a collapsed card with its Weather icon', async () => {
    await collapsedWith(allowedWeatherKinds({ allowed: ['clear', 'storm'] }));
    expect(screen.getByRole('img', { name: 'Weather, Storm' })).toBeTruthy();
  });

  it('shows no Weather mark while Weather is off', async () => {
    await collapsedWith(undefined);
    expect(screen.queryByRole('img', { name: /^Weather/ })).toBeNull();
  });

  it('is hidden while Weather is off', () => {
    mount(undefined);
    expect(screen.queryByRole('combobox', { name: /^Weather/ })).toBeNull();
    expect(screen.getByRole('combobox', { name: /^Time/ })).toBeTruthy();
  });
});
