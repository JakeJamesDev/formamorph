import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChipInput from './ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

/**
 * The Label input in a placed chip's pop-out. It writes straight into the token, shows only while the chip
 * is Unique, and a trip through World keeps the text for the way back.
 */

const WORLD: Placeholder[] = [{ id: 'eye', name: 'Eye', values: phValues(['blue', 'green']) }];

function Harness({ token }: { token: string }) {
  const [value, setValue] = useState(token);
  return (
    <>
      <ChipInput value={value} onChange={setValue} vocabulary={usePlaceholderChipVocabulary(WORLD)} ariaLabel="Name" />
      <div data-testid="value">{value}</div>
    </>
  );
}

const value = () => screen.getByTestId('value').textContent ?? '';
const labelInput = () => screen.queryByRole('textbox', { name: 'Label' });

describe('VariableNode pop-out — Label', () => {
  it('is absent on a World chip', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'eye', mode: 'world', placementId: 'p1' })} />);
    await user.click(screen.getByText('Eye'));
    expect(screen.getByRole('radio', { name: 'World' })).toBeInTheDocument();
    expect(labelInput()).toBeNull();
  });

  it('writes the token on a Unique chip and survives Unique → World → Unique', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'eye', mode: 'unique', placementId: 'p1' })} />);
    await user.click(screen.getByText('Eye (Unique)'));
    await user.type(labelInput()!, 'Left: {{a}'); // `{{` is user-event's literal brace
    expect(decodePlaceholderToken(value())).toEqual({ id: 'eye', mode: 'unique', placementId: 'p1', label: 'Left: {a}' });

    await user.click(screen.getByRole('radio', { name: 'World' }));
    expect(labelInput()).toBeNull();
    expect(decodePlaceholderToken(value())?.label).toBe('Left: {a}');

    await user.click(screen.getByRole('radio', { name: 'Unique' }));
    expect(labelInput()).toHaveValue('Left: {a}');
  });
});
