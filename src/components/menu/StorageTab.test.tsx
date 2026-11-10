import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoragePanel } from './StorageTab';
import type { StorageDisk, StorageReport, StorageReportDay } from '@/services/StorageReportService';

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

const bucket = (gb: number, objects = 100, hours = 0.5) => ({ bytes: gb * GB, objects, checkedAt: ago(hours) });
const r2 = (buckets: NonNullable<StorageReport['r2']>['buckets'], freeTierBytes = 10 * GB) => ({ freeTierBytes, buckets });

describe('the R2 section', () => {
  const section = () => screen.getByRole('group', { name: 'R2' });
  const segments = () => [...section().querySelectorAll<HTMLElement>('[data-segment]')];
  const bucketCells = (name: string) => {
    const table = within(section()).getByRole('table', { name: 'R2 Buckets' });
    const row = within(table).getAllByRole('row').find((candidate) => within(candidate).queryByRole('rowheader')?.textContent === name)!;
    return within(row).getAllByRole('cell').map((cell) => cell.textContent);
  };

  it('scales the bar to the free tier, one segment per bucket in the report order', async () => {
    await mount(report({ r2: r2({ 'files-bucket': bucket(4), 'backup-bucket': bucket(3) }) }));

    expect(segments().map((segment) => [segment.dataset.segment, segment.style.width])).toEqual([['files-bucket', '40%'], ['backup-bucket', '30%']]);
    expect(within(section()).getByText('R2 holds 7.0 GB of the 10.0 GB free tier')).toBeTruthy();
  });

  it('colors buckets by their place in the report, not by name', async () => {
    await mount(report({ r2: r2({ zeta: bucket(4), alpha: bucket(3) }) }));
    const table = within(section()).getByRole('table', { name: 'R2 Buckets' });
    const swatches = [...table.querySelectorAll<HTMLElement>('tbody [aria-hidden="true"]')];

    expect(swatches.map((swatch) => swatch.getAttribute('style'))).toEqual([
      expect.stringContaining('--chart-2'), expect.stringContaining('--chart-3'),
    ]);
  });

  it('gives each bucket its size, objects and checked time, and notes one checked over 3 hours ago', async () => {
    await mount(report({ r2: r2({ 'files-bucket': bucket(4, 36_812, 5.5), 'backup-bucket': bucket(3, 420, 2.9) }) }));

    expect(bucketCells('files-bucket').slice(0, 2)).toEqual(['4.0 GB', '36,812']);
    expect(bucketCells('files-bucket')[2]).toContain('Not Checked For 5 Hours');
    expect(bucketCells('backup-bucket')[2]).not.toContain('Not Checked');
  });

  it('shows the dash for a bucket never checked, and draws no segment for it', async () => {
    await mount(report({ r2: r2({ 'files-bucket': bucket(4), 'backup-bucket': null }) }));

    expect(bucketCells('backup-bucket')).toEqual(['—', '—', '—']);
    expect(segments().map((segment) => segment.dataset.segment)).toEqual(['files-bucket']);
  });

  it('gives the total as a floor while a bucket was never checked', async () => {
    await mount(report({ r2: r2({ 'files-bucket': bucket(10.5), 'backup-bucket': null }) }));
    expect(within(section()).getByText('R2 holds at least 10.5 GB, at least 500.0 MB over the 10.0 GB free tier')).toBeTruthy();
  });

  it('fills the bar and states the amount over the free tier', async () => {
    await mount(report({ r2: r2({ 'files-bucket': bucket(8), 'backup-bucket': bucket(3.5) }) }));

    expect(within(section()).getByText('R2 holds 11.5 GB, 1.5 GB over the 10.0 GB free tier')).toBeTruthy();
    const filled = segments().reduce((sum, segment) => sum + parseFloat(segment.style.width), 0);
    expect(filled).toBeCloseTo(100);
  });

  it('shows one line and no bar when the server has no R2 access', async () => {
    await mount(report({ r2: null }));

    expect(within(section()).getByText('The server has no R2 access')).toBeTruthy();
    expect(segments()).toEqual([]);
    expect(within(section()).queryByRole('table')).toBeNull();
  });
});

const dayOf = (day: string, values: StorageReportDay['values'], downloads = 0): StorageReportDay => ({ day, values, downloads });
const used = (id: string, gb: number | null) => ({ [`disk:${id}:used`]: gb === null ? null : { bytes: gb * GB, files: 0 } });
const stored = (name: string, gb: number | null) => ({ [`r2:${name}`]: gb === null ? null : { bytes: gb * GB, files: 0 } });

/** Newest first, as the server sends them. */
const history: StorageReportDay[] = [
  dayOf('2026-11-10', { ...used('storage+data+app', 60), ...stored('files-bucket', 4), ...stored('backup-bucket', 3) }, 12),
  dayOf('2026-11-09', { ...used('storage+data+app', null), ...stored('files-bucket', 4), ...stored('backup-bucket', null) }, 0),
  dayOf('2026-11-08', { ...used('storage+data+app', 50), ...stored('files-bucket', 3), ...stored('backup-bucket', 2) }, 40),
];
const withHistory = (patch: Partial<StorageReport> = {}) =>
  report({ r2: r2({ 'files-bucket': bucket(4), 'backup-bucket': bucket(3) }), days: history, ...patch });

