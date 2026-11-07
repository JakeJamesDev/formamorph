/**
 * The merge categories for settings and sign-in (the localStorage keys) and the model-folder choice. Both copy
 * only what the folder lacks.
 */
import type { MergeCategory, MergeItem } from './engine';
import type { ModelFolderField, ProfileMergeBridge } from './bridge';

/** Caches the app refetches; every other key copies. */
export const SETTINGS_CACHE_KEYS: readonly string[] = [
  'FORMAMORPH_updateCache',
  'fm.catalogDownloads',
  'formamorph.tierNames',
  'formamorph.tierPrices',
  'FORMAMORPH_reasoningCatalog',
];

export const SETTINGS_KEY = 'settings';
export const MODEL_FOLDER_KEY = 'modelFolder';

const MODEL_FOLDER_FIELDS: readonly { field: ModelFolderField; label: string }[] = [
  { field: 'downloadDir', label: 'Download Folder' },
  { field: 'externalDir', label: 'Extra Model Folder' },
  { field: 'searchSubfolders', label: 'Search Subfolders' },
];

const isCopied = (key: string) => !SETTINGS_CACHE_KEYS.includes(key);

const readEntries = (storage: Storage): MergeItem[] => {
  const items: MergeItem[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key === null || !isCopied(key)) continue;
    items.push({ id: key, label: key, size: 0 });
  }
  return items;
};

/** Settings and sign-in. Items weigh 0, so the plan runs this category first (Q14). A key the folder holds stays. */
export function settingsCategory(bridge: ProfileMergeBridge, storage: Storage = localStorage): MergeCategory {
  let entries: Promise<Record<string, string>> | undefined;
  const sourceEntries = () => (entries ??= bridge.settings());
  return {
    key: SETTINGS_KEY,
    label: 'Settings and Sign-In',
    stamped: false,
    unit: 'items',
    target: async () => readEntries(storage),
    source: async () => {
      const all = await sourceEntries();
      return Object.entries(all)
        .filter(([key]) => isCopied(key))
        .map(([key]): MergeItem => ({ id: key, label: key, size: 0 }));
    },
    copy: async (item) => {
      const value = (await sourceEntries())[item.id];
      if (typeof value !== 'string') throw new Error('The other copy no longer holds it');
      storage.setItem(item.id, value);
    },
  };
}

/** The model-folder choice: each field the folder lacks takes the AppData value. */
export function modelFolderCategory(bridge: ProfileMergeBridge): MergeCategory {
  const fieldsOf = (side: 'source' | 'target') => async () => {
    const fields = (await bridge.modelFolder())[side];
    return MODEL_FOLDER_FIELDS.filter(({ field }) => field in fields).map(({ field, label }): MergeItem => ({ id: field, label, size: 0 }));
  };
  return {
    key: MODEL_FOLDER_KEY,
    label: 'Model Folder',
    stamped: false,
    unit: 'items',
    target: fieldsOf('target'),
    source: fieldsOf('source'),
    copy: (item) => bridge.fillModelFolder(item.id as ModelFolderField),
  };
}
