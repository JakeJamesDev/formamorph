import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChipInput from './ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

/** The Player Name chip names a reserved value, so its pop-out has nothing to re-aim. */

const WORLD: Placeholder[] = [{ id: 'eye', name: 'Eye', values: phValues(['blue', 'green']) }];

function Harness({ value }: { value: string }) {
  return <ChipInput value={value} onChange={() => {}} vocabulary={usePlaceholderChipVocabulary(WORLD)} ariaLabel="Name" />;
}

const rePick = () => screen.queryByRole('button', { name: /Re-Pick/ });

describe('VariableNode pop-out — Player Name', () => {
  it('offers no Re-Pick on the Player Name chip', async () => {
    const user = userEvent.setup();
    render(<Harness value="Hi {{user}}" />);
    await user.click(screen.getByText('Player Name'));
    expect(screen.getByRole('button', { name: 'Remove Player Name' })).toBeInTheDocument();
    expect(rePick()).toBeNull();
  });

  it('still offers Re-Pick on a placeholder chip', async () => {
    const user = userEvent.setup();
    render(<Harness value={encodePlaceholderToken({ id: 'eye', mode: 'world', placementId: 'p1' })} />);
    await user.click(screen.getByText('Eye'));
    expect(rePick()).toBeInTheDocument();
  });
});
