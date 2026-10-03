import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SupportersPage } from './SupportersPage';
import { res, resetAccountPage } from '../test/support';

const row = (id: string, username: string, tier: string, since: string | null = null) =>
  ({ id, username, avatarUrl: null, tier, since });

const wallIs = (rows: unknown[]) =>
  vi.mocked(fetch).mockResolvedValue(res({ success: true, data: rows }));

describe('SupportersPage', () => {
  beforeEach(() => resetAccountPage('/supporters'));
  afterEach(() => vi.unstubAllGlobals());

  it('shows Supporter+ and Supporter as two sections, each name linking to its profile', async () => {
    wallIs([
      row('1', 'Ada', 'supporter_plus', '2025-01-01T00:00:00.000Z'),
      row('2', 'Bo', 'supporter'),
    ]);
    render(<SupportersPage />);

    const plus = await screen.findByRole('region', { name: 'Supporter+' });
    const base = screen.getByRole('region', { name: 'Supporter' });
    expect(within(plus).getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/u/Ada');
    expect(within(base).getByRole('link', { name: 'Bo' })).toHaveAttribute('href', '/u/Bo');
    expect(within(plus).queryByText('Bo')).toBeNull();
  });

  it('keeps the order the server sent inside a section', async () => {
    wallIs([
      row('1', 'Zed', 'supporter_plus'),
      row('2', 'Amy', 'supporter_plus'),
      row('3', 'Mia', 'supporter_plus'),
    ]);
    render(<SupportersPage />);

    const section = await screen.findByRole('region', { name: 'Supporter+' });
    const names = within(section).getAllByRole('link').map((link) => link.textContent);
    expect(names).toEqual(['Zed', 'Amy', 'Mia']);
  });

  it('draws a name in the tier color', async () => {
    wallIs([row('1', 'Ada', 'supporter_plus')]);
    render(<SupportersPage />);

    expect(await screen.findByRole('link', { name: 'Ada' })).toHaveClass('text-supporter-plus');
  });

  it('hides a section with no names', async () => {
    wallIs([row('2', 'Bo', 'supporter')]);
    render(<SupportersPage />);

    await screen.findByRole('region', { name: 'Supporter' });
    expect(screen.queryByRole('region', { name: 'Supporter+' })).toBeNull();
  });

  it('shows a short line and the Become a Supporter link on an empty wall', async () => {
    wallIs([]);
    render(<SupportersPage />);

    expect(await screen.findByText(/No supporters are listed yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Become a Supporter' }))
      .toHaveAttribute('href', expect.stringContaining('patreon.com'));
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('shows the failure when the wall does not load', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ success: false, error: 'Server down' }, false, 500));
    render(<SupportersPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server down');
  });
});
