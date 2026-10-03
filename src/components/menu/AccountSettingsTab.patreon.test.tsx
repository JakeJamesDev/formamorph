import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AccountSettingsTab } from './AccountSettingsTab';
import { PatreonService } from '@/services/PatreonService';
import { openExternal } from '@/lib/openExternal';

vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('@/contexts/AccountDeletionContext', () => ({ useAccountDeletion: () => ({ startDeletion: vi.fn() }) }));
vi.mock('@/services/AuthService', () => ({
  default: {
    getCurrentUser: () => ({ id: 1, username: 'wren_hallow', email: null, emailVerified: false }),
    fetchEmailState: vi.fn().mockResolvedValue(null),
    isValidEmail: () => true,
  },
}));
vi.mock('@/services/PatreonService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/PatreonService')>();
  return {
    ...original,
    PatreonService: { startLink: vi.fn(), getStatus: vi.fn(), confirm: vi.fn(), setShowFlair: vi.fn(), unlink: vi.fn() },
  };
});

const NOT_LINKED = { linked: false } as const;
const SUPPORTER = { linked: true, tier: 'supporter_plus', since: '2025-06-01T00:00:00Z', showFlair: true } as const;

const show = () => render(<AccountSettingsTab suspended={false} onChangePassword={() => {}} />);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(PatreonService.getStatus).mockResolvedValue(NOT_LINKED);
});

describe('the Patreon section in the Settings tab', () => {
  it('shows the section beside the other account controls', async () => {
    show();

    expect(await screen.findByRole('button', { name: 'Link Patreon' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Change Password/ })).toBeTruthy();
  });

  it('opens the approval page outside the app and stays usable', async () => {
    vi.mocked(PatreonService.startLink).mockResolvedValue('https://www.patreon.com/oauth2/authorize?state=x');
    show();

    fireEvent.click(await screen.findByRole('button', { name: 'Link Patreon' }));

    await waitFor(() => expect(openExternal).toHaveBeenCalledWith('https://www.patreon.com/oauth2/authorize?state=x'));
    expect(await screen.findByRole('button', { name: 'Link Patreon' })).toBeEnabled();
  });

  it('reads the status again when the window gets focus', async () => {
    show();
    await screen.findByRole('button', { name: 'Link Patreon' });

    vi.mocked(PatreonService.getStatus).mockResolvedValue(SUPPORTER);
    act(() => { window.dispatchEvent(new Event('focus')); });

    expect(await screen.findByRole('checkbox', { name: 'Show Supporter Flair' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Link Patreon' })).toBeNull();
  });

  it('reads the status again when the page becomes visible', async () => {
    show();
    await screen.findByRole('button', { name: 'Link Patreon' });

    vi.mocked(PatreonService.getStatus).mockResolvedValue(SUPPORTER);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });

    expect(await screen.findByRole('checkbox', { name: 'Show Supporter Flair' })).toBeTruthy();
  });

  it('stops listening and skips a late read after it unmounts', async () => {
    const view = show();
    await screen.findByRole('button', { name: 'Link Patreon' });
    const reads = vi.mocked(PatreonService.getStatus).mock.calls.length;

    view.unmount();
    window.dispatchEvent(new Event('focus'));

    expect(vi.mocked(PatreonService.getStatus).mock.calls.length).toBe(reads);
  });

  it('skips the read while the page is hidden', async () => {
    show();
    await screen.findByRole('button', { name: 'Link Patreon' });
    const reads = vi.mocked(PatreonService.getStatus).mock.calls.length;

    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    hidden.mockRestore();

    expect(vi.mocked(PatreonService.getStatus).mock.calls.length).toBe(reads);
  });

  it('lets the newest of two overlapping reads win', async () => {
    show();
    await screen.findByRole('button', { name: 'Link Patreon' });

    let older!: (status: typeof NOT_LINKED) => void;
    vi.mocked(PatreonService.getStatus)
      .mockImplementationOnce(() => new Promise((resolve) => { older = resolve as typeof older; }))
      .mockResolvedValueOnce(SUPPORTER);
    act(() => { window.dispatchEvent(new Event('focus')); });
    act(() => { window.dispatchEvent(new Event('focus')); });

    expect(await screen.findByRole('checkbox', { name: 'Show Supporter Flair' })).toBeTruthy();
    await act(async () => { older(NOT_LINKED); });
    expect(screen.getByRole('checkbox', { name: 'Show Supporter Flair' })).toBeTruthy();
  });

  it('clears an old error when the status reads again', async () => {
    vi.mocked(PatreonService.startLink).mockRejectedValue(new Error('Could not start the link.'));
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Link Patreon' }));
    expect(await screen.findByRole('alert')).toBeTruthy();

    act(() => { window.dispatchEvent(new Event('focus')); });

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('keeps the last status when a focus read fails', async () => {
    vi.mocked(PatreonService.getStatus).mockResolvedValueOnce(SUPPORTER);
    show();
    await screen.findByRole('checkbox', { name: 'Show Supporter Flair' });

    vi.mocked(PatreonService.getStatus).mockRejectedValue(new Error('offline'));
    act(() => { window.dispatchEvent(new Event('focus')); });

    await waitFor(() => expect(PatreonService.getStatus).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('checkbox', { name: 'Show Supporter Flair' })).toBeTruthy();
  });
});
