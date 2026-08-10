import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TagField from './TagField';

// The chip editor is a Lexical contenteditable whose caret jsdom cannot drive; its own behavior is covered
// by TagChipField.test.tsx. Here it stands in as a plain box carrying the value, which is what the history
// buttons act on.
vi.mock('./TagChipField', () => ({
  default: ({ value, onChange, ariaLabel, placeholder }: {
    value: string; onChange: (v: string) => void; ariaLabel?: string; placeholder?: string;
  }) => (
    <textarea aria-label={ariaLabel} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

/** The field as a caller actually wires it: the value lives outside, which is how its history sees edits. */
const Harness = ({ label, aside }: { label?: string; aside?: boolean }) => {
  const [value, setValue] = useState('');
  return (
    <TagField
      label={label}
      value={value}
      onChange={setValue}
      ariaLabel="Tags"
      aside={aside ? <button type="button">Write with AI</button> : undefined}
    />
  );
};

const field = () => screen.getByLabelText('Tags');
const type = (v: string) => fireEvent.change(field(), { target: { value: v } });

describe('TagField', () => {
  it('carries undo and redo, stepped by tag rather than by keystroke', () => {
    render(<Harness />);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();

    type('1girl');
    type('1girl, dock');
    fireEvent.click(undo);

    // One tag back, not one character: the letters of "dock" folded into the step that added it.
    expect(field()).toHaveValue('1girl');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(field()).toHaveValue('1girl, dock');
  });

  it('names the field for a caller that draws no visible label', () => {
    render(<Harness />);
    expect(screen.queryByText('Image Tags')).toBeNull();
    expect(field()).toBeInTheDocument();
  });

  it('shows the heading and the caller’s own control beside the history buttons', () => {
    render(<Harness label="Image Tags" aside />);
    expect(screen.getByText('Image Tags')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write with AI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });
});
