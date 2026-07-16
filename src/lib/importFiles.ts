import type { ChangeEvent } from 'react';
import { toast } from 'react-toastify';

/**
 * Shared bits of the multi-file import handlers (worlds, characters, dictionaries, saves), which all follow
 * the same shape: take the files, skip the bad ones, summarize once.
 */

/**
 * The files a file-input change carries, read *before* the input is reset — `Array.from` copies the handles
 * out of the live `FileList`, so clearing `value` (which lets the same file be picked again) can't strip
 * them out from under a later `await file.text()`.
 */
export function filesFrom(event: ChangeEvent<HTMLInputElement>): File[] {
  const files = Array.from(event.target.files ?? []);
  event.target.value = '';
  return files;
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
