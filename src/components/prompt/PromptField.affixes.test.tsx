import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { promptVocabulary } from '@/lib/chipVocabulary';

const TOKEN = '<PERSONA|markdown|pre="\n## Player Character\n"|post="\n">';
const TEMPLATE = `Before\n${TOKEN}\nAfter`;

function Field({ readOnly = false, onChange = (_value: string) => {} }) {
  const [value, setValue] = useState(TEMPLATE);
  return <PromptField value={value} readOnly={readOnly} onChange={next => { setValue(next); onChange(next); }}
    vocabulary={promptVocabulary([])} previewValues={{ '<PERSONA|markdown>': 'Mira' }} />;
}

describe('inline conditional text in the prompt editor', () => {
  it('opens the chip from its heading and saves edits inside the token', async () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    const heading = screen.getByText('## Player Character');
    expect(heading.tagName).toBe('MARK');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(heading);
    const prepend = screen.getByLabelText('Prepend');
    expect(prepend).toHaveValue('↵## Player Character↵');
    fireEvent.change(prepend, { target: { value: '↵## Our Traveler↵' } });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(
      'Before\n<PERSONA|markdown|pre="\n## Our Traveler\n"|post="\n">\nAfter',
    ));
    expect(screen.getByText('## Our Traveler')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByText(/## Our Traveler/).textContent).toBe('\n## Our Traveler\nMira\n');
  });

  it('removes the heading and suffix together with the chip', async () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    expect(screen.getByText('## Player Character')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Persona' }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('Before\n\nAfter'));
    expect(screen.queryByText('## Player Character')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps typing in the affix input across token updates', async () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    await userEvent.click(screen.getByText('## Player Character'));
    const prepend = screen.getByLabelText('Prepend');
    await userEvent.clear(prepend);
    await userEvent.type(prepend, 'New heading');
    expect(prepend).toHaveValue('New heading');
    expect(prepend).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith('Before\n<PERSONA|markdown|pre="New heading"|post="\n">\nAfter');
  });

  it('shows read-only affixes through the same disabled options', async () => {
    const onChange = vi.fn();
    render(<Field readOnly onChange={onChange} />);
    await userEvent.click(screen.getByText('## Player Character'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Prepend')).toBeDisabled();
    expect(within(dialog).getByLabelText('Append')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Remove Persona' })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
