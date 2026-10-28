import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishModal } from './PublishModal';
import WorldStorageService from '@/services/WorldStorageService';
import PolicyService from '@/services/PolicyService';
import AuthService from '@/services/AuthService';
import type { PublishPayload } from '@/lib/publishPayload';
import type { WorldRecord } from '@/components/WorldDetails';
import type { PolicyState } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const dictionary: PublishPayload = { kind: 'dictionary', name: 'My Book', description: '', contentData: {} };
const mascot: PublishPayload = { kind: 'mascot', name: 'Willow', description: '', contentData: { images: [] } };
const NO_POLICIES: PolicyState = { uploadGate: null, tagNotice: null, privacyPolicy: null };
const listing = (id: string, name: string): WorldRecord => ({ _id: id, name, downloads: 0 });

const view = (props: { payload?: PublishPayload; linkedListingId?: string; open?: boolean } = {}) => (
  <PublishModal
    open={props.open ?? true}
    onOpenChange={() => {}}
    isAuthenticated
    payload={props.payload ?? dictionary}
    events={[]}
    linkedListingId={props.linkedListingId}
  />
);

const checked = (label: string) => screen.getByLabelText(label).getAttribute('data-state') === 'checked';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(NO_POLICIES);
  vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([listing('d1', 'Old Book'), listing('d2', 'Other Book')]);
  vi.spyOn(WorldStorageService, 'fetchListingDetails').mockResolvedValue(null);
  vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the linked listing', () => {
  it('is preselected when it is one of the user\'s own, and the publish updates it', async () => {
    render(view({ linkedListingId: 'd2' }));

    await screen.findByLabelText('Other Book (d2, 0 downloads)');
    await waitFor(() => expect(checked('Other Book (d2, 0 downloads)')).toBe(true));
    expect(checked('Publish as new dictionary')).toBe(false);
    const submit = screen.getByRole('button', { name: 'Publish' });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(vi.mocked(WorldStorageService.publishItem).mock.calls[0][1]).toBe('d2');
  });

  it('leaves Publish as new selected for someone else\'s listing', async () => {
    render(view({ linkedListingId: 'theirs' }));

    await screen.findByLabelText('Old Book (d1, 0 downloads)');
    expect(checked('Publish as new dictionary')).toBe(true);
  });

  it('leaves Publish as new selected with no link (control)', async () => {
    render(view());

    await screen.findByLabelText('Old Book (d1, 0 downloads)');
    expect(checked('Publish as new dictionary')).toBe(true);
  });

  it('can still be switched to Publish as new by hand', async () => {
    render(view({ linkedListingId: 'd2' }));

    await waitFor(() => expect(checked('Other Book (d2, 0 downloads)')).toBe(true));
    await userEvent.click(screen.getByLabelText('Publish as new dictionary'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(vi.mocked(WorldStorageService.publishItem).mock.calls[0][1]).toBeNull();
  });

  it('hides the admin\'s Supporter-Only switch on a linked Mascot', async () => {
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u1', username: 'staff', accountType: 'admin' });
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([listing('m1', 'Willow')]);
    render(view({ payload: mascot, linkedListingId: 'm1' }));

    await waitFor(() => expect(checked('Willow (m1, 0 downloads)')).toBe(true));
    expect(screen.queryByRole('switch', { name: 'Publish Supporter-only' })).toBeNull();
  });
});
