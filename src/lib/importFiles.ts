import type { ChangeEvent } from 'react';
import { toast } from 'react-toastify';
import { describeError, showErrorDetails } from '@/lib/errorDetails';
import { filesFrom } from '@/lib/filesFrom';
import { linkToast } from '@/lib/linkToast';
import { isQuotaError } from '@/lib/saveFailureToast';

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

/** What a batch import calls the things it imports. */
export interface ImportNoun {
  one: string;
  many: string;
}

const importedCount = (ok: number, noun: ImportNoun, extra: string): string =>
  `Imported ${ok} ${ok === 1 ? noun.one : noun.many}${extra}`;

/**
 * The one summary a batch import reports: `Imported 5 worlds (1 skipped).` Warns when anything was skipped,
 * so a partial import can't look like a clean one. `extra` appends before the skipped count (e.g. lorebooks).
 */
export function importSummaryToast(
  ok: number,
  skipped: number,
  noun: ImportNoun,
  extra = '',
): void {
  toast[skipped ? 'warning' : 'success'](
    `${importedCount(ok, noun, extra)}${skipped ? ` (${skipped} skipped)` : ''}.`,
  );
}

/** One file a batch import skipped. */
export interface SkippedImport {
  fileName: string;
  /** Text written for the player. */
  cause: string;
  /** The raw parser or storage failure behind `cause`; it shows only in View Details. */
  error?: unknown;
}

/** The written cause for a file that could not be stored. */
export function storageCause(error: unknown, noun: ImportNoun): string {
  return isQuotaError(error) ? 'The storage is full.' : `Formamorph cannot save the ${noun.one}.`;
}

/** The written cause for a world file that failed before storing: its content, or the read itself. */
export function worldFileCause(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'SyntaxError' || name === 'InvalidWorldDataError'
    ? "This isn't a valid world file."
    : 'Formamorph cannot read this file.';
}

const skippedDetails = ({ fileName, cause, error }: SkippedImport): string =>
  [fileName, cause, ...(error === undefined ? [] : [describeError(error, cause).details])].join('\n');

/**
 * The summary with its skipped files. One skipped file shows its name and cause; several keep the count.
 * View Details lists each file, cause and raw failure. Warns when anything was imported, errors when nothing was.
 */
export function importReportToast(
  ok: number,
  skipped: readonly SkippedImport[],
  noun: ImportNoun,
  extra = '',
): void {
  if (!skipped.length) {
    importSummaryToast(ok, 0, noun, extra);
    return;
  }
  const imported = importedCount(ok, noun, extra);
  const lines = skipped.length === 1
    ? [...(ok ? [`${imported}.`] : []), `Couldn't import ${skipped[0].fileName}.`, skipped[0].cause]
    : [`${imported} (${skipped.length} skipped).`];
  const entry = { message: lines.join(' '), details: skipped.map(skippedDetails).join('\n\n') };
  linkToast(lines, 'View Details →', () => showErrorDetails(entry), {}, ok ? 'warning' : 'error');
}
