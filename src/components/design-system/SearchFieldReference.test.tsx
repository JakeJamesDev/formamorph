import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchFieldReference } from './SearchFieldReference';

const panel = (name: 'Light' | 'Dark') => screen.getByRole('region', { name: `${name} Theme` });

describe('search field reference', () => {
  it.each(['Light', 'Dark'] as const)('filters, clears, and refocuses in the %s theme', async (name) => {
    const user = userEvent.setup();
    render(<SearchFieldReference />);
    const theme = within(panel(name));
    const search = theme.getByRole('searchbox', { name: 'Search Places' });
    const field = within(search.parentElement!);

    expect(panel(name)).toHaveClass(name.toLowerCase());
    expect(field.queryByRole('button', { name: 'Clear Search' })).toBeNull();
    await user.type(search, 'marsh');
    expect(theme.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Salt Marsh Watchtower']);

    await user.click(field.getByRole('button', { name: 'Clear Search' }));

    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(theme.getAllByRole('listitem')).toHaveLength(5);
  });

  it('starts the compact field with text and its X showing', () => {
    render(<SearchFieldReference />);
    const theme = within(panel('Dark'));

    expect(theme.getByRole('searchbox', { name: 'Filter Traits' })).toHaveValue('tide');
    expect(theme.getAllByRole('button', { name: 'Clear Search' })).toHaveLength(1);
  });
});
