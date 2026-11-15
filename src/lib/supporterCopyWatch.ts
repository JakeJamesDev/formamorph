/** The app's Supporter Copy sync, bound to the Supporter content module and the world and library stores. */
import { supporterContent } from '@/lib/supporterContent';
import { createSupporterCopySync } from '@/lib/supporterCopySync';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import ModelStorageService from '@/services/ModelStorageService';
import WorldStorageService from '@/services/WorldStorageService';

const all = { includeHidden: true };

export const supporterCopySync = createSupporterCopySync({
  content: supporterContent,
  holders: [
    { list: () => WorldStorageService.getWorldMetadata(all), remove: (id) => WorldStorageService.deleteWorld(id) },
    { list: () => EntityStorageService.getEntityMetadata(all), remove: (id) => EntityStorageService.deleteEntity(id) },
    { list: () => DictionaryStorageService.getDictionaryMetadata(all), remove: (id) => DictionaryStorageService.deleteDictionary(id) },
    { list: () => ModelStorageService.getModelMetadata(all), remove: (id) => ModelStorageService.deleteModel(id) },
  ],
});

/**
 * Keep the stored Supporter Copies in step with the Supporter content check from now on.
 *
 * @returns The unsubscribe
 */
export const watchSupporterCopies = (): (() => void) => supporterCopySync.start();
