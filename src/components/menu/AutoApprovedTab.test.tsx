import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { AutoApprovedTab } from './AutoApprovedTab';
import ReviewService, { type AutoApproval } from '@/services/ReviewService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const entry = (over: Partial<AutoApproval> = {}): AutoApproval => ({
  id: 1,
  targetId: 'w1',
  targetKind: 'world',
  targetName: 'Sedge Landing',
  actor: { id: 'u1', username: 'wren_hallow', role: null },
  createdAt: '2026-10-25T12:00:00.000Z',
  ...over,
});

const stubPage = (entries: AutoApproval[], total = entries.length) =>
  vi.spyOn(ReviewService, 'fetchAutoApproved').mockResolvedValue({ entries, total });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('the auto-approved list', () => {
  it('lists entries in the order the server sent, newest first', async () => {
    stubPage([entry({ id: 2, targetName: 'Zeta' }), entry({ id: 1, targetName: 'Alpha' })]);

    render(<AutoApprovedTab active />);

    const rows = within(await screen.findByRole('list', { name: 'Auto-Approved' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Zeta'),
      expect.stringContaining('Alpha'),
    ]);
  });

  it('shows the kind, the snapshot name, the author and a staff badge', async () => {
    stubPage([entry({ targetKind: 'entity', targetName: 'The Ferryman', actor: { id: 'a', username: 'root-admin', role: 'admin' } })]);

    render(<AutoApprovedTab active />);

    const row = await screen.findByRole('listitem');
    expect(row.textContent).toContain('Entity: The Ferryman');
    expect(row.textContent).toContain('by root-admin');
    expect(row.textContent).toContain('Admin');
  });

  it('opens the listing a row names', async () => {
    const onOpenListing = vi.fn();
    stubPage([entry({ targetId: 'w42' })]);

    render(<AutoApprovedTab active onOpenListing={onOpenListing} />);
    fireEvent.click(await screen.findByRole('button', { name: /Open Listing/ }));

    expect(onOpenListing).toHaveBeenCalledWith('w42');
  });

  it('offers nothing to open on a row without a listing id, or when the caller gave no opener', async () => {
    stubPage([entry({ targetId: null })]);

    render(<AutoApprovedTab active onOpenListing={vi.fn()} />);
    await screen.findByRole('listitem');

    expect(screen.queryByRole('button', { name: /Open Listing/ })).toBeNull();
  });

  it('says so when nothing was auto-approved', async () => {
    stubPage([]);

    render(<AutoApprovedTab active />);

    expect(await screen.findByText('No auto-approvals yet')).toBeTruthy();
  });

  it('asks for nothing while the tab is not the one on screen', () => {
    const fetch = stubPage([entry()]);

    render(<AutoApprovedTab active={false} />);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('pages 20 at a time and asks for the page it shows', async () => {
    const fetch = stubPage([entry()], 45);

    render(<AutoApprovedTab active />);
    await screen.findByText('Page 1 of 3');
    expect(fetch.mock.calls[0][0]).toMatchObject({ page: 1, limit: 20 });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByText('Page 2 of 3');
    expect(fetch.mock.calls[1][0]).toMatchObject({ page: 2, limit: 20 });
  });

  it('draws no pager when one page holds everything', async () => {
    stubPage([entry()], 20);

    render(<AutoApprovedTab active />);
    await screen.findByRole('listitem');

    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('reports a failed read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ReviewService, 'fetchAutoApproved').mockRejectedValue(new Error('Staff only'));

    render(<AutoApprovedTab active />);

    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled());
    // A failure is not an empty list.
    expect(screen.getByText('The auto-approvals didn’t load')).toBeTruthy();
    expect(screen.queryByText('No auto-approvals yet')).toBeNull();
  });

  it('survives an unmount mid-request', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let answer: (page: { entries: AutoApproval[]; total: number }) => void = () => {};
    vi.spyOn(ReviewService, 'fetchAutoApproved').mockReturnValue(new Promise((resolve) => { answer = resolve; }));

    const { unmount } = render(<AutoApprovedTab active />);
    unmount();
    answer({ entries: [entry()], total: 1 });
    await Promise.resolve();

    expect(errors).not.toHaveBeenCalled();
  });
});
