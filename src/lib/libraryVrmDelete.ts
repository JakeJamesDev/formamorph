import { findSavesUsingModel } from '@/lib/modelUsage';
import { replaceLibraryItemContent } from '@/lib/librarySources';
import EntityStorageService from '@/services/EntityStorageService';
import { withVrmPick } from '@/lib/worldVrmStore';

/** What a library Avatar delete reaches: the saves and the library entities that use it, by name. */
export interface ModelUsage {
  saves: string[];
  entities: string[];
}

/** Up to three names in quotes, and a count of the rest. */
export const listNames = (names: string[]): string => {
  const shown = names.slice(0, 3).map((name) => `"${name}"`);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} and ${rest} more`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
};

/** The library entities that pick the Avatar `modelId`. */
const libraryUsers = async (modelId: string) =>
  (await EntityStorageService.getEntityMetadata()).filter((entity) => entity.vrmLibraryId === modelId);

/** The saves and library entities that use the Avatar `modelId`. */
export async function findModelUsage(modelId: string): Promise<ModelUsage> {
  const [saves, entities] = await Promise.all([findSavesUsingModel(modelId), libraryUsers(modelId)]);
  return { saves, entities: entities.map((entity) => entity.name || 'Unnamed') };
}

/** What the delete confirmation says. `null` while the usage is still being read. */
export function deleteModelDescription(usage: ModelUsage | null): string {
  if (!usage) return 'Checking what uses this Avatar…';
  const { saves, entities } = usage;
  if (!saves.length && !entities.length) return 'Are you sure you want to delete this Avatar? This action cannot be undone.';
  const parts = [
    ...(entities.length ? [`${listNames(entities)} will show no Avatar.`] : []),
    ...(saves.length
      ? [`${saves.length === 1 ? 'One save uses' : `${saves.length} saves use`} this Avatar: ${listNames(saves)}. ${saves.length === 1 ? 'It' : 'They'} will fall back to the Default Avatar.`]
      : []),
    'This action cannot be undone.',
  ];
  return parts.join(' ');
}

/** Set every library entity that picks the Avatar `modelId` to none. Each write is an edit, so linked world copies
 *  see it in their next review. */
export async function clearLibraryModelPicks(modelId: string): Promise<void> {
  const revision = new Date().toISOString();
  for (const meta of await libraryUsers(modelId)) {
    const entity = withVrmPick(await EntityStorageService.getEntityData(meta.id));
    await replaceLibraryItemContent('entity', meta.id, entity, revision);
  }
}
