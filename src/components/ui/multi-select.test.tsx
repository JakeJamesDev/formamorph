import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('clears the search with the Clear Search X and shows every option again', async () => {
    const user = userEvent.setup();
    render(<MultiSelect options={OPTIONS} defaultValue={[]} onValueChange={() => {}} />);
    await user.click(screen.getByRole('combobox'));
    const input = screen.getByPlaceholderText('Search options...');
    expect(screen.queryByRole('button', { name: 'Clear Search' })).toBeNull();

    await user.type(input, 'ali');
    expect(screen.queryByRole('option', { name: /^Bob/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    for (const name of [/^Alice/, /^Bob/, /^Carl/]) expect(screen.getByRole('option', { name })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear Search' })).toBeNull();
  });

  it('selects the highlighted option on Enter while the Clear Search X shows', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<MultiSelect options={OPTIONS} defaultValue={[]} onValueChange={onValueChange} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Search options...'), 'carl');
    expect(screen.getByRole('button', { name: 'Clear Search' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenLastCalledWith(['c']);
  });
});
