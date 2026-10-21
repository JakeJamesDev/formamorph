import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ScriptPromptLineReference } from './ScriptPromptLineReference';

describe('inline prompt line reference', () => {
  it('opens the production line and reports what the script read', async () => {
    const user = userEvent.setup();
    render(<ScriptPromptLineReference />);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await user.click(await screen.findByRole('button', { name: 'Yes' }));
    expect(await screen.findByText('The script read true')).toBeInTheDocument();
  });

  it('keeps a tell under the turn, and reports Escape as canceled', async () => {
    const user = userEvent.setup();
    render(<ScriptPromptLineReference />);
    await user.click(screen.getByRole('button', { name: 'Tell' }));
    expect(await screen.findByTestId('script-tell')).toHaveTextContent('A bell rings');

    await user.click(screen.getByRole('button', { name: 'Input' }));
    expect(await screen.findByRole('textbox', { name: /What name/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(await screen.findByText('The script stopped as canceled')).toBeInTheDocument();
  });
});
