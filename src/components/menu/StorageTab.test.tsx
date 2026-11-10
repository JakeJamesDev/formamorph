import { render, screen, cleanup, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoragePanel } from './StorageTab';
import type { StorageDisk, StorageReport } from '@/services/StorageReportService';

const toastErrorMock = vi.fn();
vi.mock('react-toastify', () => ({ toast: { error: (...args: unknown[]) => toastErrorMock(...args) } }));

const GB = 1_000_000_000;
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const part = (gb: number, files = 10, hours = 0.5) => ({ bytes: gb * GB, files, measuredAt: ago(hours) });

const disk = (patch: Partial<StorageDisk> = {}): StorageDisk => ({
  id: 'storage+data+app', paths: ['/srv'], total: 100 * GB, used: 60 * GB, free: 40 * GB, usedFraction: 0.6, alertLevels: [0.8, 0.9],
  ...patch,
});

const report = (patch: Partial<StorageReport> = {}): StorageReport => ({
  disks: [disk()],
  parts: {
    worlds: part(20, 1200),
    thumbnails: part(3, 1190),
    pending: part(0.5, 4),
    avatars: part(1, 300),
    'event-posters': part(0.25, 12),
    'supporter-private': null,
    database: part(8, 2),
    backups: part(12, 14),
    'r2:worlds-bucket': part(7),
  },
  vacuumFits: true,
  r2: null,
  forecast: { 'storage+data+app': { daysUntilFull: 120 } },
  days: [],
  ...patch,
});

const mount = async (value = report()) => {
  const api = { fetchStorageReport: vi.fn(async (_days: number, _signal?: AbortSignal) => value) };
  const view = render(<StoragePanel active api={api} />);
  await screen.findByRole('table', { name: 'What Uses The Disk' });
  return { api, view };
};

const tile = (label: string, scope: HTMLElement = document.body) => within(scope).getAllByText(label)[0].parentElement?.textContent ?? '';

/** The legend's rows as [label, size]. */
const legend = (name = 'Disk Contents') => within(screen.getByRole('list', { name })).getAllByRole('listitem')
  .map((item) => [item.children[1].textContent, item.children[2].textContent]);

beforeEach(() => toastErrorMock.mockClear());
afterEach(cleanup);

describe('the tiles', () => {
  it('show used, free, days until full and vacuum from the report', async () => {
    await mount();

    expect(tile('Used')).toContain('60%');
    expect(tile('Used')).toContain('60.0 GB Of 100.0 GB');
    expect(tile('Free')).toContain('40.0 GB');
    expect(tile('Days Until Full')).toContain('120');
    expect(tile('Vacuum')).toContain('Fits');
  });

  it('say in words when a vacuum does not fit', async () => {
    await mount(report({ vacuumFits: false }));
    expect(tile('Vacuum')).toContain('Does Not Fit');
  });

  it('show the dash when the server has no forecast', async () => {
    await mount(report({ forecast: { 'storage+data+app': { daysUntilFull: null } } }));
    expect(tile('Days Until Full')).toContain('—');
    expect(tile('Days Until Full')).not.toMatch(/\d/);
  });
});

