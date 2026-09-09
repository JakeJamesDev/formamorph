import 'fake-indexeddb/auto';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthService from '@/services/AuthService';
import { AGE_GATE_VERSION } from '@/lib/ageGate';
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
    expect(screen.getByRole('button', { name: 'Download world' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /entities/i }));
    expect(await screen.findByText('River Warden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download entity' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dictionaries/i }));
    expect(await screen.findByText('Harbor Terms')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download dictionary' })).toBeInTheDocument();
  });

  it('sends a guest Like through the rendered card to sign in, without a Like request', async () => {
    const user = userEvent.setup();
    render(<CommunityPage />);

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await user.click(await screen.findByRole('button', { name: 'Like — 0 likes' }));

    expect(leaveTo).toHaveBeenCalledWith('/login?next=%2Fcommunity%2Fworld%2Fworld-1');
  });

  it('restores the returned detail after sign-in without casting the guest\'s Like', async () => {
    const user = userEvent.setup();
    const signedInUser = { id: 'reader-1', username: 'reader' };
    const requests: string[] = [];
    resetAccountPage('/community/world/world-1');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requests.push(url);
      if (url.endsWith('/policies/age-gate')) {
        return { ok: true, json: async () => ({ accepted: true, requiredVersion: AGE_GATE_VERSION }) } as Response;
      }
      if (url.endsWith('/auth/me')) return { ok: true, json: async () => ({ user: signedInUser }) } as Response;
      throw new Error(`Unexpected request: ${url}`);
    }));
    const guest = render(<CommunityPage />);

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(await screen.findByRole('dialog', { name: 'Sedge Landing' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Like — 0 likes' }));
    expect(leaveTo).toHaveBeenCalledWith('/login?next=%2Fcommunity%2Fworld%2Fworld-1');

    guest.unmount();
    resetAccountPage('/community/world/world-1');
    localStorage.setItem(AuthService.tokenKey, 'reader-token');
    localStorage.setItem(AuthService.userKey, JSON.stringify(signedInUser));
    AuthService.token = 'reader-token';
    AuthService.currentUser = signedInUser;
    requests.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requests.push(url);
      if (url.endsWith('/policies/age-gate')) {
        return { ok: true, json: async () => ({ accepted: true, requiredVersion: AGE_GATE_VERSION }) } as Response;
      }
      if (url.endsWith('/auth/me')) return { ok: true, json: async () => ({ user: signedInUser }) } as Response;
      throw new Error(`Unexpected request: ${url}`);
    }));
    render(<CommunityPage />);

    expect(await screen.findByRole('dialog', { name: 'Sedge Landing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Like — 0 likes' })).toBeInTheDocument();
    expect(requests.filter((url) => url.endsWith('/like'))).toEqual([]);
  });

  it('retries a failed Like and never makes a request before a signed-in reader clicks', async () => {
    const user = userEvent.setup();
    const signedInUser = { id: 'reader-1', username: 'reader' };
    const requests: Array<{ url: string; body?: string }> = [];
    let likeCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, body: init?.body as string | undefined });
      if (url.endsWith('/policies/age-gate')) {
        return { ok: true, json: async () => ({ accepted: true, requiredVersion: AGE_GATE_VERSION }) } as Response;
      }
      if (url.endsWith('/auth/me')) return { ok: true, json: async () => ({ user: signedInUser }) } as Response;
      if (url.endsWith('/worlds/world-1/like')) {
        likeCalls += 1;
        if (likeCalls === 1) return { ok: false, json: async () => ({ message: 'Connection lost. Try again.' }) } as Response;
        return { ok: true, json: async () => ({ data: { liked: likeCalls === 2, likes: likeCalls === 2 ? 1 : 0 } }) } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
    localStorage.setItem(AuthService.tokenKey, 'reader-token');
    localStorage.setItem(AuthService.userKey, JSON.stringify(signedInUser));
    AuthService.token = 'reader-token';
    AuthService.currentUser = signedInUser;
    render(<CommunityPage />);

    await screen.findByRole('button', { name: 'Like — 0 likes' });
    expect(requests.filter((request) => request.url.endsWith('/like'))).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Like — 0 likes' }));
    await waitFor(() => expect(likeCalls).toBe(1));
    expect(screen.getByRole('button', { name: 'Like — 0 likes' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Like — 0 likes' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unlike — 1 like' })).toBeInTheDocument());
    expect(requests.filter((request) => request.url.endsWith('/like')).map((request) => request.body))
      .toEqual(['{"liked":true}', '{"liked":true}']);

    await user.click(screen.getByRole('button', { name: 'Unlike — 1 like' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Like — 0 likes' })).toBeInTheDocument());
    expect(requests.filter((request) => request.url.endsWith('/like')).at(-1)?.body).toBe('{"liked":false}');
  });

});
