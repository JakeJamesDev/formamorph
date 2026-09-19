import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AffixInput } from './VariableNode';

const setup = (value: string) => {
  const onChange = vi.fn();
  render(<AffixInput label="Prepend" value={value} disabled={false} onChange={onChange} />);
  return { input: screen.getByLabelText('Prepend') as HTMLInputElement, onChange };
};

describe('the affix field', () => {
  it('shows each newline as a visible mark, so a heading affix reads as three lines', () => {
    const { input } = setup('\n## Player Character\n');
    expect(input.value).toBe('↵## Player Character↵');
  });

  it('keeps the newlines through an edit elsewhere in the field', () => {
    const { input, onChange } = setup('\n## Player Character\n');
    fireEvent.change(input, { target: { value: '↵## The Player Character↵' } });
    expect(onChange).toHaveBeenLastCalledWith('\n## The Player Character\n');
  });

  it('inserts a newline at the caret on Enter', () => {
    const { input, onChange } = setup('## Heading');
    input.setSelectionRange(0, 0);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('\n## Heading');
  });

  it('strips the quote, which delimits the affix in the token', () => {
    const { input, onChange } = setup('');
    fireEvent.change(input, { target: { value: 'say "hi"' } });
    expect(onChange).toHaveBeenLastCalledWith('say hi');
  });
});
