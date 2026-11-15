/**
 * The Supporter Copy rule: which actions a Supporter Copy world or library entry allows. Every surface reads
 * it; a blocked action stays visible and disabled, with the reason as its tooltip.
 */
import type { LibrarySupporterCopyMarker, SupporterCopyMarker } from '@/types';

/** Every action the rule answers. `addToWorld` names the world an entry would be added to. */
export type SupporterCopyAction =
  | 'exportWorld'
  | 'exportEntity'
  | 'exportDictionary'
  | 'exportSave'
  | 'exportAiContext'
  | 'duplicate'
  | 'publish'
  | 'downloadMedia'
  | 'backup'
  | 'crashExport'
  | 'saveToLibrary'
  | 'optimizeImages'
  | { addToWorld: string };

/** A world or a library entry, as far as the rule reads it. */
export type SupporterCopyTarget =
  | { supporterCopy?: SupporterCopyMarker | LibrarySupporterCopyMarker | null }
  | null
  | undefined;

const isEntryMarker = (marker: SupporterCopyMarker): marker is LibrarySupporterCopyMarker =>
  typeof (marker as Partial<LibrarySupporterCopyMarker>).sourceWorldId === 'string';

const WORLD_REASONS: Record<Exclude<SupporterCopyAction, object>, string | null> = {
  exportWorld: "You can't export a Supporter world",
  exportEntity: "You can't export entities from a Supporter world",
  exportDictionary: "You can't export dictionaries from a Supporter world",
  exportSave: "You can't export saves of a Supporter world",
  exportAiContext: "You can't export the AI context of a Supporter world",
  duplicate: "You can't duplicate a Supporter world",
  publish: "You can't publish a Supporter world",
  downloadMedia: "You can't download files from a Supporter world",
  backup: "You can't back up a Supporter world",
  crashExport: "You can't export a Supporter world",
  saveToLibrary: null,
  optimizeImages: "You can't optimize images in a Supporter world",
};

const ENTRY_REASONS: Record<Exclude<SupporterCopyAction, object>, string | null> = {
  ...WORLD_REASONS,
  exportWorld: null,
  exportSave: null,
  exportAiContext: null,
  crashExport: null,
  optimizeImages: null,
  exportEntity: "You can't export content saved from a Supporter world",
  exportDictionary: "You can't export content saved from a Supporter world",
  duplicate: "You can't duplicate content saved from a Supporter world",
  publish: "You can't publish content saved from a Supporter world",
  downloadMedia: "You can't download files saved from a Supporter world",
  backup: "You can't back up content saved from a Supporter world",
};

const ADD_ELSEWHERE = 'You can only add this to the Supporter world it came from';

/**
 * Why `action` is blocked on `target`, or null when it is allowed.
 *
 * @param target - A stored world or library entry; one without a marker allows everything
 * @param action - The action asked about
 */
export function supporterCopyBlock(target: SupporterCopyTarget, action: SupporterCopyAction): string | null {
  const marker = target?.supporterCopy;
  if (!marker) return null;
  const entry = isEntryMarker(marker);
  if (typeof action === 'object') return entry && action.addToWorld !== marker.sourceWorldId ? ADD_ELSEWHERE : null;
  return (entry ? ENTRY_REASONS : WORLD_REASONS)[action];
}

/** The Patreon Mark's tooltip on a Supporter Copy's card. */
export const SUPPORTER_WORLD_TIP = 'Supporter world. You can play and edit it, but not export or share it.';

/** The reason shown while a world's marker is still being read. */
export const SUPPORTER_COPY_READING = 'Checking this world';

/**
 * Why `action` is blocked on an open world whose marker may still be unread. Unread blocks, so nothing leaves
 * the app before the answer.
 *
 * @param marker - The open world's marker: undefined while unread, null for a plain world
 */
export function openWorldBlock(marker: SupporterCopyMarker | null | undefined, action: SupporterCopyAction): string | null {
  return marker === undefined ? SUPPORTER_COPY_READING : supporterCopyBlock({ supporterCopy: marker }, action);
}

/**
 * Why `action` is blocked in play: the open world's marker or the loaded save's carried one, whichever blocks.
 *
 * @param open - The open world's marker: undefined while unread, null for a plain world
 * @param carried - The marker a loaded save carried, null for a plain save
 */
export function playBlock(open: SupporterCopyMarker | null | undefined, carried: SupporterCopyMarker | null, action: SupporterCopyAction): string | null {
  return openWorldBlock(open, action) ?? supporterCopyBlock({ supporterCopy: carried }, action);
}

/** Whether `action` is allowed on `target`. */
export const supporterCopyAllows = (target: SupporterCopyTarget, action: SupporterCopyAction): boolean =>
  supporterCopyBlock(target, action) === null;
