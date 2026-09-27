import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PromptChipsReference } from './PromptChipsReference';
import { CHIP_PALETTE_ATTR } from '@/components/prompt/ChipInsertTarget';

function palette() {
  const bar = document.querySelector<HTMLElement>(`[${CHIP_PALETTE_ATTR}]`);
  if (!bar) throw new Error('no palette');
  return bar;
}

/** The palette's chips in order, leaving out its collapse toggle. */
const chips = () => within(palette()).getAllByRole('button')
  .filter((button) => button.getAttribute('aria-label') !== 'Placeholders');

describe('prompt chips reference', () => {
  it('lists Player Name and Character Name under Built-in, each with its mark', () => {
    render(<PromptChipsReference />);
    expect(within(palette()).getByText('Built-in')).toBeInTheDocument();
    const [player, character] = chips();
    expect([player.textContent, character.textContent]).toEqual(['Player Name', 'Character Name']);
    for (const chip of [player, character]) expect(chip.querySelector('[data-builtin-mark]')).not.toBeNull();
  });

  it('previews Character Name as the sample owner’s name', async () => {
    render(<PromptChipsReference />);
    let field = screen.getByText('Entity Description');
    while (!within(field).queryByRole('tab', { name: 'Preview' })) field = field.parentElement as HTMLElement;
    await userEvent.setup().click(within(field).getByRole('tab', { name: 'Preview' }));
    expect(within(field).getByTestId('prompt-preview')).toHaveTextContent(/^Oren keeps the lamp lit\.$/);
  });
});
