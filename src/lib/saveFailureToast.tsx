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

/** Download `world` as a world file, with no prompts: the save failed and this is the copy that remains. */
async function exportUnsaved(world: World): Promise<void> {
  try {
    downloadBlob(await serializeWorldFile(world), `${world.worldOverview?.name || 'rpg_world'}.json`);
  } catch (error) {
    toastError(error, { headline: 'Formamorph cannot export the world.' });
  }
}

/**
 * Tell the author a world save failed. A full disk names the space used and available and offers Export
 * World for the unsaved world; any other failure shows the general message with View Details.
 *
 * @param error - What the save rejected with
 * @param world - The world the save could not store
 */
export async function toastSaveFailure(error: unknown, world: World): Promise<void> {
  if (!isQuotaError(error)) {
    toastError(error, { headline: SAVE_FAILED });
    return;
  }
  const space = await spaceLine();
  linkToast(
    [STORAGE_FULL, ...(space ? [space] : []), EXPORT_TO_KEEP],
    'Export World',
    () => { void exportUnsaved(world); },
    { autoClose: false },
  );
}
