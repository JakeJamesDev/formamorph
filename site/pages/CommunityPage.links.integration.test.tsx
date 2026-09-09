import 'fake-indexeddb/auto';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityPage } from './CommunityPage';
import { resetAccountPage } from '../test/support';

const { leaveTo } = vi.hoisted(() => ({ leaveTo: vi.fn() }));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/services/EventService', () => ({ default: { fetchActive: vi.fn(async () => []), fetchList: vi.fn(async () => []) } }));
vi.mock('../leaveSite', () => ({ leaveTo }));

const catalog = vi.hoisted(() => ({ items: [] as Record<string, unknown>[] }));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(catalog.items);
    return {
      remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds: false, isSyncingCatalog: false,
      catalogSettled: true, loadCatalog: vi.fn(),
    };
  },
}));

const listing = (kind: 'world' | 'entity' | 'dictionary', name: string) => ({
  _id: `${kind}-1`, id: `${kind}-1`, kind, name, description: '', updated_at: '2026-02-01T00:00:00.000Z',
  author: { id: 'author-1', username: 'rowan' }, tags: [],
});

beforeEach(() => {
  catalog.items = [
    listing('world', 'Sedge Landing'),
    listing('entity', 'River Warden'),
    listing('dictionary', 'Harbor Terms'),
  ];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('creation links through the rendered website community route', () => {
  it('holds a direct destination behind the warning, then opens its details in the intended category', async () => {
    const user = userEvent.setup();
    resetAccountPage('/community/entity/entity-1');
    render(<CommunityPage />);

    expect(screen.queryByText('River Warden')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByRole('dialog', { name: 'River Warden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entities/i, hidden: true })).toHaveAttribute('aria-current', 'true');
  });

  it('updates the destination when a visitor opens a card', async () => {
    const user = userEvent.setup();
    resetAccountPage('/community');
    render(<CommunityPage />);
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    await user.click(await screen.findByText('Sedge Landing'));

    expect(window.location.pathname).toBe('/community/world/world-1');
    expect(await screen.findByRole('dialog', { name: 'Sedge Landing' })).toBeInTheDocument();
  });

  it('shows an unavailable state only after catalog resolution', async () => {
    const user = userEvent.setup();
    resetAccountPage('/community/world/removed');
    render(<CommunityPage />);
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This creation is no longer available.');
    expect(screen.queryByRole('dialog', { name: 'Sedge Landing' })).not.toBeInTheDocument();
  });

  it('keeps a guest Like on a direct detail in that category through sign-in', async () => {
    const user = userEvent.setup();
    resetAccountPage('/community/entity/entity-1');
    render(<CommunityPage />);
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    await user.click(await screen.findByRole('button', { name: 'Like — 0 likes' }));

    expect(leaveTo).toHaveBeenCalledWith('/login?next=%2Fcommunity%2Fentity%2Fentity-1');
  });
});
