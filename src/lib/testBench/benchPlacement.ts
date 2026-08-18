/**
 * Where the full Test Bench sits on desktop: embedded in the editor's list panel, or docked beside it.
 *
 * Editor chrome, not authoring — so it is global rather than per world, and it outlives the session: an
 * author who works one way wants "Open Test Bench" to keep opening the Bench that way. Mobile has neither
 * placement; its full panel is the sheet.
 */
import { readStorageJson, writeStorageJson } from '@/lib/keyedStorage';

export type BenchPlacement = 'embedded' | 'docked';

const STORAGE_KEY = 'FORMAMORPH_benchPlacement';

/** The stored placement. Embedded by default: the Bench gets real width without costing a third column. */
export function readBenchPlacement(): BenchPlacement {
  return readStorageJson('local', STORAGE_KEY) === 'docked' ? 'docked' : 'embedded';
}

export function writeBenchPlacement(placement: BenchPlacement): void {
  writeStorageJson('local', STORAGE_KEY, placement);
}
