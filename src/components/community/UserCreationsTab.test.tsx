import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserCreationsTab } from './UserCreationsTab';
import UserService from '@/services/UserService';
import type { ProfileCreation } from '@/types';

vi.mock('@/services/WorldStorageService', () => ({ default: { API_URL: 'https://server.test/api' } }));
// The thumbnail cache is IndexedDB-backed; the rows here are about what the list says, not what it draws.
vi.mock('@/lib/useCachedThumbnail', () => ({
  CachedThumbnail: ({ alt }: { alt: string }) => <img alt={alt} src="thumb" />,
}));

const creation = (over: Partial<ProfileCreation> = {}): ProfileCreation => ({
  id: 'w1',
  name: 'Sedge Landing',
  kind: 'world',
  thumbnailFile: null,
  downloads: 0,
  commentCount: 0,
  likes: 0,
  updatedAt: '2026-03-14T00:00:00.000Z',
  createdAt: '2026-03-14T00:00:00.000Z',
  quarantined: false,
  ...over,
});

const listing = (rows: ProfileCreation[]) =>
  vi.spyOn(UserService, 'fetchCreations').mockResolvedValue(rows);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('what somebody has published', () => {
  it('lists their work with its likes, downloads and comments', async () => {
    listing([creation({ likes: 12, downloads: 42, commentCount: 7 })]);

    render(<UserCreationsTab userId="u1" username="wren_hallow" />);

    expect(await screen.findByText('Sedge Landing')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('never offers the heart as a control here', async () => {
    // The profile lists somebody's work; rating it belongs where you can see what you are rating.
    listing([creation({ likes: 12 })]);

    render(<UserCreationsTab userId="u1" username="wren_hallow" />);
    await screen.findByText('Sedge Landing');

    expect(screen.queryByRole('button', { name: /Like —|Unlike/ })).toBeNull();
  });

  it('fetches nothing until it is pointed at somebody', () => {
    const fetchCreations = listing([]);

    render(<UserCreationsTab userId={null} username={null} />);

    expect(fetchCreations).not.toHaveBeenCalled();
  });

  it('re-reads when it is pointed at somebody else', async () => {
    const fetchCreations = listing([]);
    const { rerender } = render(<UserCreationsTab userId="u1" username="wren_hallow" />);
    await waitFor(() => expect(fetchCreations).toHaveBeenCalledWith('u1'));

    rerender(<UserCreationsTab userId="u2" username="ilex" />);

    await waitFor(() => expect(fetchCreations).toHaveBeenCalledWith('u2'));
  });

  it('names the person in the empty line', async () => {
    listing([]);

    render(<UserCreationsTab userId="u1" username="wren_hallow" />);

    expect(await screen.findByText(/wren_hallow hasn’t published anything yet\.|wren_hallow hasn't published anything yet\./)).toBeTruthy();
  });

  it('says so when the list cannot be read', async () => {
    vi.spyOn(UserService, 'fetchCreations').mockRejectedValue(new Error('User not found'));

    render(<UserCreationsTab userId="u1" username="wren_hallow" />);

    expect(await screen.findByText('User not found')).toBeTruthy();
  });
});

describe('the kind filter', () => {
  it('counts every kind, including the ones they never make', async () => {
    listing([
      creation({ id: 'w1', kind: 'world' }),
      creation({ id: 'w2', kind: 'world', name: 'Ash Verge' }),
      creation({ id: 'e1', kind: 'entity', name: 'Wren' }),
    ]);

    render(<UserCreationsTab userId="u1" username="wren_hallow" />);

    expect(await screen.findByRole('radio', { name: 'Worlds (2)' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Entities (1)' })).toBeTruthy();
    // Kept in place rather than dropped, so the filter row doesn't change shape per person.
    expect((screen.getByRole('radio', { name: 'Dictionaries (0)' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows only the chosen kind', async () => {
    listing([
      creation({ id: 'w1', kind: 'world' }),
      creation({ id: 'e1', kind: 'entity', name: 'Wren' }),
    ]);

    render(<UserCreationsTab userId="u1" username="wren_hallow" />);
    await screen.findByText('Sedge Landing');
    expect(screen.queryByText('Wren')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Entities (1)' }));

    expect(screen.getByText('Wren')).toBeTruthy();
    expect(screen.queryByText('Sedge Landing')).toBeNull();
  });

  it('opens on a kind they actually make', async () => {
    // Defaulting to worlds showed an empty list to anyone whose account is all entities.
    listing([creation({ id: 'e1', kind: 'entity', name: 'Wren' })]);

    render(<UserCreationsTab userId="u1" username="wren_hallow" />);

    expect(await screen.findByText('Wren')).toBeTruthy();
  });
});

describe('opening one of them', () => {
  it('hands the listing to whoever can show it', async () => {
    listing([creation({ id: 'w1', kind: 'world' })]);
    const onOpenListing = vi.fn();

    render(<UserCreationsTab userId="u1" username="wren_hallow" onOpenListing={onOpenListing} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Sedge Landing in Community Creations' }));

    expect(onOpenListing).toHaveBeenCalledWith({ id: 'w1', kind: 'world' });
  });

  it('is plain text when nobody can', async () => {
    // A control that opens nothing reads as broken.
    listing([creation()]);

    render(<UserCreationsTab userId="u1" username="wren_hallow" />);
    await screen.findByText('Sedge Landing');

    expect(screen.queryByRole('button', { name: /Open Sedge Landing/ })).toBeNull();
  });
});

describe('a quarantined listing', () => {
  it('is marked hidden for the reader who may still see it', async () => {
    // Only ever its own author or the staff — everybody else isn't sent the row at all.
    listing([creation({ quarantined: true })]);

    render(<UserCreationsTab userId="u1" username="wren_hallow" />);

    expect(await screen.findByText('Hidden')).toBeTruthy();
  });

  it('leaves an ordinary listing unmarked', async () => {
    listing([creation()]);

    render(<UserCreationsTab userId="u1" username="wren_hallow" />);
    await screen.findByText('Sedge Landing');

    expect(screen.queryByText('Hidden')).toBeNull();
  });
});
