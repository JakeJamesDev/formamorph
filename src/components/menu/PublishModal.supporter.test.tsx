import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishModal } from './PublishModal';
import WorldStorageService from '@/services/WorldStorageService';
import PolicyService from '@/services/PolicyService';
import AuthService from '@/services/AuthService';
import { buildPublishBody } from '@/lib/publishBody';
import type { PublishPayload } from '@/lib/publishPayload';
import type { WorldRecord } from '@/components/WorldDetails';
import type { PolicyState } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const mascot: PublishPayload = { kind: 'mascot', name: 'Captain', description: '', contentData: { images: [] } };
const world: PublishPayload = { kind: 'world', name: 'My World', description: 'd', contentData: {} };
const NO_POLICIES: PolicyState = { uploadGate: null, tagNotice: null, privacyPolicy: null };
const listing = (id: string, name: string): WorldRecord => ({ _id: id, name, downloads: 0 });

const signInAs = (accountType: string) =>
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u1', username: 'staff', accountType });

const view = (payload: PublishPayload = mascot, open = true) => (
  <PublishModal open={open} onOpenChange={() => {}} isAuthenticated payload={payload} events={[]} />
);

const theSwitch = () => screen.queryByRole('switch', { name: 'Publish Supporter-only' });
const sent = () => vi.mocked(WorldStorageService.publishItem).mock.calls[0];

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(NO_POLICIES);
  vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([]);
  vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the Supporter-Only switch', () => {
  it('publishes an admin\'s new Mascot Supporter-only once turned on', async () => {
    signInAs('admin');
    render(view());

    await userEvent.click(await screen.findByRole('switch', { name: 'Publish Supporter-only' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publish Supporter-Only' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(sent()[0].supporterOnly).toBe(true);
    expect(sent()[1]).toBeNull();
  });

  it('starts off, and an admin\'s publish without it sends no flag (control)', async () => {
    signInAs('admin');
    render(view());

    expect((await screen.findByRole('switch', { name: 'Publish Supporter-only' })).getAttribute('aria-checked')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(sent()[0].supporterOnly).toBeUndefined();
  });

  it.each(['mod', 'dev', 'normal'])('is absent for a %s account', async (accountType) => {
    signInAs(accountType);
    render(view());

    await screen.findByText('Publish Mascot');
    expect(theSwitch()).toBeNull();
  });

  it('is absent for another kind', async () => {
    signInAs('admin');
    render(view(world));

    await screen.findByText('Publish World');
    expect(theSwitch()).toBeNull();
  });

  it('hides on an update and sends no flag, even after being turned on', async () => {
    signInAs('admin');
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([listing('m1', 'Willow')]);
    vi.spyOn(WorldStorageService, 'fetchListingDetails').mockResolvedValue(null);
    render(view());

    await userEvent.click(await screen.findByRole('switch', { name: 'Publish Supporter-only' }));
    await userEvent.click(await screen.findByLabelText('Willow (m1, 0 downloads)'));
    expect(theSwitch()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(sent()[1]).toBe('m1');
    expect(sent()[0].supporterOnly).toBeUndefined();
  });

  it('turns off again when the dialog reopens', async () => {
    signInAs('admin');
    const { rerender } = render(view());

    await userEvent.click(await screen.findByRole('switch', { name: 'Publish Supporter-only' }));
    rerender(view(mascot, false));
    rerender(view(mascot, true));

    await waitFor(() => expect(theSwitch()?.getAttribute('aria-checked')).toBe('false'));
  });
});

describe('the publish body', () => {
  it('carries the flag only when set', async () => {
    const read = async (payload: PublishPayload) => JSON.parse(await buildPublishBody(payload, null).body.text()) as Record<string, unknown>;

    expect((await read({ ...mascot, supporterOnly: true })).supporterOnly).toBe(true);
    expect('supporterOnly' in (await read(mascot))).toBe(false);
  });
});
