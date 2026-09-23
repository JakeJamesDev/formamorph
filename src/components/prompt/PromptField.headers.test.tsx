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
  it('offers Header on World without a misleading empty-options message and remembers its hidden Format', async () => {
    const user = userEvent.setup();
    const view = render(<Field initial="<WORLD DESCRIPTION>" />);
    await user.click(screen.getByText('World'));
    expect(screen.queryByText('No options for this variable.')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Simple' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Header'), 'world');
    expect(screen.getByText('Format', { exact: true })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Simple' })).toHaveAttribute('data-state', 'on');
    await user.click(screen.getByRole('radio', { name: 'XML' }));
    await user.clear(screen.getByLabelText('Header'));
    expect(screen.queryByRole('radio', { name: 'XML' })).not.toBeInTheDocument();
    const saved = screen.getByTestId('stored').textContent!;
    expect(saved).toBe('<WORLD DESCRIPTION|format=xml>');
    view.unmount();
    render(<Field initial={saved} />);
    await user.click(screen.getByText('World'));
    await user.type(screen.getByLabelText('Header'), 'world');
    expect(screen.getByRole('radio', { name: 'XML' })).toHaveAttribute('data-state', 'on');
    await user.keyboard('{Escape}');
    await user.click(screen.getByText('</world>'));
    expect(screen.getByLabelText('Header')).toHaveValue('world');
  });

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

  it('shows the static header frame in Edit and Preview', async () => {
    const { container } = render(<Field initial={`Before${TOKEN}After`} />);
    await waitFor(() => expect(container.querySelector('[contenteditable]')?.textContent)
      .toBe('Before\n<player_character>\nMeet Persona (Name, XML).\n</player_character>\nAfter'));
    expect(container.querySelectorAll('[data-affix-newline]')).toHaveLength(0);
    await userEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByTestId('prompt-preview').textContent).toBe('Before\n<player_character>\nMeet Mira.\n</player_character>\nAfter');
  });

  it('marks the blank line the frame opens when the chip starts its own line', async () => {
    const { container } = render(<Field initial={`Before\n${TOKEN}\nAfter`} />);
    await waitFor(() => expect(container.querySelectorAll('[data-affix-newline]')).toHaveLength(1));
    await userEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByTestId('prompt-preview').textContent).toBe('Before\n\n<player_character>\nMeet Mira.\n</player_character>\n\nAfter');
  });

  it.each(['Traits', 'Persona', 'Location'])('keeps back-to-back chips self-contained when removing and undoing %s', async removed => {
    const first = '<TRAITS DESCRIPTION|markdown|header="traits">';
    const last = '<LOCATION|markdown|header="place">';
    const { container } = render(<Field initial={`${first}${TOKEN}${last}`} />);
    // Each chip's frame opens a blank line: at the field start or after the previous frame.
    await waitFor(() => expect(container.querySelectorAll('[data-affix-newline]')).toHaveLength(3));
    expect(screen.getByText('<player_character>')).toBeVisible();
    expect(container.querySelector('[contenteditable]')?.textContent).toContain('Meet Persona (Name, XML).');
    expect(container.querySelector('[contenteditable]')?.querySelectorAll('br:not([data-lexical-managed-linebreak])')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: `Remove ${removed}` }));
    const expected = { Traits: `${TOKEN}${last}`, Persona: `${first}${last}`, Location: `${first}${TOKEN}` }[removed];
    expect(screen.getByTestId('stored').textContent).toBe(expected);
    expect(container.querySelectorAll('[data-affix-newline]')).toHaveLength(2);
    fireEvent.mouseDown(screen.getByLabelText('Undo'));
    await waitFor(() => expect(screen.getByTestId('stored').textContent).toBe(`${first}${TOKEN}${last}`));
  });

  it('stores typed line breaks between chips exactly as typed', async () => {
    const template = '<TRAITS DESCRIPTION|markdown|header="traits">\n\n<LOCATION|markdown|header="place">';
    const { container } = render(<Field initial={template} />);
    await waitFor(() => expect(container.querySelector('[contenteditable]')?.querySelectorAll('br:not([data-lexical-managed-linebreak])')).toHaveLength(2));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Location' }));
    expect(screen.getByTestId('stored').textContent).toBe('<TRAITS DESCRIPTION|markdown|header="traits">\n\n');
  });

  it.each(['Prepend', 'Append'])('edits an existing long %s while preserving Header and focus', async label => {
    const user = userEvent.setup();
    const definition = 'An entity is a character, creature, or object. These entries describe entities that may appear in the current location.';
    const option = label === 'Prepend' ? 'pre' : 'post';
    render(<Field initial={`<PERSONA|markdown|${option}="${definition}"|header="entities">`} />);
    await user.click(screen.getByText('## Entities'));
    const input = screen.getByLabelText(label);
    await user.click(input);
    await user.keyboard('{End}!');
    expect(input).toHaveValue(definition + '!');
    await user.keyboard('{Backspace}{Backspace}');
    expect(input).toHaveValue(definition.slice(0, -1));
    expect(input).toHaveFocus();
    expect(screen.getByLabelText('Header')).toHaveValue('entities');
    expect(splitToken(screen.getByTestId('stored').textContent!)).toMatchObject({ [option]: definition.slice(0, -1), header: 'entities' });
    await user.keyboard('{Enter}');
    expect(input).toHaveValue(definition.slice(0, -1) + '↵');
    expect(splitToken(screen.getByTestId('stored').textContent!)).toMatchObject({ [option]: definition.slice(0, -1) + '\n' });
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
