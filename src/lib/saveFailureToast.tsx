import { toast } from 'react-toastify';
import type { World } from '@/types';
import { downloadBlob } from './downloadBlob';
import { linkToast, toastError } from './linkToast';
import { formatModelSize } from './localModels';
import { serializeWorldFile } from './worldFile';

export const SAVE_FAILED = 'Formamorph cannot save the world.';
export const STORAGE_FULL = 'Formamorph cannot save the world. The storage is full.';
export const EXPORT_TO_KEEP = 'Select “Export World” to keep your changes.';

/** Whether `error` is the browser refusing a write for lack of space. */
export function isQuotaError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'QuotaExceededError';
}

export const DISK_WRITE_CAUSE = 'The disk may be full, or security software blocked the file.';

/**
 * Whether `error` is Chromium failing to write an IndexedDB blob file to disk.
 *
 * A full disk is one cause; a file lock or denied access gives the same error. The bracketed suffix is an internal
 * result name that differs by backend, so only the prefix is matched.
 */
export function isDiskWriteError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return name === 'DataError' && typeof message === 'string' && message.startsWith('Failed to write blobs');
}

export const AUTOSAVE_FAILED = 'Formamorph cannot autosave the game.';
export const AUTOSAVE_STORAGE_FULL = `${AUTOSAVE_FAILED} The storage is full. Delete saves you no longer need to free space.`;
export const AUTOSAVE_DISK_WRITE = `${AUTOSAVE_FAILED} ${DISK_WRITE_CAUSE}`;

/** The used and available space, or null when the browser gives no estimate. */
async function spaceLine(): Promise<string | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.usage === undefined || estimate.quota === undefined) return null;
    const available = Math.max(0, estimate.quota - estimate.usage);
    return `Formamorph uses ${formatModelSize(estimate.usage)}. ${formatModelSize(available)} is available.`;
  } catch {
    return null;
  }
}

export const DOWNLOAD_FAILED = 'Failed to download world';
export const DOWNLOAD_STORAGE_FULL = 'Formamorph cannot download the world. The storage is full.';
export const FREE_SPACE = 'Delete worlds or saves you no longer need to free space.';
const DOWNLOAD_DISK_WRITE = 'Formamorph cannot download the world.';

/**
 * Tell the player a world download failed. Full storage names the space used and available and the fix; any
 * other failure shows the general message with View Details.
 *
 * @param error - What the download rejected with
 */
export async function toastDownloadFailure(error: unknown): Promise<void> {
  if (isDiskWriteError(error)) {
    toast.error(`${DOWNLOAD_DISK_WRITE} ${DISK_WRITE_CAUSE}`, { autoClose: false });
    return;
  }
  if (!isQuotaError(error)) {
    toastError(error, DOWNLOAD_FAILED);
    return;
  }
  const space = await spaceLine();
  toast.error([DOWNLOAD_STORAGE_FULL, ...(space ? [space] : []), FREE_SPACE].join(' '), { autoClose: false });
}

/** Download `world` as a world file, with no prompts: the save failed and this is the copy that remains. */
async function exportUnsaved(world: World): Promise<void> {
  try {
    downloadBlob(await serializeWorldFile(world), `${world.worldOverview?.name || 'rpg_world'}.json`);
  } catch (error) {
    toastError(error, { headline: 'Formamorph cannot export the world.' });
  }
}

/**
 * Tell the player an autosave failed. Full storage says so and names the fix; any other failure shows the
 * general message with View Details.
 *
 * @param error - What the autosave rejected with
 */
export function toastAutosaveFailure(error: unknown): void {
  if (isQuotaError(error)) toast.error(AUTOSAVE_STORAGE_FULL, { autoClose: false });
  else if (isDiskWriteError(error)) toast.error(AUTOSAVE_DISK_WRITE, { autoClose: false });
  else toastError(error, { headline: AUTOSAVE_FAILED });
}

/**
 * Tell the author a world save failed. Full storage names the space used and available, a failed disk write
 * names its likely causes, and both offer Export World for the unsaved world; any other failure shows the
 * general message with View Details.
 *
 * @param error - What the save rejected with
 * @param world - The world the save could not store
 * @param exportBlock - Why the world may not be exported; the toast then states it in place of the button
 */
export async function toastSaveFailure(error: unknown, world: World, exportBlock: string | null = null): Promise<void> {
  let lead: string[];
  if (isQuotaError(error)) {
    const space = await spaceLine();
    lead = [STORAGE_FULL, ...(space ? [space] : [])];
  } else if (isDiskWriteError(error)) {
    lead = [SAVE_FAILED, DISK_WRITE_CAUSE];
  } else {
    toastError(error, { headline: SAVE_FAILED });
    return;
  }
  if (exportBlock) {
    toast.error([...lead, `${exportBlock}.`].join(' '), { autoClose: false });
    return;
  }
  linkToast(
    [...lead, EXPORT_TO_KEEP],
    'Export World',
    () => { void exportUnsaved(world); },
    { autoClose: false },
  );
}
