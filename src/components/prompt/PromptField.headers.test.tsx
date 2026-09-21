import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { splitToken } from '@/lib/promptVariables';

const TOKEN = '<PERSONA|name.xml|pre="Meet "|post="."|header="player character">';
const vocab = promptVocabulary([]);

function Field({ initial = TOKEN, readOnly = false }: { initial?: string; readOnly?: boolean }) {
  const [value, setValue] = useState(initial);
  return <>
    <output data-testid="stored">{value}</output>
    <PromptField value={value} onChange={setValue} vocabulary={vocab} readOnly={readOnly}
      previewValues={{ '<PERSONA|name.xml>': 'Mira' }} />
  </>;
}

describe('Header in the shared prompt editor', () => {
  it('selects either generated boundary, retains input focus, and clears only Header', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.click(screen.getByText('<player_character>'));
    expect(screen.getByLabelText('Header')).toHaveValue('player character');
    expect(screen.getByRole('radio', { name: /^XML$/ })).toBeEnabled();
    await user.clear(screen.getByLabelText('Header'));
    await user.type(screen.getByLabelText('Header'), 'NPC "notes"');
    expect(screen.getByLabelText('Header')).toHaveFocus();
    expect(splitToken(screen.getByTestId('stored').textContent!)).toMatchObject({ header: 'NPC "notes"', pre: 'Meet ', post: '.', variantId: 'name.xml' });
    await user.keyboard('{Escape}');
    await user.click(screen.getByText('</npc_notes>'));
    expect(screen.getByLabelText('Header')).toHaveValue('NPC "notes"');
    await user.clear(screen.getByLabelText('Header'));
    expect(screen.getByRole('radio', { name: /^XML$/ })).toBeDisabled();
    expect(screen.getByLabelText('Prepend')).toHaveValue('Meet ');
    expect(screen.getByTestId('stored').textContent).toBe('<PERSONA|name.xml|pre="Meet "|post=".">');
  });

  it('shows contextual spacing in Edit and exactly the same section in Preview', async () => {
    const { container } = render(<Field initial={`Before${TOKEN}After`} />);
    await waitFor(() => expect(container.querySelector('[contenteditable]')?.textContent)
      .toBe('Before\n\n<player_character>\nMeet Persona (Name, XML).\n</player_character>\n\nAfter'));
    await userEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByTestId('prompt-preview').textContent).toBe('Before\n\n<player_character>\nMeet Mira.\n</player_character>\n\nAfter');
  });

  it('protects both generated boundaries and Header in a read-only field', async () => {
    const { container } = render(<Field readOnly />);
    for (const boundary of ['<player_character>', '</player_character>']) {
      await userEvent.click(screen.getByText(boundary));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByLabelText('Header')).toBeDisabled();
      expect(within(dialog).getByLabelText('Prepend')).toBeDisabled();
      await userEvent.keyboard('{Escape}');
    }
    expect(container.querySelector('[data-lexical-editor]')).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByTestId('stored').textContent).toBe(TOKEN);
  });

  it('removes, undoes and redoes the complete headed placement', async () => {
    render(<Field initial={`Before${TOKEN}After`} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Persona' }));
    expect(screen.getByTestId('stored').textContent).toBe('BeforeAfter');
    fireEvent.mouseDown(screen.getByLabelText('Undo'));
    await waitFor(() => expect(screen.getByTestId('stored').textContent).toBe(`Before${TOKEN}After`));
    expect(screen.getByText('</player_character>')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByLabelText('Redo'));
    await waitFor(() => expect(screen.getByTestId('stored').textContent).toBe('BeforeAfter'));
  });

  it('copies raw Header tokens and pastes them as editable placements', async () => {
    const user = userEvent.setup();
    const { container } = render(<Field />);
    await user.click(container.querySelector('[contenteditable="true"]')!);
    await user.keyboard('{Control>}a{/Control}');
    const clipboard = await user.cut();
    expect(clipboard?.getData('text/plain')).toBe(TOKEN);
    await waitFor(() => expect(screen.getByTestId('stored').textContent).toBe(''));
    await user.paste(clipboard!);
    expect(screen.getByTestId('stored').textContent).toBe(TOKEN);
    expect(screen.getByText('</player_character>')).toBeInTheDocument();
  });
});