describe('the history', () => {
  const chart = (title: string) => screen.getByRole('heading', { name: title, level: 4 }).parentElement as HTMLElement;
  /** Each day's column height, oldest first; null where no column is drawn. */
  const columns = (title: string) => [...chart(title).querySelectorAll<HTMLElement>('[data-day]')]
    .map((day) => [day.dataset.day, day.querySelector<HTMLElement>('[data-column]')?.style.height ?? null]);

  it('draws disk used per day, no column for a day with no value, and a tick at the first alert level', async () => {
    await mount(withHistory());

    // Axis top is 100 GB over 120 px.
    expect(columns('Disk Used')).toEqual([['2026-11-08', '60px'], ['2026-11-09', null], ['2026-11-10', '72px']]);
    const ticks = [...chart('Disk Used').querySelectorAll<HTMLElement>('[data-tick]')].map((tick) => tick.style.bottom);
    expect(ticks).toEqual(['96px', '96px', '96px']);
  });

  it('switches the disk chart between two disks', async () => {
    const user = userEvent.setup();
    await mount(withHistory({
      disks: [disk({ id: 'storage', alertLevels: [0.5] }), disk({ id: 'data+app', total: 50 * GB, alertLevels: [0.9] })],
      forecast: {},
      days: [dayOf('2026-11-10', { ...used('storage', 20), ...used('data+app', 40) })],
    }));

    // Axis top is 50 GB, from the tick at 50% of 100 GB.
    expect(columns('Disk Used')).toEqual([['2026-11-10', '48px']]);
    await user.click(within(chart('Disk Used')).getAllByRole('radio', { name: 'Database And Backups Disk' })[0]);
    // Axis top is 50 GB: the tick at 45 GB tops the 40 GB column.
    expect(columns('Disk Used')).toEqual([['2026-11-10', '96px']]);
  });

  it('has no disk switcher with one disk', async () => {
    await mount(withHistory());
    expect(within(chart('Disk Used')).queryByRole('radio')).toBeNull();
  });

  it('draws the sum of both buckets per day, and no column where one bucket has no value', async () => {
    await mount(withHistory());

    // Axis top is 10 GB over 120 px.
    expect(columns('R2 Total')).toEqual([['2026-11-08', '60px'], ['2026-11-09', null], ['2026-11-10', '84px']]);
  });

  it('draws no R2 columns when the server has no R2 access', async () => {
    await mount(withHistory({ r2: null }));
    expect(columns('R2 Total').map(([, height]) => height)).toEqual([null, null, null]);
  });

  it('draws downloads per day, with only today faint', async () => {
    await mount(withHistory());

    // Axis top is 50 over 120 px.
    expect(columns('Downloads')).toEqual([['2026-11-08', '96px'], ['2026-11-09', '0px'], ['2026-11-10', '29px']]);
    expect(chart('Downloads').querySelector('[data-partial]')?.getAttribute('data-day')).toBe('2026-11-10');
    expect(chart('Disk Used').querySelector('[data-partial]')).toBeNull();
  });

  it('lists every day in a table, with the dash for a missing value and never zero', async () => {
    await mount(withHistory());
    const table = screen.getByRole('table', { name: 'Per Day' });

    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Day', 'Disk Used', 'R2 Total', 'Downloads']);
    expect(within(table).getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual([
      '2026-11-1060.0 GB7.0 GB12 (So Far)',
      '2026-11-09——0',
      '2026-11-0850.0 GB5.0 GB40',
    ]);
  });

  it('gives each of two disks its own column in the table', async () => {
    await mount(withHistory({ disks: [disk({ id: 'storage' }), disk({ id: 'data+app' })], forecast: {} }));
    expect(within(screen.getByRole('table', { name: 'Per Day' })).getAllByRole('columnheader').map((cell) => cell.textContent))
      .toEqual(['Day', 'Uploads Disk Used', 'Database And Backups Disk Used', 'R2 Total', 'Downloads']);
  });
});

describe('the range', () => {
  it('reads 30 days first and each range when picked', async () => {
    const user = userEvent.setup();
    const { api } = await mount(withHistory());

    expect(api.fetchStorageReport.mock.calls.map(([days]) => days)).toEqual([30]);
    expect(screen.getAllByRole('radio', { name: '30 Days' })[0].getAttribute('aria-checked')).toBe('true');
    for (const range of ['7', '90', '365']) await user.click(screen.getAllByRole('radio', { name: `${range} Days` })[0]);
    await waitFor(() => expect(api.fetchStorageReport.mock.calls.map(([days]) => days)).toEqual([30, 7, 90, 365]));
  });

  it('ignores a slower answer for a range the reader has left', async () => {
    const user = userEvent.setup();
    const answers = new Map<number, (value: StorageReport) => void>();
    const api = {
      fetchStorageReport: vi.fn((days: number, _signal?: AbortSignal) => (days === 30
        ? Promise.resolve(withHistory())
        : new Promise<StorageReport>((resolve) => answers.set(days, resolve)))),
    };
    render(<StoragePanel active api={api} />);
    const rows = () => within(screen.getByRole('table', { name: 'Per Day' })).getAllByRole('row');
    await screen.findByRole('table', { name: 'Per Day' });

    await user.click(screen.getAllByRole('radio', { name: '7 Days' })[0]);
    await user.click(screen.getAllByRole('radio', { name: '90 Days' })[0]);
    answers.get(90)?.(withHistory({ days: history.slice(0, 1) }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    answers.get(7)?.(withHistory({ days: history.slice(0, 2) }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(rows()).toHaveLength(2);
  });
});
