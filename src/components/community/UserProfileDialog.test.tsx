import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserProfileDialog } from './UserProfileDialog';
import UserService from '@/services/UserService';

vi.mock('@/services/WorldStorageService', () => ({ default: { API_URL: 'https://server.test/api' } }));

const profile = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  username: 'wren_hallow',
  avatarUrl: null,
  createdAt: '2026-03-14T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
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

  it('falls back to the letter circle for somebody with no picture', async () => {
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile());

    render(<UserProfileDialog userId="u1" onOpenChange={() => {}} />);
    await screen.findByText(/Member since/);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('W')).toBeTruthy();
  });
});
