import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserProfileDialog } from './UserProfileDialog';
import UserService from '@/services/UserService';
import AuthService from '@/services/AuthService';

vi.mock('@/services/WorldStorageService', () => ({ default: { API_URL: 'https://server.test/api' } }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

/** Sign in as somebody, so the follow control has a reader to be offered to. */
const signedInAs = (id: string | null) =>
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(id ? { id, username: 'reader' } : null);

const profile = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  username: 'wren_hallow',
  avatarUrl: null,
  createdAt: '2026-03-14T00:00:00.000Z',
  followers: 0,
  likes: 0,
  downloads: 0,
  ...over,
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // The Creations tab fetches as soon as the dialog opens; these cases are about the header above it.
  vi.spyOn(UserService, 'fetchCreations').mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('opening somebody’s profile', () => {
  it('shows their name, picture and signup date', async () => {
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ avatarUrl: '/api/avatars/abc.webp' }));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);

    expect(await screen.findByText(/Member since/)).toBeTruthy();
    expect(screen.getAllByText('wren_hallow').length).toBeGreaterThan(0);
    expect((screen.getByRole('img') as HTMLImageElement).src).toBe('https://server.test/api/avatars/abc.webp');
  });

  it('opens with the name that was clicked, before the fetch lands', () => {
    // Otherwise the dialog appears blank for as long as the round trip takes.
    vi.spyOn(UserService, 'fetchProfile').mockImplementation(() => new Promise(() => {}));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} fallbackUsername="wren_hallow" />);

    expect(screen.getAllByText('wren_hallow').length).toBeGreaterThan(0);
  });

  it('fetches nothing until it is opened', () => {
    const fetchProfile = vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile());

    render(<UserProfileDialog userId={null} onOpenChange={() => {}} />);

    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it('re-reads when it is pointed at somebody else', async () => {
    const fetchProfile = vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile());
    const { rerender } = render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);
    await waitFor(() => expect(fetchProfile).toHaveBeenCalledWith('u1'));

    rerender(<UserProfileDialog userId="u2" onOpenChange={() => {}} />);

    await waitFor(() => expect(fetchProfile).toHaveBeenCalledWith('u2'));
  });

  it('says so when the account cannot be read', async () => {
    vi.spyOn(UserService, 'fetchProfile').mockRejectedValue(new Error('User not found'));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} fallbackUsername="wren_hallow" />);

    expect(await screen.findByText('User not found')).toBeTruthy();
  });

  it('wears their staff badge, so it agrees with the name that was clicked', async () => {
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ role: 'admin' }));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);

    expect(await screen.findByText('Admin')).toBeTruthy();
  });

  it('wears none for an ordinary account', async () => {
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ role: null }));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);
    await screen.findByText(/Member since/);

    expect(screen.queryByText(/^(Mod|Dev|Admin)$/)).toBeNull();
  });

  it('falls back to the letter circle for somebody with no picture', async () => {
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile());

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);
    await screen.findByText(/Member since/);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('W')).toBeTruthy();
  });
});

describe('what their work has earned', () => {
  it('says the likes and downloads their listings have between them', async () => {
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ likes: 41, downloads: 108 }));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);

    expect(await screen.findByTitle('41 likes')).toBeTruthy();
    expect(screen.getByTitle('108 downloads')).toBeTruthy();
  });

  it('counts one of each in the singular', async () => {
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ likes: 1, downloads: 1 }));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);

    expect(await screen.findByTitle('1 like')).toBeTruthy();
    expect(screen.getByTitle('1 download')).toBeTruthy();
  });

  it('shows zeros rather than vanishing for somebody who has published nothing', async () => {
    // The row always renders, so the dialog keeps its shape whoever is in it.
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile());

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);

    expect(await screen.findByTitle('0 likes')).toBeTruthy();
    expect(screen.getByTitle('0 downloads')).toBeTruthy();
  });

  it('says nothing at all when the account could not be read', async () => {
    // Zeros beside an error would read as a real answer about somebody the server never found.
    vi.spyOn(UserService, 'fetchProfile').mockRejectedValue(new Error('User not found'));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);
    await screen.findByText('User not found');

    expect(screen.queryByTitle(/likes|downloads/)).toBeNull();
  });
});

describe('the follow button', () => {
  it('says how many follow them', async () => {
    signedInAs('me');
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ followers: 12 }));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);

    expect(await screen.findByTitle('12 followers')).toBeTruthy();
  });

  it('counts one follower in the singular', async () => {
    signedInAs('me');
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ followers: 1 }));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);

    expect(await screen.findByTitle('1 follower')).toBeTruthy();
  });

  it('is offered to a signed-in reader', async () => {
    signedInAs('me');
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ following: false }));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);

    expect(await screen.findByRole('button', { name: 'Follow' })).toBeTruthy();
  });

  it('reads as Following once they do', async () => {
    signedInAs('me');
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ following: true }));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);

    expect(await screen.findByRole('button', { name: 'Following' })).toBeTruthy();
  });

  it('is absent for a signed-out visitor', async () => {
    // They can read the count; there is nothing for them to press.
    signedInAs(null);
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile());

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);
    await screen.findByText(/Member since/);

    expect(screen.queryByRole('button', { name: /Follow/ })).toBeNull();
  });

  it('is absent on your own profile', async () => {
    // Following yourself would put your own work in your own news, and the server refuses it.
    signedInAs('u1');
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ id: 'u1' }));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);
    await screen.findByText(/Member since/);

    expect(screen.queryByRole('button', { name: /Follow/ })).toBeNull();
  });

  it('moves the count with the button, from the server’s own answer', async () => {
    // Counting locally would drift the moment two readers followed at once.
    signedInAs('me');
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ followers: 4, following: false }));
    const setFollowing = vi.spyOn(UserService, 'setFollowing').mockResolvedValue({ following: true, followers: 5 });

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Following' })).toBeTruthy());
    expect(screen.getByTitle('5 followers')).toBeTruthy();
    expect(setFollowing).toHaveBeenCalledWith('u1', true);
  });

  it('leaves the button alone when the server refuses', async () => {
    signedInAs('me');
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ followers: 4, following: false }));
    vi.spyOn(UserService, 'setFollowing').mockRejectedValue(new Error('Your account has been suspended'));

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' })).toBeTruthy());
    expect(screen.getByTitle('4 followers')).toBeTruthy();
  });
});
