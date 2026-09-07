import 'fake-indexeddb/auto';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityPage } from './CommunityPage';
import { resetAccountPage } from '../test/support';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/services/EventService', () => ({ default: { fetchActive: vi.fn(async () => []), fetchList: vi.fn(async () => []) } }));

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
  resetAccountPage('/community');
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

describe('the rendered website community route', () => {
  it('opens the real shared browser after acceptance and reaches every catalog kind', async () => {
    const user = userEvent.setup();
    render(<CommunityPage />);

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('Sedge Landing')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /entities/i }));
    expect(await screen.findByText('River Warden')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /dictionaries/i }));
    expect(await screen.findByText('Harbor Terms')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
  });
});
