import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MailPanel } from './MailTab';
import type { MailReport } from '@/services/MailReportService';

const toastErrorMock = vi.fn();
vi.mock('react-toastify', () => ({ toast: { error: (...args: unknown[]) => toastErrorMock(...args) } }));

const report = (patch: Partial<MailReport> = {}): MailReport => ({
  days: [
    { day: '2026-01-02', sent: 40, delivered: 35, delayed: 1, hardBounced: 2, softBounced: 1, complained: 1 },
    { day: '2026-01-01', sent: 60, delivered: 57, delayed: 0, hardBounced: 1, softBounced: 2, complained: 0 },
  ],
  rates: {
    windowDays: 7, minVolume: 200, volume: 300, measured: true,
    bounce: { count: 3, rate: 0.01, limits: { alert: 0.025, review: 0.05, pause: 0.1 } },
    complaint: { count: 1, rate: 0.0033, limits: { alert: 0.0005, review: 0.001, pause: 0.005 } },
  },
  ses: { enforcementStatus: 'HEALTHY', sendingEnabled: true, checkedAt: '2026-01-02T10:00:00.000Z' },
  last24Hours: { sent: 83, quota: 50_000 },
  ...patch,
});

const mount = async (value = report(), props: { active?: boolean } = {}) => {
  const api = { fetchMailReport: vi.fn(async (_days: number, _signal?: AbortSignal) => value) };
  const view = render(<MailPanel active={props.active ?? true} api={api} />);
  await screen.findByRole('table', { name: 'Per Day' });
  return { api, view };
};

const tile = (label: string) => screen.getAllByText(label)[0].parentElement?.textContent ?? '';

beforeEach(() => toastErrorMock.mockClear());
afterEach(cleanup);

describe('the figures', () => {
  it('sums the shown days, counting hard bounces only', async () => {
    await mount();

    expect(tile('Sent')).toContain('100');
    expect(tile('Delivered')).toContain('92');
    expect(tile('Bounced')).toContain('3');
    expect(tile('Bounced')).toContain('3 Soft');
    expect(tile('Complaints')).toContain('1');
  });

  it('lists each day as the server returned it', async () => {
    await mount();

    const rows = within(screen.getByRole('table', { name: 'Per Day' })).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
      ['40', '35', '1', '2', '1', '1'],
      ['60', '57', '0', '1', '2', '0'],
    ]);
    expect(within(screen.getByRole('table', { name: 'Per Day' })).getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(['2026-01-02', '2026-01-01']);
  });

  it('puts Amazon\'s limits beside each 7-day rate', async () => {
    await mount();

    expect(tile('Bounce Rate (7 Days)')).toContain('1%');
    expect(tile('Bounce Rate (7 Days)')).toContain('Amazon Reviews At 5%');
    expect(tile('Complaint Rate (7 Days)')).toContain('0.33%');
    expect(tile('Complaint Rate (7 Days)')).toContain('Amazon Reviews At 0.1%');
  });

  it('reads as not yet measured under the volume floor', async () => {
    const value = report();
    await mount({ ...value, rates: { ...value.rates, volume: 120, measured: false, bounce: { ...value.rates.bounce, rate: 0.5 } } });

    expect(tile('Bounce Rate (7 Days)')).toContain('Not Yet Measured');
    expect(tile('Bounce Rate (7 Days)')).toContain('Amazon Reviews At 5%');
    expect(tile('Bounce Rate (7 Days)')).toContain('120 Of 200 Mails Needed');
    expect(tile('Bounce Rate (7 Days)')).not.toContain('50%');
  });

  it('shows the quota over the last 24 hours, never today', async () => {
    await mount();

    expect(tile('Quota Used')).toContain('83 Of 50,000');
    expect(tile('Quota Used')).toContain('Last 24 Hours');
    expect(document.body.textContent).not.toMatch(/today/i);
  });
});

describe('the SES status', () => {
  it('says healthy in words', async () => {
    await mount();
    expect(tile('SES Status')).toContain('Healthy');
    expect(tile('SES Status')).not.toContain('Needs Attention');
  });

  it('says a review in words, not by color', async () => {
    await mount(report({ ses: { enforcementStatus: 'PROBATION', sendingEnabled: true, checkedAt: '2026-01-02T10:00:00.000Z' } }));
    expect(tile('SES Status')).toContain('Under Review');
    expect(tile('SES Status')).toContain('Needs Attention');
  });

  it('says a pause and sending turned off in words', async () => {
    await mount(report({ ses: { enforcementStatus: 'SHUTDOWN', sendingEnabled: false, checkedAt: '2026-01-02T10:00:00.000Z' } }));
    expect(tile('SES Status')).toContain('Paused');
    expect(tile('SES Status')).toContain('Sending Off');
  });

  it('says sending off on an otherwise healthy account', async () => {
    await mount(report({ ses: { enforcementStatus: 'HEALTHY', sendingEnabled: false, checkedAt: '2026-01-02T10:00:00.000Z' } }));
    expect(tile('SES Status')).toContain('Sending Off');
    expect(tile('SES Status')).toContain('Needs Attention');
  });

  it('says not read yet before the first health run', async () => {
    await mount(report({ ses: null, last24Hours: null }));
    expect(tile('SES Status')).toContain('Not Read Yet');
    expect(tile('Quota Used')).toContain('—');
  });
});

describe('reading', () => {
  it('asks for the range the reader picks', async () => {
    const user = userEvent.setup();
    const { api } = await mount();
    expect(api.fetchMailReport.mock.calls[0][0]).toBe(14);

    await user.click(screen.getByRole('radio', { name: '30 Days' }));
    await waitFor(() => expect(api.fetchMailReport).toHaveBeenLastCalledWith(30, expect.any(AbortSignal)));
  });

  it('shows the reason when the read fails', async () => {
    const api = { fetchMailReport: vi.fn(async () => { throw new Error('Admin access required'); }) };
    render(<MailPanel active api={api} />);

    expect((await screen.findByRole('alert')).textContent).toBe('The mail report could not be read: Admin access required');
    expect(toastErrorMock).toHaveBeenCalled();
  });

  it('reads nothing while another tab is on screen', async () => {
    const api = { fetchMailReport: vi.fn(async () => report()) };
    render(<MailPanel active={false} api={api} />);

    expect(api.fetchMailReport).not.toHaveBeenCalled();
  });

  it('cancels the request when the panel closes', async () => {
    let signal: AbortSignal | undefined;
    const api = { fetchMailReport: vi.fn((_days: number, given?: AbortSignal) => { signal = given; return new Promise<MailReport>(() => {}); }) };
    const view = render(<MailPanel active api={api} />);
    expect(signal?.aborted).toBe(false);

    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('cancels the request when the tab loses focus', async () => {
    let signal: AbortSignal | undefined;
    const api = { fetchMailReport: vi.fn((_days: number, given?: AbortSignal) => { signal = given; return new Promise<MailReport>(() => {}); }) };
    const view = render(<MailPanel active api={api} />);

    view.rerender(<MailPanel active={false} api={api} />);
    expect(signal?.aborted).toBe(true);
  });
});
