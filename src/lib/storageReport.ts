import type { BarSegment } from '@/components/ui/segmented-bar';
import type { StorageBucket, StorageDisk, StoragePart, StorageReport, StorageReportDay } from '@/services/StorageReportService';

const HOUR_MS = 3_600_000;
/** A part's measurement this much older than now has missed hourly runs. */
export const STALE_AFTER_MS = 3 * HOUR_MS;

/** Each part's filesystem role, label, and own hue. A part with no hue joins Other Uploads. */
const PARTS: Record<string, { role: string; label: string; hue?: string }> = {
  database: { role: 'data', label: 'Database', hue: 'hsl(var(--chart-1))' },
  worlds: { role: 'storage', label: 'Worlds', hue: 'hsl(var(--chart-2))' },
  backups: { role: 'app', label: 'Local Backups', hue: 'hsl(var(--chart-3))' },
  thumbnails: { role: 'storage', label: 'Thumbnails', hue: 'hsl(var(--chart-4))' },
  pending: { role: 'storage', label: 'Pending Uploads' },
  avatars: { role: 'storage', label: 'Avatars' },
  'event-posters': { role: 'storage', label: 'Event Posters' },
  'supporter-private': { role: 'storage', label: 'Supporter Content' },
};
/** A name the client does not know is an upload directory. */
const partRole = (name: string) => PARTS[name]?.role ?? 'storage';

const OTHER_HUE = 'hsl(var(--chart-5))';
const REMAINDER_HUE = 'hsl(var(--muted-foreground) / 0.5)';
export const OTHER_KEY = 'other-uploads';
export const REMAINDER_KEY = 'system-and-app';

/** A part's own name where the client has one, else its stored name spaced out. */
export function partLabel(name: string): string {
  return PARTS[name]?.label ?? name.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/** The roles a disk holds, read from its id (`storage+data+app`). */
const diskRoles = (disk: StorageDisk) => disk.id.split('+');

const ROLE_LABELS: Record<string, string> = { storage: 'Uploads', data: 'Database', app: 'Backups' };

/** A disk named by what it holds, for a report with more than one. */
export function diskLabel(disk: StorageDisk): string {
  return `${diskRoles(disk).map((role) => ROLE_LABELS[role] ?? role).join(' And ')} Disk`;
}

/** Disk and bucket rows share the report's names but are not parts. */
const isPartName = (name: string) => !name.startsWith('r2:') && !name.startsWith('disk:');

/** Every part for the table, largest first; parts never measured go last. */
export function tableParts(report: StorageReport): { name: string; part: StoragePart | null }[] {
  return Object.entries(report.parts)
    .filter(([name]) => isPartName(name))
    .map(([name, part]) => ({ name, part }))
    .sort((a, b) => (b.part?.bytes ?? -1) - (a.part?.bytes ?? -1));
}

/**
 * One disk's bar: its measured parts largest first, then the space no part explains. The remainder
 * is used minus those parts, and never below zero.
 */
export function diskSegments(disk: StorageDisk, parts: StorageReport['parts']): BarSegment[] {
  const roles = diskRoles(disk);
  const own = Object.entries(parts)
    .filter((entry): entry is [string, StoragePart] => entry[1] !== null && isPartName(entry[0]) && roles.includes(partRole(entry[0])));

  const segments: BarSegment[] = [];
  let other = 0;
  for (const [name, part] of own) {
    const hue = PARTS[name]?.hue;
    if (hue) segments.push({ key: name, label: partLabel(name), value: part.bytes, color: hue });
    else other += part.bytes;
  }
  if (own.some(([name]) => !PARTS[name]?.hue)) segments.push({ key: OTHER_KEY, label: 'Other Uploads', value: other, color: OTHER_HUE });
  segments.sort((a, b) => b.value - a.value);

  const measured = own.reduce((total, [, part]) => total + part.bytes, 0);
  segments.push({ key: REMAINDER_KEY, label: 'System And App', value: Math.max(0, disk.used - measured), color: REMAINDER_HUE });
  return segments;
}

/** The disk that holds the database, where a vacuum writes. */
export const databaseDisk = (report: StorageReport): StorageDisk | undefined =>
  report.disks.find((disk) => diskRoles(disk).includes(partRole('database')));

/** Whole hours since an instant, when it is older than the stale limit; null while it is current. */
export function staleHours(iso: string, now: number): number | null {
  const age = now - Date.parse(iso);
  return age > STALE_AFTER_MS ? Math.floor(age / HOUR_MS) : null;
}

/** Bucket hues by the report's order: files first, backups second. Names come from server config. */
const BUCKET_HUES = ['hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

export interface BucketRow {
  name: string;
  bucket: StorageBucket | null;
  color: string;
}

/** Every bucket in the report's order, each with its hue. */
export function bucketRows(r2: NonNullable<StorageReport['r2']>): BucketRow[] {
  return Object.entries(r2.buckets).map(([name, bucket], index) => ({ name, bucket, color: BUCKET_HUES[index] ?? OTHER_HUE }));
}

/** The R2 bar: one segment per measured bucket. */
export const bucketSegments = (rows: readonly BucketRow[]): BarSegment[] =>
  rows.flatMap((row) => (row.bucket ? [{ key: row.name, label: row.name, value: row.bucket.bytes, color: row.color }] : []));

/** One stored figure of a day; null when the day has no row for it. */
const dayBytes = (day: StorageReportDay, name: string) => day.values[name]?.bytes ?? null;

/** A disk's used bytes on a day. */
export const diskUsedOn = (day: StorageReportDay, disk: StorageDisk) => dayBytes(day, `disk:${disk.id}:used`);

/** Every bucket's bytes summed for a day. Null when any bucket has no row, or the report has no buckets. */
export function r2TotalOn(day: StorageReportDay, buckets: readonly string[]): number | null {
  if (buckets.length === 0) return null;
  let total = 0;
  for (const name of buckets) {
    const value = dayBytes(day, `r2:${name}`);
    if (value === null) return null;
    total += value;
  }
  return total;
}
