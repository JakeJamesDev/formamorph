import AuthService from './AuthService';
import { authHeaders, unwrap } from './authRequest';

/** One filesystem the server writes to, read live. `id` lists its roles, joined with `+` (`storage+data+app`). */
export interface StorageDisk {
  id: string;
  paths: string[];
  total: number;
  used: number;
  free: number;
  usedFraction: number;
  /** Fractions of `total` (0.8 is 80%) at which the server mails the admins. */
  alertLevels: number[];
}

/** The newest measurement of one name. */
export interface StoragePart {
  bytes: number;
  files: number;
  measuredAt: string;
}

export interface StorageBucket {
  bytes: number;
  objects: number;
  checkedAt: string;
}

/** One stored row of a day: a part, a disk figure, or a bucket. */
export interface StorageDayValue {
  bytes: number;
  files: number;
}

export interface StorageReportDay {
  day: string;
  /** Keyed by stored name (`worlds`, `disk:<id>:used`, `r2:<bucket>`). Null when that day has no row. */
  values: Record<string, StorageDayValue | null>;
  downloads: number;
}

/** The storage report: `GET /api/storage/report`. Days run newest first. */
export interface StorageReport {
  disks: StorageDisk[];
  /** Every known name, R2 names included. Null when it was never measured. */
  parts: Record<string, StoragePart | null>;
  vacuumFits: boolean;
  /** Null when the server has no R2 access. */
  r2: { freeTierBytes: number; buckets: Record<string, StorageBucket | null> } | null;
  /** Keyed by disk id. */
  forecast: Record<string, { daysUntilFull: number | null }>;
  days: StorageReportDay[];
}

export interface StorageReportApi {
  fetchStorageReport(days: number, signal?: AbortSignal): Promise<StorageReport>;
}

/** The admin storage report route. Answers 403 to a moderator. */
class StorageReportService implements StorageReportApi {
  async fetchStorageReport(days: number, signal?: AbortSignal): Promise<StorageReport> {
    const response = await fetch(`${AuthService.API_URL}/storage/report?days=${days}`, { headers: authHeaders(), signal });
    return (await unwrap<{ data: StorageReport }>(response, 'Failed to read the storage report')).data;
  }
}

export default new StorageReportService();
