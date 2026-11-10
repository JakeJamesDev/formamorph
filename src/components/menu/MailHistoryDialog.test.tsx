import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MailHistoryDialog } from './MailHistoryDialog';
import type { MailHistory, MailHistoryApi } from '@/services/MailHistoryService';

const marked: MailHistory = {
  emailMarker: 'bounce',
  emailMarkedAt: '2026-11-03T18:44:00.000Z',
  mails: [
    { kind: 'reset', status: 'bounced', bounceType: 'hard', sentAt: '2026-11-03T18:40:00.000Z', statusAt: '2026-11-03T18:44:00.000Z' },
    { kind: 'verify', status: 'bounced', bounceType: 'soft', sentAt: '2026-11-02T10:00:00.000Z', statusAt: '2026-11-02T10:01:00.000Z' },
    { kind: 'alert', status: 'complained', sentAt: '2026-11-01T09:00:00.000Z', statusAt: '2026-11-01T09:05:00.000Z' },
  ],
};
const unmarked: MailHistory = { emailMarker: null, emailMarkedAt: null, mails: [marked.mails[1]] };

const apiFor = (history: MailHistory | Error, clear: () => Promise<boolean> = async () => true) => ({
  fetchMailHistory: vi.fn(async (_id: string, _signal?: AbortSignal) => { if (history instanceof Error) throw history; return history; }),
  clearEmailMarker: vi.fn(async (_id: string, _signal?: AbortSignal) => clear()),
}) satisfies MailHistoryApi;

const mount = (api: MailHistoryApi, mayClear = true) =>
  render(<MailHistoryDialog open onOpenChange={() => {}} userId="u1" username="alice" mayClear={mayClear} api={api} />);

afterEach(cleanup);

describe('the mail list', () => {
  it('lists each mail with a readable kind and result, and the bounce type', async () => {
    mount(apiFor(marked));
    const table = await screen.findByRole('table', { name: 'Mail' });

    expect(table.textContent).toContain('Password Reset');
    expect(table.textContent).toContain('Bounced (hard)');
    expect(table.textContent).toContain('Bounced (soft)');
    expect(table.textContent).toContain('Marked as Spam');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('says so for an account with no mail', async () => {
    mount(apiFor({ emailMarker: null, emailMarkedAt: null, mails: [] }));

    expect(await screen.findByText('This account has no mail on record.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows an error, not an empty list, when the read fails', async () => {
    mount(apiFor(new Error('offline')));

    expect((await screen.findByRole('alert')).textContent).toContain('offline');
    expect(screen.queryByText('This account has no mail on record.')).toBeNull();
  });

  it('labels a bounce without a type as plain Bounced', async () => {
    mount(apiFor({ emailMarker: null, emailMarkedAt: null, mails: [{ kind: 'verify', status: 'bounced', sentAt: '2026-11-02T10:00:00.000Z', statusAt: '2026-11-02T10:01:00.000Z' }] }));
    const table = await screen.findByRole('table', { name: 'Mail' });

    expect(table.textContent).toContain('Bounced');
    expect(table.textContent).not.toContain('Bounced (');
  });
});

describe('the address marker', () => {
  it('shows the reason, the date and Clear Bounce on a marked account', async () => {
    mount(apiFor(marked));

    const section = await screen.findByRole('region', { name: 'Address marker' });
    expect(section.textContent).toContain('Mail to this address bounced');
    expect(section.textContent).toContain('Nov 3, 18:44');
    expect(screen.getByRole('button', { name: 'Clear Bounce' })).toBeTruthy();
  });

  it('shows neither on an unmarked account', async () => {
    mount(apiFor(unmarked));
    await screen.findByRole('table', { name: 'Mail' });

    expect(screen.queryByRole('region', { name: 'Address marker' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear Bounce' })).toBeNull();
  });

  it('drops the section and says the user must verify again after a clear', async () => {
    const api = apiFor(marked);
    mount(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Clear Bounce' }));

    expect((await screen.findByRole('status')).textContent).toContain('alice must verify their address again');
    expect(api.clearEmailMarker).toHaveBeenCalledWith('u1', expect.any(AbortSignal));
    expect(screen.queryByRole('region', { name: 'Address marker' })).toBeNull();
  });

  it('does not claim a clear when the server found no marker', async () => {
    mount(apiFor(marked, async () => false));
    await userEvent.click(await screen.findByRole('button', { name: 'Clear Bounce' }));

    expect((await screen.findByRole('status')).textContent).toBe('The bounce was already cleared.');
    expect(screen.queryByRole('region', { name: 'Address marker' })).toBeNull();
  });

  it('keeps the section and shows the failure when the clear fails', async () => {
    mount(apiFor(marked, async () => { throw new Error('Amazon SES did not take the address off'); }));
    await userEvent.click(await screen.findByRole('button', { name: 'Clear Bounce' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Amazon SES did not take the address off');
    expect(screen.getByRole('region', { name: 'Address marker' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers no Clear Bounce to a viewer who may not act on the account', async () => {
    mount(apiFor(marked), false);
    await screen.findByRole('region', { name: 'Address marker' });

    expect(screen.queryByRole('button', { name: 'Clear Bounce' })).toBeNull();
  });
});

describe('requests', () => {
  it('aborts the read and a running clear when the dialog closes', async () => {
    let clearSignal: AbortSignal | undefined;
    const api = apiFor(marked);
    api.clearEmailMarker.mockImplementation((_id, signal) => { clearSignal = signal; return new Promise<boolean>(() => {}); });
    const view = mount(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Clear Bounce' }));
    const readSignal = api.fetchMailHistory.mock.calls[0][1] as AbortSignal;
    expect(readSignal.aborted).toBe(false);

    view.rerender(<MailHistoryDialog open={false} onOpenChange={() => {}} userId="u1" username="alice" mayClear api={api} />);

    await waitFor(() => expect(clearSignal?.aborted).toBe(true));
    expect(readSignal.aborted).toBe(true);
  });
});
