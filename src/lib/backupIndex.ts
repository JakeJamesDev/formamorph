/**
 * Reading a backup file for restore, one record at a time. DOM- and storage-free, so the JSON file
 * worker runs the index pass.
 */
import type { Entity, World } from '@/types';
import { BackupShapeError, BackupSyntaxError, scanBackupSpans, type Span } from './backupScan';
import { countWorldImages } from './imageSlots';
import { entityImages } from './entityImages';
import { applyEntityImagesOptimize, applyWorldOptimize, type ImageCodec, type OptimizeMode } from './imageOptimCore';

const NOT_JSON = 'Not a valid JSON file.';
const NOT_BACKUP = 'This file is not a Formamorph backup.';

/** The category keys, in a stable display order. */
export const BACKUP_CATEGORIES = ['worlds', 'saves', 'entities', 'dictionaries'] as const;
export type BackupCategory = (typeof BACKUP_CATEGORIES)[number];

/** Any stored record carrying a string `id` primary key (all four stores use `keyPath: 'id'`). */
export interface IdRecord {
  id: string;
  [key: string]: unknown;
}

/** A human label for a stored record — its `name`, falling back to the raw id. */
export function itemLabel(record: IdRecord): string {
  return typeof record.name === 'string' && record.name ? record.name : record.id;
}

/** Where a record lives, for the checklist's breadcrumb: a save's world. */
export function itemBreadcrumb(category: BackupCategory, record: IdRecord): string[] | undefined {
  if (category !== 'saves') return undefined;
  const state = record.currentState as { worldName?: unknown } | null | undefined;
  return typeof state?.worldName === 'string' && state.worldName ? [state.worldName] : undefined;
}

/** One record in a backup file: where it is, and what the checklist shows for it. */
export interface BackupEntry {
  id: string;
  label: string;
  breadcrumb?: string[];
  /** Byte range of the record in the file. */
  start: number;
  end: number;
  /** Images the record holds, for restore progress. */
  images: number;
}

/** A backup file read for restore. Records stay in the file until `readBackupRecord` reads one. */
export interface BackupIndex {
  formamorphBackup: number;
  appVersion: string;
  exportedAt: string;
  file: Blob;
  data: Record<BackupCategory, BackupEntry[]>;
}

/** How one category's records hold images: worlds and entities keep theirs in `data`. */
export interface RecordImages {
  count: (data: object) => number;
  /** Re-encode the record's images per `mode`; `onImage(done)` counts this record's finished images. */
  optimize: (
    codec: ImageCodec,
    record: IdRecord & { data: object },
    mode: OptimizeMode,
    onImage: (done: number) => void,
  ) => Promise<IdRecord>;
}

export const RECORD_IMAGES: Partial<Record<BackupCategory, RecordImages>> = {
  worlds: {
    count: (data) => countWorldImages(data as World),
    optimize: async (codec, record, mode, onImage) => {
      const data = await applyWorldOptimize(codec, record.data as World, mode, onImage);
      // The library card keeps its own copy of the thumbnail.
      return { ...record, data, thumbnail: data.worldOverview?.thumbnail ?? record.thumbnail };
    },
  },
  entities: {
    count: (data) => entityImages(data as Entity).length,
    optimize: async (codec, record, mode, onImage) => {
      let done = 0;
      return { ...record, data: await applyEntityImagesOptimize(codec, record.data as Entity, mode, () => onImage(++done)) };
    },
  },
};

/** The record's `data` when it is an object, the only shape that can hold images. */
export const recordData = (record: IdRecord): object | null =>
  typeof record.data === 'object' && record.data !== null ? record.data : null;

/** Images a backup record holds. */
const countImages = (category: BackupCategory, record: IdRecord): number => {
  const data = recordData(record);
  return data ? (RECORD_IMAGES[category]?.count(data) ?? 0) : 0;
};

const parseSpan = async (file: Blob, span: Span): Promise<unknown> => {
  try {
    return JSON.parse(await file.slice(span.start, span.end).text());
  } catch {
    throw new Error(NOT_JSON);
  }
};

/**
 * Index a backup file one record at a time, so no string holds the whole file. Missing categories become
 * `[]` and records without a string id are dropped. Throws on a file that is not a backup.
 */
export async function indexBackup(file: Blob): Promise<BackupIndex> {
  let spans;
  try {
    spans = await scanBackupSpans(file, BACKUP_CATEGORIES);
  } catch (err) {
    if (err instanceof BackupShapeError) throw new Error(NOT_BACKUP);
    if (err instanceof BackupSyntaxError) throw new Error(NOT_JSON);
    throw err;
  }
  const header = async (key: string) => (spans.header[key] ? parseSpan(file, spans.header[key]) : undefined);
  const format = await header('formamorphBackup');
  if (typeof format !== 'number' || !spans.hasData) throw new Error(NOT_BACKUP);
  const appVersion = await header('appVersion');
  const exportedAt = await header('exportedAt');

  const data: Record<BackupCategory, BackupEntry[]> = { worlds: [], saves: [], entities: [], dictionaries: [] };
  for (const span of spans.records) {
    const { category } = span;
    const record = (await parseSpan(file, span)) as IdRecord | null;
    if (!record || typeof record.id !== 'string') continue;
    data[category].push({
      id: record.id,
      label: itemLabel(record),
      breadcrumb: itemBreadcrumb(category, record),
      start: span.start,
      end: span.end,
      images: countImages(category, record),
    });
  }
  return {
    formamorphBackup: format,
    appVersion: typeof appVersion === 'string' ? appVersion : 'unknown',
    exportedAt: typeof exportedAt === 'string' ? exportedAt : '',
    file,
    data,
  };
}

/** Read one record from the file the index came from. */
export async function readBackupRecord(index: BackupIndex, entry: BackupEntry): Promise<IdRecord> {
  return (await parseSpan(index.file, entry)) as IdRecord;
}
