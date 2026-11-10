import type { StorageReport, StorageReportApi, StorageReportDay } from '@/services/StorageReportService';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const GB = 1_000_000_000;
const DISK_ID = 'storage+data+app';
const TOTAL = 160 * GB;
const USED = 97.4 * GB;

/**
 * DEV: an in-memory stand-in for the storage report route (`#dev?modal=adminPanel&tab=storage&fixture=storage`).
 * Holds a full report: one disk, every part, both R2 buckets, and a history with gaps.
 *
 * Every figure is a placeholder to make the tab render; none is a real measurement.
 */
export function createDevStorageApi(): StorageReportApi {
  return {
    fetchStorageReport: async (count) => {
      const now = Date.now();
      const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR_MS).toISOString();
      const today = Math.floor(now / DAY_MS) * DAY_MS;

      const days: StorageReportDay[] = Array.from({ length: count }, (_, index) => {
        // Every ninth day has no measurement, to show a gap.
        const gap = index > 0 && index % 9 === 0;
        const used = USED - index * 0.35 * GB;
        return {
          day: new Date(today - index * DAY_MS).toISOString().slice(0, 10),
          values: {
            [`disk:${DISK_ID}:total`]: gap ? null : { bytes: TOTAL, files: 0 },
            [`disk:${DISK_ID}:used`]: gap ? null : { bytes: used, files: 0 },
            'r2:formamorph-worlds': gap ? null : { bytes: 8.1 * GB - index * 0.04 * GB, files: 0 },
            'r2:formamorph-backups': gap ? null : { bytes: 3.6 * GB - index * 0.02 * GB, files: 0 },
          },
          downloads: 40 + ((index * 37) % 61),
        };
      });

      return {
        disks: [{
          id: DISK_ID, paths: ['/srv/formamorph/storage', '/srv/formamorph/data', '/srv/formamorph/backups'],
          total: TOTAL, used: USED, free: TOTAL - USED, usedFraction: USED / TOTAL, alertLevels: [0.8, 0.9],
        }],
        parts: {
          worlds: { bytes: 41.2 * GB, files: 18_406, measuredAt: at(0.4) },
          thumbnails: { bytes: 6.8 * GB, files: 18_390, measuredAt: at(0.4) },
          pending: { bytes: 0.31 * GB, files: 52, measuredAt: at(0.4) },
          avatars: { bytes: 2.4 * GB, files: 3_115, measuredAt: at(0.4) },
          'event-posters': { bytes: 0.12 * GB, files: 41, measuredAt: at(5.2) },
          'supporter-private': null,
          database: { bytes: 9.7 * GB, files: 2, measuredAt: at(0.4) },
          backups: { bytes: 21.5 * GB, files: 14, measuredAt: at(0.4) },
          'r2:formamorph-worlds': { bytes: 8.1 * GB, files: 0, measuredAt: at(0.6) },
          'r2:formamorph-backups': { bytes: 3.6 * GB, files: 0, measuredAt: at(0.6) },
        },
        vacuumFits: true,
        r2: {
          freeTierBytes: 10 * GB,
          buckets: {
            'formamorph-worlds': { bytes: 8.1 * GB, objects: 36_812, checkedAt: at(0.6) },
            'formamorph-backups': { bytes: 3.6 * GB, objects: 420, checkedAt: at(0.6) },
          },
        },
        forecast: { [DISK_ID]: { daysUntilFull: 179 } },
        days,
      } satisfies StorageReport;
    },
  };
}
