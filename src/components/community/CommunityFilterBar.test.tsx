import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommunityFilterBar } from './CommunityFilterBar';

/**
 * The filter bar's two jobs: showing everything currently applied, and offering only the facets the reader
 * can actually use. Liked and Mine need an account, and a control that can only ever return nothing is
 * worse than an absent one.
 */

const baseProps = {
  authorFilter: [],
  setAuthorFilter: vi.fn(),
  tagFilter: [],
  setTagFilter: vi.fn(),
  tagMode: 'any' as const,
  setTagMode: vi.fn(),
  statusFilter: [],
  toggleStatus: vi.fn(),
  clearFilters: vi.fn(),
  allAuthors: ['Wren'],
  allTags: ['horror'],
  signedIn: true,
};

/** The Add Filter popover's contents, which only exist once it is opened. */
const openPanel = () => {
  fireEvent.click(screen.getByRole('button', { name: /add filter/i }));
  return screen.getByRole('dialog');
};

describe('CommunityFilterBar', () => {
  it('offers every facet to a signed-in reader', () => {
    render(<CommunityFilterBar {...baseProps} />);
    const panel = openPanel();
    for (const label of ['Liked', 'Downloaded', 'Not Downloaded', 'Has Update', 'Mine']) {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    }
  });

  it('leaves out the account-bound facets when signed out', () => {
    render(<CommunityFilterBar {...baseProps} signedIn={false} />);
    const panel = openPanel();
    expect(within(panel).queryByText('Liked')).not.toBeInTheDocument();
    expect(within(panel).queryByText('Mine')).not.toBeInTheDocument();
    // The rest still stand — signing out narrows the choice, it doesn't remove the feature.
    expect(within(panel).getByText('Has Update')).toBeInTheDocument();
  });

  it('shows what is applied as chips, without the panel being open', () => {
    render(<CommunityFilterBar {...baseProps} statusFilter={['liked']} authorFilter={['Wren']} tagFilter={['horror']} />);
    expect(screen.getByText('Liked')).toBeInTheDocument();
    expect(screen.getByText('by Wren')).toBeInTheDocument();
    expect(screen.getByText('#horror')).toBeInTheDocument();
  });

  it('removes a status filter from its chip', () => {
    const toggleStatus = vi.fn();
    render(<CommunityFilterBar {...baseProps} statusFilter={['liked']} toggleStatus={toggleStatus} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Liked' }));
    expect(toggleStatus).toHaveBeenCalledWith('liked');
  });

  it('names the tag match mode on the row and toggles it there', () => {
    const setTagMode = vi.fn();
    render(<CommunityFilterBar {...baseProps} tagFilter={['horror']} setTagMode={setTagMode} />);
    fireEvent.click(screen.getByRole('button', { name: 'any of' }));
    expect(setTagMode).toHaveBeenCalledWith('all');
  });

  it('offers Clear only once something is applied', () => {
    const { rerender } = render(<CommunityFilterBar {...baseProps} />);
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();

    rerender(<CommunityFilterBar {...baseProps} statusFilter={['liked']} />);
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(baseProps.clearFilters).toHaveBeenCalled();
  });
});
