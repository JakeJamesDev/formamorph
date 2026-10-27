// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RenamePage } from './RenamePage';
import { SiteLayout } from '../components/SiteLayout';
import { leaveTo } from '../leaveSite';
import { recordRename } from '../renameNotice';
import { res, resetAccountPage, signIn } from '../test/support';

vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

beforeEach(() => resetAccountPage('/rename'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(leaveTo).mockClear();
});

/** A flagged account held in the session, and the server's fresh read of it. */
const flagged = (suggestion: string | null) => {
  const user = { username: 'Ann Lee', usernameRename: { required: true, suggestion } };
  signIn(user);
  vi.mocked(fetch).mockResolvedValueOnce(res({ user }));
};

const save = async (typed?: string) => {
  const user = userEvent.setup();
  const field = await screen.findByLabelText('New Username');
  if (typed !== undefined) {
    await user.clear(field);
    if (typed) await user.type(field, typed);
  }
  await user.click(screen.getByRole('button', { name: 'Save Username' }));
};

describe('the rename page', () => {
  it('prefills the server suggestion', async () => {
    flagged('Ann_Lee');
    render(<RenamePage />);

    expect(await screen.findByLabelText('New Username')).toHaveValue('Ann_Lee');
    expect(screen.getByText('3–20 letters, numbers, spaces, _ or -')).toBeTruthy();
  });

  it('starts empty when the server has no suggestion', async () => {
    flagged(null);
    render(<RenamePage />);

    expect(await screen.findByLabelText('New Username')).toHaveValue('');
  });

  it('shows the rule error without asking the server', async () => {
    flagged('Ann_Lee');
    render(<RenamePage />);

    await save('no.dots');

    expect(await screen.findByRole('alert')).toHaveTextContent('3–20 letters, numbers, spaces, _ or -');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('says so when the name is taken', async () => {
    flagged('Ann_Lee');
    vi.mocked(fetch).mockResolvedValueOnce(res({ error: 'taken', code: 'USERNAME_TAKEN' }, false, 409));
    render(<RenamePage />);

    await save();

    expect(await screen.findByRole('alert')).toHaveTextContent('That username is taken');
    expect(leaveTo).not.toHaveBeenCalled();
  });

  it('returns to the account page with the new name noted after a rename', async () => {
    flagged('Ann_Lee');
    vi.mocked(fetch).mockResolvedValueOnce(res({ user: { username: 'Ann_Lee', usernameRename: null } }));
    render(<RenamePage />);

    await save();

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/account'));
    const [url, init] = vi.mocked(fetch).mock.calls[1];
    expect(String(url)).toMatch(/\/auth\/username$/);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ username: 'Ann_Lee' });

    // The account page's layout shows the notice the rename left behind.
    render(<SiteLayout title="Your Account"><p>body</p></SiteLayout>);
    expect(screen.getByRole('status')).toHaveTextContent('Username changed to Ann_Lee');
  });

  it('leaves for the account page on Later without renaming', async () => {
    flagged('Ann_Lee');
    render(<RenamePage />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Later' }));

    expect(leaveTo).toHaveBeenCalledWith('/account');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sends an account that owes no rename to the account page', async () => {
    const user = { username: 'alice', usernameRename: null };
    signIn(user);
    vi.mocked(fetch).mockResolvedValueOnce(res({ user }));
    render(<RenamePage />);

    await waitFor(() => expect(window.location.pathname).toBe('/account'));
    expect(screen.queryByLabelText('New Username')).toBeNull();
  });

  it('sends a signed-out visitor to sign in', async () => {
    render(<RenamePage />);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('the rename notice', () => {
  it('shows once and then clears', () => {
    recordRename('Ann_Lee');
    const first = render(<SiteLayout title="Your Account"><p>body</p></SiteLayout>);
    expect(screen.getByRole('status')).toHaveTextContent('Username changed to Ann_Lee');
    first.unmount();

    render(<SiteLayout title="Your Account"><p>body</p></SiteLayout>);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
