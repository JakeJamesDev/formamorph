import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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

  it('keeps the caret where you type in the middle of the label', async () => {
    const user = userEvent.setup();
    render(<Harness token={encodePlaceholderToken({ id: 'eye', mode: 'unique', placementId: 'p1', label: 'Left' })} />);
    await user.click(screen.getByText('Left'));
    const input = labelInput() as HTMLInputElement;
    await user.click(input);
    input.setSelectionRange(1, 1);
    await user.keyboard('XY');
    expect(labelInput()).toHaveValue('LXYeft');
    expect(decodePlaceholderToken(value())?.label).toBe('LXYeft');
  });

  // A host that commits each edit later than the next keystroke, the way a loaded machine lags one.
  function LaggingHarness({ token, held }: { token: string; held: Array<() => void> }) {
    const [value, setValue] = useState(token);
    return (
      <>
        <ChipInput value={value} onChange={(next) => held.push(() => setValue(next))}
          vocabulary={usePlaceholderChipVocabulary(WORLD)} ariaLabel="Name" />
        <div data-testid="value">{value}</div>
      </>
    );
  }

  it('keeps every keystroke when the field hands an edit back late', async () => {
    const user = userEvent.setup();
    const held: Array<() => void> = [];
    render(<LaggingHarness token={encodePlaceholderToken({ id: 'eye', mode: 'unique', placementId: 'p1' })} held={held} />);
    await user.click(screen.getByText('Eye (Unique)'));
    const input = labelInput()!;
    await user.type(input, 'L');
    const lateEcho = held.splice(0);
    await user.type(input, 'e');
    act(() => lateEcho.forEach((commit) => commit()));
    await user.type(input, 'ft');
    act(() => held.splice(0).forEach((commit) => commit()));
    expect(labelInput()).toBe(input);
    expect(input).toHaveValue('Left');
    expect(decodePlaceholderToken(value())?.label).toBe('Left');
  });
});
