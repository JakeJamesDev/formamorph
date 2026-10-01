import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MultiSelect } from '@/components/ui/multi-select';

const OPTIONS = [
  { label: 'Alice', value: 'a' },
  { label: 'Bob', value: 'b' },
  { label: 'Carl', value: 'c' },
];

describe('MultiSelect search', () => {
  it('shows the new matches when one search replaces another without being cleared', () => {
    render(<MultiSelect options={OPTIONS} defaultValue={[]} onValueChange={() => {}} />);
    fireEvent.click(screen.getByRole('combobox'));
    const input = screen.getByPlaceholderText('Search options...');

    fireEvent.change(input, { target: { value: 'ali' } });
    expect(screen.getByRole('option', { name: /^Alice/ })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'b' } });
    expect(screen.getByRole('option', { name: /^Bob/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Alice/ })).toBeNull();
    expect(screen.queryByText('No results found.')).toBeNull();
  });
});
