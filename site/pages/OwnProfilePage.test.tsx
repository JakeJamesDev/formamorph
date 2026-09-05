import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import AuthService from '@/services/AuthService';
import { OwnProfilePage } from './OwnProfilePage';
import { leaveTo } from '../leaveSite';
import { resetAccountPage } from '../test/support';

// jsdom implements no navigation, so where this page sent the reader is only observable here.
vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

/** A stored session, the way one arrives from either side of the origin. */
const signedInAs = (username: string) => {
  localStorage.setItem('authToken', 'tok');
  localStorage.setItem('currentUser', JSON.stringify({ username }));
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ username });
};

beforeEach(() => resetAccountPage('/profile'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(leaveTo).mockClear();
});

describe('/profile', () => {
  it('opens the signed-in reader’s own page', async () => {
    signedInAs('wren_hallow');
    render(<OwnProfilePage />);

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/u/wren_hallow'));
  });

  it('escapes a name that needs it, so the path stays one segment', async () => {
    signedInAs('wren/hallow');
    render(<OwnProfilePage />);

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/u/wren%2Fhallow'));
  });

  it('sends a signed-out reader to sign in, and back here afterwards', async () => {
    render(<OwnProfilePage />);

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/login?next=%2Fprofile'));
  });
});
