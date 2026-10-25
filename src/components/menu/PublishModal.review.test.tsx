import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { PublishModal } from './PublishModal';
import WorldStorageService from '@/services/WorldStorageService';
import type { PublishPayload } from '@/lib/publishPayload';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const dictPayload: PublishPayload = { kind: 'dictionary', name: 'My Book', description: '', contentData: {} };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([{ _id: 'd1', name: 'Old Book', downloads: 0 }]);
  // A server without changelogs, so an update publishes without the changelog ask.
  vi.spyOn(WorldStorageService, 'fetchListingDetails').mockResolvedValue({ anonymousLikes: false, changelog: null });
});

afterEach(() => vi.restoreAllMocks());

const publishWith = async (answer: Record<string, unknown>, overExisting = false) => {
  vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue(answer);
  render(<PublishModal open onOpenChange={() => {}} isAuthenticated payload={dictPayload} />);

  if (overExisting) await userEvent.click(await screen.findByLabelText('Old Book (d1, 0 downloads)'));
  else await screen.findByText('Old Book (d1, 0 downloads)');
  await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
};

describe('the publish result', () => {
  it('says the listing went to review when the server holds it', async () => {
    await publishWith({ _id: 'd2', moderation_state: 'pending' });

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Dictionary sent for review'));
  });

  it('says the update went to review when the server holds it', async () => {
    await publishWith({ _id: 'd1', moderation_state: 'approved', has_pending_update: true }, true);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Dictionary sent for review'));
  });

  it('keeps today\'s message for a live result', async () => {
    await publishWith({ _id: 'd2', moderation_state: 'approved' });

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Dictionary published successfully!'));
  });
});
