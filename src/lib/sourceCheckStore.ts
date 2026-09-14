/**
 * What the last missing-source check said about one world, kept between sessions.
 *
 * Browser-local and keyed by world id, like the Bench's own records — never a byte of it in the world
 * itself. It exists because a check runs only when the author asks for one: the main menu gates a new game
 * and a publish on an answer that was already given, and never on a request of its own.
 */
import { createKeyedRecordStore } from '@/lib/keyedStorage';
import type { SourceCheckResults, SourceCheckStatus } from '@/lib/sourceChecks';

const store = createKeyedRecordStore('local', 'FORMAMORPH_sourceCheckState');

/** One world's last check. */
export interface SourceCheckRecord {
  /** When the check ran, as an ISO stamp. */
  checkedAt: string;
  /** Listing id to what the check said about it. */
  results: SourceCheckResults;
  /** The listing ids the world's own listing declared required when the check ran. */
  required: string[];
}

export const EMPTY_SOURCE_CHECK: SourceCheckRecord = { checkedAt: '', results: {}, required: [] };

const STATUSES = new Set<string>(['ok', 'not_found', 'unavailable']);

const asStatuses = (value: unknown): SourceCheckResults => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, SourceCheckStatus> = {};
  for (const [id, status] of Object.entries(value as Record<string, unknown>)) {
    if (typeof status === 'string' && STATUSES.has(status)) out[id] = status as SourceCheckStatus;
  }
  return out;
};

const asIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && !!id.trim()) : [];

/**
 * The stored check for `worldId`, or an empty one.
 *
 * Every field is narrowed on read: the record is hand-editable browser storage, and an answer nobody
 * recognizes has to read as no answer rather than as a missing source.
 */
export function readSourceCheck(worldId: string | null | undefined): SourceCheckRecord {
  if (!worldId) return EMPTY_SOURCE_CHECK;
  const stored = store.read(worldId);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return EMPTY_SOURCE_CHECK;
  const record = stored as Record<string, unknown>;
  return {
    checkedAt: typeof record.checkedAt === 'string' ? record.checkedAt : '',
    results: asStatuses(record.results),
    required: asIds(record.required),
  };
}

/** Record what a check just said about `worldId`. */
export function writeSourceCheck(worldId: string | null | undefined, record: SourceCheckRecord): void {
  if (!worldId) return;
  store.write(worldId, record);
}
