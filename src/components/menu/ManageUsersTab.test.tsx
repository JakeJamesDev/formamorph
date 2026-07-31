import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManageUsersTab } from './ManageUsersTab';
import MessageService from '@/services/MessageService';

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

// The All Messages count is its own fetch; each test that cares stubs the total it wants.
vi.mock('@/services/MessageService', () => ({
  default: { fetchSent: vi.fn(async () => ({ messages: [], total: 0 })) },
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

/** Every `/api/users` URL the component asked for, so a test can assert what it sent. */
let userQueries: string[] = [];

const stubFetch = (rows: Record<string, unknown>[]) =>
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      return { ok: true, json: async () => ({ success: true }) } as unknown as Response;
    }
    if (url.includes('/users')) userQueries.push(url);
    return {
      ok: true,
      json: async () => ({ success: true, data: rows, total: rows.length }),
    } as unknown as Response;
  }));

/** The query string of the most recent user fetch. */
const lastQuery = () => new URLSearchParams(userQueries[userQueries.length - 1].split('?')[1]);

beforeEach(() => {
  userQueries = [];
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

describe('the terms column', () => {
  it('reports each of the three answers from the server field', async () => {
    stubFetch([
      userRow({ id: 'u1', username: 'alice', termsResponse: 'accepted' }),
      userRow({ id: 'u2', username: 'bob', termsResponse: 'declined' }),
      userRow({ id: 'u3', username: 'carol', termsResponse: 'unanswered' }),
    ]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');

    expect(screen.getByText('Accepted')).toBeTruthy();
    expect(screen.getByText('Declined')).toBeTruthy();
    expect(screen.getByText('Not Seen')).toBeTruthy();
  });

  it('offers the reset only to someone who has answered', async () => {
    stubFetch([
      userRow({ id: 'u1', username: 'alice', termsResponse: 'accepted' }),
      userRow({ id: 'u2', username: 'bob', termsResponse: 'declined' }),
      userRow({ id: 'u3', username: 'carol', termsResponse: 'unanswered' }),
    ]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');

    // A refusal is an answer too — resetting it is what takes them back to being asked afresh.
    expect(screen.getByRole('button', { name: 'Reset terms for alice' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Reset terms for bob' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Reset terms for carol' }).hasAttribute('disabled')).toBe(true);
  });

  it('reads a row with no answer field as not seen', async () => {
    // An older server, or any value this build doesn't know, must not render a blank cell.
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);

    expect(await screen.findByText('Not Seen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset terms for alice' }).hasAttribute('disabled')).toBe(true);
  });

  it('disables the reset once it has been used, without a refetch', async () => {
    stubFetch([userRow({ username: 'alice', termsResponse: 'accepted' })]);

    render(<ManageUsersTab active />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reset terms for alice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    // Nothing left to reset, so the button must stop offering it.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reset terms for alice' }).hasAttribute('disabled')).toBe(true));
    expect(screen.getByText('Not Seen')).toBeTruthy();
  });
});

describe('the message split button', () => {
  it('sends straight from the left half', async () => {
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');

    // No flyout in the way: the common action is one click.
    fireEvent.click(screen.getByRole('button', { name: 'Message alice' }));

    expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
  });

  it('keeps history behind the caret', async () => {
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');
    expect(screen.queryByRole('button', { name: /History/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More message options for alice' }));

    expect(await screen.findByRole('button', { name: /^History/ })).toBeTruthy();
  });

  it('says how many messages the history holds', async () => {
    stubFetch([userRow({ username: 'alice', messageCount: 3 })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');
    fireEvent.click(screen.getByRole('button', { name: 'More message options for alice' }));

    expect(await screen.findByRole('button', { name: 'History (3)' })).toBeTruthy();
  });

  it('reads a row with no count as none', async () => {
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');
    fireEvent.click(screen.getByRole('button', { name: 'More message options for alice' }));

    expect(await screen.findByRole('button', { name: 'History (0)' })).toBeTruthy();
  });
});

describe('the All Messages button', () => {
  it('counts every direct message, not just this page worth', async () => {
    // The per-row counts only cover the ten rows on screen; this number is the whole history.
    stubFetch([userRow({ username: 'alice', messageCount: 2 })]);
    vi.mocked(MessageService.fetchSent).mockResolvedValue({ messages: [], total: 41 });

    render(<ManageUsersTab active />);

    expect(await screen.findByRole('button', { name: 'All Messages (41)' })).toBeTruthy();
    expect(vi.mocked(MessageService.fetchSent).mock.calls[0][0]).toMatchObject({ audience: 'direct' });
  });

  it('stays usable when the count cannot be read', async () => {
    stubFetch([userRow({ username: 'alice' })]);
    vi.mocked(MessageService.fetchSent).mockRejectedValue(new Error('offline'));

    render(<ManageUsersTab active />);

    expect(await screen.findByRole('button', { name: 'All Messages (0)' })).toBeTruthy();
  });
});

describe('reloading the table', () => {
  /** Stub `/api/users` with a fetch this test resolves by hand, so the loading state can be inspected. */
  const stubDeferredUsers = (rows: Record<string, unknown>[]) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let served = 0;

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/users')) {
        userQueries.push(url);
        // The first fetch answers at once; the second waits, so the reload can be caught mid-flight.
        if (served++ > 0) await gate;
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: rows, total: rows.length }),
      } as unknown as Response;
    }));

    return { release };
  };

  const rows = () => document.querySelectorAll('tbody tr');
  const body = () => document.querySelector('tbody')!;

  it('keeps the rows on screen while they reload', async () => {
    // Swapping in a skeleton collapsed the table to five short rows and sprang it back.
    const { release } = stubDeferredUsers([
      userRow({ id: 'u1', username: 'alice' }),
      userRow({ id: 'u2', username: 'bob' }),
    ]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');

    fireEvent.click(screen.getByRole('button', { name: /Username/ }));

    await waitFor(() => expect(body().getAttribute('aria-busy')).toBe('true'));
    expect(rows()).toHaveLength(2);
    expect(screen.getByText('alice')).toBeTruthy();

    release();
    await waitFor(() => expect(body().getAttribute('aria-busy')).toBe('false'));
  });

  it('dims the rows and stops them being clicked while reloading', async () => {
    const { release } = stubDeferredUsers([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');
    fireEvent.click(screen.getByRole('button', { name: /Username/ }));

    await waitFor(() => expect(body().className).toContain('opacity-50'));
    // Acting on a row that is about to be replaced would act on the wrong person.
    expect(body().className).toContain('pointer-events-none');

    release();
    await waitFor(() => expect(body().className).not.toContain('opacity-50'));
  });

  it('keeps the pager mounted while the rows reload', async () => {
    // Unmounting it took the whole row out of the layout and put it back — a flash of its own.
    const { release } = stubDeferredUsers(
      Array.from({ length: 25 }, (_, i) => userRow({ id: `u${i}`, username: `user${i}` }))
    );

    render(<ManageUsersTab active />);
    await screen.findByText('user0');
    const pager = screen.getByText(/Page 1 of/);

    fireEvent.click(screen.getByRole('button', { name: /Username/ }));

    await waitFor(() => expect(body().getAttribute('aria-busy')).toBe('true'));
    // The same node, not a replacement mounted after the fact.
    expect(screen.getByText(/Page 1 of/)).toBe(pager);
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();

    release();
    await waitFor(() => expect(body().getAttribute('aria-busy')).toBe('false'));
  });

  it('dims the pager with the rows', async () => {
    const { release } = stubDeferredUsers(
      Array.from({ length: 25 }, (_, i) => userRow({ id: `u${i}`, username: `user${i}` }))
    );

    render(<ManageUsersTab active />);
    await screen.findByText('user0');
    fireEvent.click(screen.getByRole('button', { name: /Username/ }));

    const pager = () => screen.getByText(/Page 1 of/).parentElement!;
    await waitFor(() => expect(pager().className).toContain('opacity-50'));
    expect(pager().className).toContain('pointer-events-none');

    release();
    await waitFor(() => expect(pager().className).not.toContain('opacity-50'));
  });

  it('still shows the skeleton on the very first load', async () => {
    // Nothing is on screen to dim, so the skeleton is all there is to show.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn(async () => {
      await gate;
      return { ok: true, json: async () => ({ success: true, data: [], total: 0 }) } as unknown as Response;
    }));

    render(<ManageUsersTab active />);

    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(body().className).not.toContain('opacity-50');

    release();
    await waitFor(() => expect(screen.getByText('No users found.')).toBeTruthy());
  });
});

describe('sorting', () => {
  it('asks the server rather than reordering the page in hand', async () => {
    // The table is paged: sorting the ten rows on screen would sort ten rows out of however many.
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');

    fireEvent.click(screen.getByRole('button', { name: /Username/ }));

    await waitFor(() => expect(lastQuery().get('sort')).toBe('username'));
    expect(lastQuery().get('order')).toBe('asc');
  });

  it('flips direction when the same column is clicked again', async () => {
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');

    fireEvent.click(screen.getByRole('button', { name: /Username/ }));
    await waitFor(() => expect(lastQuery().get('order')).toBe('asc'));
    fireEvent.click(screen.getByRole('button', { name: /Username/ }));

    await waitFor(() => expect(lastQuery().get('order')).toBe('desc'));
  });

  it('starts a new column ascending rather than inheriting the last direction', async () => {
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');

    fireEvent.click(screen.getByRole('button', { name: /Username/ }));
    fireEvent.click(screen.getByRole('button', { name: /Username/ }));
    await waitFor(() => expect(lastQuery().get('order')).toBe('desc'));

    fireEvent.click(screen.getByRole('button', { name: /Status/ }));

    await waitFor(() => expect(lastQuery().get('sort')).toBe('status'));
    expect(lastQuery().get('order')).toBe('asc');
  });

  it('returns to the first page when the order changes', async () => {
    // Page three of a name sort holds different people than page three of a status sort.
    // Enough rows that the page count exceeds one, so Next is live.
    stubFetch(Array.from({ length: 25 }, (_, i) => userRow({ id: `u${i}`, username: `user${i}` })));

    render(<ManageUsersTab active />);
    await screen.findByText('user0');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastQuery().get('page')).toBe('2'));

    fireEvent.click(screen.getByRole('button', { name: /Username/ }));

    await waitFor(() => expect(lastQuery().get('page')).toBe('1'));
  });

  it('sends no sort at all until a column is picked', async () => {
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');

    // The server's own default is newest-first; naming a column here would override it silently.
    expect(lastQuery().has('sort')).toBe(false);
  });

  it('marks the sorted column for a screen reader', async () => {
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');
    fireEvent.click(screen.getByRole('button', { name: /Username/ }));

    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: /Username/ }).getAttribute('aria-sort')).toBe('ascending'));
    expect(screen.getByRole('columnheader', { name: /Status/ }).getAttribute('aria-sort')).toBe('none');
  });

  it('offers no sort on the actions column', async () => {
    stubFetch([userRow({ username: 'alice' })]);

    render(<ManageUsersTab active />);
    await screen.findByText('alice');

    const actions = screen.getByRole('columnheader', { name: 'Actions' });
    expect(actions.querySelector('button')).toBeNull();
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
