import type { ChangeEvent } from 'react';
import { toast } from 'react-toastify';
import { filesFrom } from '@/lib/filesFrom';

/**
 * Shared bits of the multi-file import handlers (worlds, characters, dictionaries, saves), which all follow
 * the same shape: take the files, skip the bad ones, summarize once.
 */

export { filesFrom };

/** The shared pack-import step: take the picked file, reset the input, hand its text reader to `importText`. */
export function importPackFile(
  event: ChangeEvent<HTMLInputElement>,
  importText: (readText: () => Promise<string | null>) => Promise<void>,
): void {
  const [file] = filesFrom(event);
  if (file) void importText(() => file.text());
}

/**
 * The one summary a batch import reports: `Imported 5 worlds (1 skipped).` Warns when anything was skipped,
 * so a partial import can't look like a clean one. `extra` appends before the skipped count (e.g. lorebooks).
 */
export function importSummaryToast(
  ok: number,
  skipped: number,
  noun: { one: string; many: string },
  extra = '',
): void {
  const what = ok === 1 ? noun.one : noun.many;
  toast[skipped ? 'warning' : 'success'](
    `Imported ${ok} ${what}${extra}${skipped ? ` (${skipped} skipped)` : ''}.`,
  );
}
