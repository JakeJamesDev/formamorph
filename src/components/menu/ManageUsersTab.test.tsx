import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManageUsersTab } from './ManageUsersTab';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The composer and sent list have their own coverage; stubbing them keeps this file about the table.
vi.mock('./MessageComposerDialog', () => ({ MessageComposerDialog: () => null }));
vi.mock('./SentMessagesDialog', () => ({ SentMessagesDialog: () => null }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'root-admin' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

/**
 * `GET /api/users` shapes each row with `id` — not `_id`. The status-change handler used to match rows
 * on `user._id` alone, which is always undefined here, so activating or suspending someone left the
 * row's buttons showing the old state until a search refetched the table.
 */
const userRow = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  username: 'someone',
  email: null,
  status: 'suspended',
  accountType: 'normal',
  ...over,
});

const stubFetch = (rows: Record<string, unknown>[]) =>
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      return { ok: true, json: async () => ({ success: true }) } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ success: true, data: rows, total: rows.length }),
    } as unknown as Response;
  }));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('status changes update the row in place', () => {
  it('swaps Activate for Suspend without a refetch', async () => {
    stubFetch([userRow({ status: 'suspended' })]);

    render(<ManageUsersTab active />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activate' }));

    // The row must reflect the new status straight away — the bug left Activate on screen.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeTruthy();
  });

  /** Suspending raises the notice prompt, and Radix `aria-hidden`s the table behind it — so the prompt
   *  has to be answered before the row underneath can be queried by role at all. */
  const declineNotice = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  };

  it('swaps Suspend for Activate without a refetch', async () => {
    stubFetch([userRow({ status: 'normal' })]);

    render(<ManageUsersTab active />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    await declineNotice();

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Activate' })).toBeTruthy();
  });

  it('changes only the row acted on', async () => {
    stubFetch([
      userRow({ id: 'u1', username: 'alice', status: 'normal' }),
      userRow({ id: 'u2', username: 'bob', status: 'normal' }),
    ]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');

    // Suspend alice; bob must be untouched.
    fireEvent.click(screen.getAllByRole('button', { name: 'Suspend' })[0]);
    await declineNotice();

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Suspend' })).toHaveLength(1));
    expect(screen.getAllByRole('button', { name: 'Activate' })).toHaveLength(1);
  });

  it('offers a suspension notice for the row that was suspended', async () => {
    stubFetch([userRow({ username: 'alice', status: 'normal' })]);

    render(<ManageUsersTab active />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));

    expect(await screen.findByText(/alice has been suspended/)).toBeTruthy();
  });

  it('does not offer a notice when activating', async () => {
    stubFetch([userRow({ status: 'suspended' })]);

    render(<ManageUsersTab active />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Suspend' })).toBeTruthy());
    expect(screen.queryByText(/has been suspended\?/)).toBeNull();
  });
});

describe('selection', () => {
  it('enables the bulk action only once someone is picked', async () => {
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    const bulk = await screen.findByRole('button', { name: /Message Selected/ });
    expect(bulk.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByLabelText('Select alice'));

    await waitFor(() => expect(screen.getByRole('button', { name: /Message Selected \(1\)/ })).toBeTruthy());
  });
});
