import { render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PromptChipsReference } from './PromptChipsReference';
import { CHIP_PALETTE_ATTR } from '@/components/prompt/ChipInsertTarget';

function palette() {
  const bar = document.querySelector<HTMLElement>(`[${CHIP_PALETTE_ATTR}]`);
  if (!bar) throw new Error('no palette');
  return bar;
}

describe('prompt chips reference', () => {
  it('lists Player Name and Character Name under Built-in, each with its mark', () => {
    render(<PromptChipsReference />);
    expect(palette()).toHaveTextContent(/^Built-in\s*Player Name\s*Character Name\s*Town$/);
    for (const name of ['Player Name', 'Character Name']) {
      expect(within(palette()).getByRole('button', { name }).querySelector('[data-builtin-mark]')).not.toBeNull();
    }
  });

  it('previews Character Name as the sample owner’s name', async () => {
    render(<PromptChipsReference />);
    // The field has no accessible region; its find-bar identity is its caption.
    const field = document.querySelector<HTMLElement>('[data-find-field="Entity Description"]');
    if (!field) throw new Error('no Entity Description field');
    await userEvent.setup().click(within(field).getByRole('tab', { name: 'Preview' }));
    expect(within(field).getByTestId('prompt-preview')).toHaveTextContent(/^Oren keeps the lamp lit\.$/);
  });
});
