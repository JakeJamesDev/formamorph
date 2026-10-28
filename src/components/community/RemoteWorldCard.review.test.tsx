import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The thumbnail loader reaches for IndexedDB and the network; neither is what this file is about.
vi.mock('@/lib/useCachedThumbnail', () => ({
  CachedThumbnail: () => <div data-testid="thumb" />,
}));

const world = {
  id: 'w1', name: 'Sedge Landing', description: '', kind: 'world',
  author: { id: 'u1', username: 'wren_hallow' }, tags: [], downloads: 0, comment_count: 0,
  moderation_state: 'pending', moderation_queued_at: '2026-10-01T00:00:00.000Z',
} as unknown as WorldRecord;

const moderator = { id: 'm1', username: 'a-mod', accountType: 'mod' } as unknown as WorldRecord;

const show = (props: Record<string, unknown> = {}) =>
  render(
    <RemoteWorldCard
      world={world}
      downloadState="none"
      downloadProgress={undefined}
      isAuthenticated
      currentUser={moderator}
      onView={() => {}}
      inReviewGroup
      {...props}
    />
  );

const approveButton = () => screen.queryByRole('button', { name: 'Approve Sedge Landing' }) as HTMLButtonElement | null;
const rejectButton = () => screen.queryByRole('button', { name: 'Reject Sedge Landing' }) as HTMLButtonElement | null;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('deciding on the card', () => {
  it('shows no check or X without the callbacks', () => {
    show();

    expect(approveButton()).toBeNull();
    expect(rejectButton()).toBeNull();
  });

  it('approves and rejects through the callbacks, without opening the card', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onView = vi.fn();
    show({ onApprove, onReject, onView });

    fireEvent.click(approveButton()!);
    fireEvent.click(rejectButton()!);

    expect(onApprove).toHaveBeenCalledWith(world);
    expect(onReject).toHaveBeenCalledWith(world);
    expect(onView).not.toHaveBeenCalled();
  });

  it('disables both while a decision is in flight', () => {
    const onApprove = vi.fn();
    show({ onApprove, onReject: vi.fn(), reviewBusy: true });

    expect(approveButton()!.disabled).toBe(true);
    expect(rejectButton()!.disabled).toBe(true);
    fireEvent.click(approveButton()!);
    expect(onApprove).not.toHaveBeenCalled();
  });
});