describe('the disk bar', () => {
  it('lists every part on the disk largest first, then the space no part explains', async () => {
    await mount();

    // 60 used minus 44.75 measured.
    expect(legend()).toEqual([
      ['Worlds', '20.0 GB'],
      ['Local Backups', '12.0 GB'],
      ['Database', '8.0 GB'],
      ['Thumbnails', '3.0 GB'],
      ['Other Uploads', '1.8 GB'],
      ['System And App', '15.3 GB'],
    ]);
  });

  it('never draws a negative remainder', async () => {
    await mount(report({ disks: [disk({ used: 30 * GB, free: 70 * GB, usedFraction: 0.3 })] }));
    expect(legend().at(-1)).toEqual(['System And App', '0 B']);
  });

  it('marks each alert level the report gives, none fixed in the client', async () => {
    const { view } = await mount(report({ disks: [disk({ alertLevels: [0.7, 0.85, 0.95] })] }));

    const marks = [...view.container.querySelectorAll('[data-mark]')];
    expect(marks.map((mark) => mark.textContent)).toEqual(['70%', '85%', '95%']);
    expect(marks.map((mark) => (mark as HTMLElement).style.left)).toEqual(['70%', '85%', '95%']);
  });

  it('is hidden from screen readers', async () => {
    const { view } = await mount();
    expect(view.container.querySelector('[data-segment]')?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('gives each of two disks its own bar, tiles and parts', async () => {
    const storage = disk({ id: 'storage', total: 200 * GB, used: 30 * GB, free: 170 * GB, usedFraction: 0.15 });
    const dataApp = disk({ id: 'data+app', total: 50 * GB, used: 25 * GB, free: 25 * GB, usedFraction: 0.5 });
    await mount(report({
      disks: [storage, dataApp],
      forecast: { storage: { daysUntilFull: 400 }, 'data+app': { daysUntilFull: null } },
    }));

    expect(legend('Uploads Disk Contents').map(([label]) => label)).toEqual(['Worlds', 'Thumbnails', 'Other Uploads', 'System And App']);
    expect(legend('Uploads Disk Contents').at(-1)).toEqual(['System And App', '5.3 GB']);
    expect(legend('Database And Backups Disk Contents')).toEqual([
      ['Local Backups', '12.0 GB'], ['Database', '8.0 GB'], ['System And App', '5.0 GB'],
    ]);

    const uploads = screen.getByRole('group', { name: 'Uploads Disk' });
    const data = screen.getByRole('group', { name: 'Database And Backups Disk' });
    expect(tile('Used', uploads)).toContain('15%');
    expect(tile('Days Until Full', uploads)).toContain('400');
    expect(tile('Used', data)).toContain('50%');
    expect(tile('Days Until Full', data)).toContain('—');
    expect(within(uploads).queryByText('Vacuum')).toBeNull();
    expect(within(data).getByText('Vacuum')).toBeTruthy();
  });
});

describe('the parts table', () => {
  const rows = () => within(screen.getByRole('table', { name: 'What Uses The Disk' })).getAllByRole('row').slice(1);
  const row = (name: string) => rows().find((candidate) => within(candidate).getByRole('rowheader').textContent === name)!;
  const cells = (name: string) => within(row(name)).getAllByRole('cell').map((cell) => cell.textContent);

  it('has a row for every part and none for R2', async () => {
    await mount();

    expect(rows().map((candidate) => within(candidate).getByRole('rowheader').textContent)).toEqual([
      'Worlds', 'Local Backups', 'Database', 'Thumbnails', 'Avatars', 'Pending Uploads', 'Event Posters', 'Supporter Content',
    ]);
    expect(cells('Worlds').slice(0, 2)).toEqual(['20.0 GB', '1,200']);
  });

  it('shows the dash in every figure of a part never measured', async () => {
    await mount();
    expect(cells('Supporter Content')).toEqual(['—', '—', '—']);
  });

  it('notes a part not measured for more than 3 hours, and only that one', async () => {
    await mount(report({ parts: { ...report().parts, avatars: part(1, 300, 5.5), pending: part(0.5, 4, 2.9) } }));

    expect(cells('Avatars')[2]).toContain('Not Measured For 5 Hours');
    expect(cells('Pending Uploads')[2]).not.toContain('Not Measured');
    expect(cells('Worlds')[2]).not.toContain('Not Measured');
  });
});

describe('reading', () => {
  it('asks for 30 days', async () => {
    const { api } = await mount();
    expect(api.fetchStorageReport).toHaveBeenCalledWith(30, expect.any(AbortSignal));
  });

  it('shows the reason when the read fails', async () => {
    const api = { fetchStorageReport: vi.fn(async () => { throw new Error('Admin access required'); }) };
    render(<StoragePanel active api={api} />);

    expect((await screen.findByRole('alert')).textContent).toBe('The storage report could not be read: Admin access required');
    expect(toastErrorMock).toHaveBeenCalled();
  });

  it('keeps the last report on screen when a later read fails', async () => {
    const api = { fetchStorageReport: vi.fn(async (_days: number, _signal?: AbortSignal) => report()) };
    const view = render(<StoragePanel active api={api} />);
    await screen.findByRole('table', { name: 'What Uses The Disk' });

    view.rerender(<StoragePanel active={false} api={api} />);
    api.fetchStorageReport.mockRejectedValueOnce(new Error('Server unreachable'));
    view.rerender(<StoragePanel active api={api} />);

    expect((await screen.findByRole('alert')).textContent).toBe('The storage report could not be read: Server unreachable');
    expect(screen.getByRole('table', { name: 'What Uses The Disk' })).toBeTruthy();
  });

  it('reads nothing while another tab is on screen', () => {
    const api = { fetchStorageReport: vi.fn(async () => report()) };
    render(<StoragePanel active={false} api={api} />);

    expect(api.fetchStorageReport).not.toHaveBeenCalled();
  });

  it('cancels the request when the panel closes', () => {
    let signal: AbortSignal | undefined;
    const api = { fetchStorageReport: vi.fn((_days: number, given?: AbortSignal) => { signal = given; return new Promise<StorageReport>(() => {}); }) };
    const view = render(<StoragePanel active api={api} />);
    expect(signal?.aborted).toBe(false);

    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('cancels the request when the tab loses focus', () => {
    let signal: AbortSignal | undefined;
    const api = { fetchStorageReport: vi.fn((_days: number, given?: AbortSignal) => { signal = given; return new Promise<StorageReport>(() => {}); }) };
    const view = render(<StoragePanel active api={api} />);

    view.rerender(<StoragePanel active={false} api={api} />);
    expect(signal?.aborted).toBe(true);
  });
});
