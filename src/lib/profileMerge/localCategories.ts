/**
 * The merge categories for Avatars, Stat Templates and Mascot Images. Avatars follow newer wins by library
 * revision; stat templates and Mascot images have no stamps and copy only what the folder lacks.
 */
import { libraryRevision } from '@/lib/linkedContent';
import { LEGACY_DEFAULT_AVATAR_ID } from '@/lib/defaultAvatar';
import { readTemplate } from '@/lib/statCodeTemplates';
import { listMascotImageIds, putMascotImage } from '@/lib/formaquestion/mascotImageStore';
import modelStorageService, { type StoredModelRecord } from '@/services/ModelStorageService';
import { listUserTemplates, saveUserTemplate } from '@/services/StatTemplateStorageService';
import type { MergeCategory } from './engine';
import type { ProfileMergeBridge } from './bridge';
import { readRecord, sourceItems, textOr } from './sourceRead';
import { MERGE_KEYS } from './keys';

/** The record shape from before the library wrapper: file fields at the top level. */
interface FlatAvatar {
  id: string;
  name?: string;
  type?: string;
  blob: Blob;
  size?: number;
  addedAt?: string;
}

const isFlat = (record: object): record is FlatAvatar => !('data' in record) && 'blob' in record;

function wrappedAvatar(record: StoredModelRecord | FlatAvatar): StoredModelRecord {
  if (!isFlat(record)) return record;
  return {
    id: record.id,
    name: textOr(record.name, record.id),
    createdAt: record.addedAt,
    data: { type: record.type ?? 'model/vrm', blob: record.blob, size: record.size ?? record.blob.size },
  };
}

function avatarsCategory(bridge: ProfileMergeBridge): MergeCategory {
  return {
    key: MERGE_KEYS.avatars,
    label: 'Avatars',
    stamped: true,
    unit: 'items',
    target: async () => (await modelStorageService.getModelMetadata()).map((meta) => ({
      id: meta.id,
      label: textOr(meta.name, meta.id),
      stamp: libraryRevision(meta) || undefined,
      size: 0,
    })),
    // The old default is gone from every build; the library deletes it on load.
    source: () => sourceItems(bridge, MERGE_KEYS.avatars, (summary) => libraryRevision(summary) || undefined,
      (summary) => summary.id === LEGACY_DEFAULT_AVATAR_ID),
    copy: async (item) => {
      // The AppData profile wrote this record as a stored Avatar or the older flat shape.
      const stored = (await readRecord(bridge, MERGE_KEYS.avatars, item.id)) as unknown as StoredModelRecord | FlatAvatar;
      const record = wrappedAvatar(stored);
      if (!record.data?.blob) throw new Error('Its file is missing');
      // The library keeps the folder's creation stamp; an edit stamp makes a repeat run tie.
      await modelStorageService.storeModel({ ...record, editedAt: record.editedAt ?? (libraryRevision(record) || undefined) });
    },
  };
}

function statTemplatesCategory(bridge: ProfileMergeBridge): MergeCategory {
  return {
    key: MERGE_KEYS.statTemplates,
    label: 'Stat Templates',
    stamped: false,
    unit: 'items',
    target: async () => (await listUserTemplates()).map((template) => ({
      id: template.id,
      label: textOr(template.name, template.id),
      size: 0,
    })),
    source: () => sourceItems(bridge, MERGE_KEYS.statTemplates, () => undefined),
    copy: async (item) => {
      const template = readTemplate(await readRecord(bridge, MERGE_KEYS.statTemplates, item.id));
      if (!template) throw new Error('It isn’t a stat template');
      await saveUserTemplate(template);
    },
  };
}

function mascotImagesCategory(bridge: ProfileMergeBridge): MergeCategory {
  return {
    key: MERGE_KEYS.mascotImages,
    label: 'Mascot Images',
    stamped: false,
    unit: 'items',
    target: async () => (await listMascotImageIds()).map((id) => ({ id, label: id, size: 0 })),
    source: async () => (await sourceItems(bridge, MERGE_KEYS.mascotImages, () => undefined))
      .map((item, index) => ({ ...item, label: `Image ${index + 1}` })),
    copy: async (item) => {
      // Narrowed below: the reader sends whatever the AppData store holds.
      const { blob } = (await readRecord(bridge, MERGE_KEYS.mascotImages, item.id)) as unknown as { blob?: unknown };
      if (!(blob instanceof Blob)) throw new Error('Its file is missing');
      await putMascotImage(item.id, blob);
    },
  };
}

/** The categories that live in their own databases beside the library stores. */
export const localStoreCategories = (bridge: ProfileMergeBridge): MergeCategory[] => [
  statTemplatesCategory(bridge),
  mascotImagesCategory(bridge),
  avatarsCategory(bridge),
];
