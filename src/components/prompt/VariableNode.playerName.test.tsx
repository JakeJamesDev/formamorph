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

/** A Built-in chip has nothing to set, so a click opens nothing; the mark tells it from an author's chip. */
describe('VariableNode — Built-in chips', () => {
  const eye = encodePlaceholderToken({ id: 'eye', mode: 'world', placementId: 'p1' });

  it.each(['Player Name', 'Character Name'])('opens no pop-out on %s', async (label) => {
    const user = userEvent.setup();
    render(<Harness value="{{user}} and {{char}}" />);
    await user.click(screen.getByText(label));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('still opens the pop-out on a placeholder chip', async () => {
    const user = userEvent.setup();
    render(<Harness value={eye} />);
    await user.click(screen.getByText('Eye'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('carries the Built-in mark on each Built-in chip and no other', () => {
    render(<Harness value={`{{user}} {{ Char }} ${eye}`} />);
    const marked = [...document.querySelectorAll('[data-builtin-mark]')].map((el) => el.closest('[data-chip]')?.textContent);
    expect(marked).toEqual(['Player Name', 'Character Name']);
  });
});
