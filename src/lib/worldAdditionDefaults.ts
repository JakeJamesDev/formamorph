import type { DictionarySelectionItem } from './dictionarySelection';
import { selectionKey } from './dictionarySelection';
import { readStorageJson } from './keyedStorage';

interface AdditionChoices {
  entityIds: Set<string>;
  dictionaryItems: DictionarySelectionItem[];
}

interface StoredDefaults {
  version: 1;
  entities: string[];
  dictionaries: { key: string; enabled: boolean }[];
}

const storageKey = (worldId: string) => `FORMAMORPH_worldAdditions:${worldId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isDefaults(value: unknown): value is StoredDefaults {
  return isRecord(value) && value.version === 1
    && Array.isArray(value.entities) && value.entities.every((id: unknown) => typeof id === 'string')
    && Array.isArray(value.dictionaries) && value.dictionaries.every((item: unknown) =>
      isRecord(item) && typeof item.key === 'string' && typeof item.enabled === 'boolean');
}

/** Whether this world has an explicit configuration, including empty selections. */
export function hasWorldAdditionDefaults(worldId: string): boolean {
  return isDefaults(readStorageJson('local', storageKey(worldId)));
}

/** Save references and complete dictionary order; storage failures reach the caller. */
export function saveWorldAdditionDefaults(worldId: string, choices: AdditionChoices): void {
  const record: StoredDefaults = {
    version: 1,
    entities: [...choices.entityIds].map((id) => selectionKey('library', id)),
    dictionaries: choices.dictionaryItems.map(({ key, enabled }) => ({ key, enabled })),
  };
  localStorage.setItem(storageKey(worldId), JSON.stringify(record));
}

/** Restore surviving references against current content, then append new dictionaries in authored order. */
export function restoreWorldAdditionDefaults(
  worldId: string,
  initialItems: DictionarySelectionItem[],
  entities: { id: string }[],
): AdditionChoices {
  const saved = readStorageJson('local', storageKey(worldId));
  if (!isDefaults(saved)) return { entityIds: new Set(), dictionaryItems: initialItems };

  const savedEntities = new Set(saved.entities);
  const entityIds = new Set(entities.filter(({ id }) => savedEntities.has(selectionKey('library', id))).map(({ id }) => id));
  const remaining = new Map(initialItems.map((item) => [item.key, item]));
  const dictionaryItems: DictionarySelectionItem[] = [];
  for (const preference of saved.dictionaries) {
    const item = remaining.get(preference.key);
    if (!item) continue;
    dictionaryItems.push({ ...item, enabled: preference.enabled });
    remaining.delete(preference.key);
  }
  dictionaryItems.push(...remaining.values());
  return { entityIds, dictionaryItems };
}
