/** Reads from the AppData profile through the desktop bridge, shared by the merge categories. */
import type { IdRecord } from '@/lib/backupIndex';
import { MergeHalt, reasonOf, type MergeItem } from './engine';
import type { ProfileMergeBridge, SourceSummary } from './bridge';
import { reviveBlobs } from './blobWire';

export const textOr = (value: unknown, fallback: string) => (typeof value === 'string' && value ? value : fallback);

/** The AppData items of one store, labeled and stamped by `stampOf`. */
export const sourceItems = async (
  bridge: ProfileMergeBridge,
  key: string,
  stampOf: (summary: SourceSummary) => string | undefined,
  skip: (summary: SourceSummary) => boolean = () => false,
) =>
  ((await bridge.summaries([key]))[key] ?? []).filter((summary) => !skip(summary)).map((summary): MergeItem => ({
    id: summary.id,
    label: textOr(summary.name, summary.id),
    stamp: stampOf(summary),
    size: summary.size,
  }));

/** One AppData record with its Blobs restored. A reader failure halts the run; a missing record skips the item. */
export async function readRecord(bridge: ProfileMergeBridge, key: string, id: string): Promise<IdRecord> {
  let record: unknown;
  try {
    record = await bridge.record(key, id);
  } catch (err) {
    throw new MergeHalt(`The other copy stopped answering (${reasonOf(err)})`);
  }
  if (!record || typeof record !== 'object' || (record as { id?: unknown }).id !== id) {
    throw new Error('The other copy no longer holds it');
  }
  return reviveBlobs(record as IdRecord);
}
