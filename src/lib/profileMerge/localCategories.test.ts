// Node environment on purpose: jsdom's Blob does not survive fake-indexeddb's clone, Node's does.
// Must load before the services: their singletons open IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import modelStorageService from '@/services/ModelStorageService';
import { listUserTemplates, saveUserTemplate } from '@/services/StatTemplateStorageService';
import { getMascotImage, listMascotImageIds, putMascotImage } from '@/lib/formaquestion/mascotImageStore';
import { LEGACY_DEFAULT_AVATAR_ID } from '@/lib/defaultAvatar';
import { applyMerge, planMerge, snapshotsOf, type CategoryPlan } from './engine';
import { localStoreCategories } from './localCategories';
import type { ProfileMergeBridge, SourceSummary } from './bridge';

const OLD = '2026-01-01T00:00:00.000Z';
const NEW = '2026-06-01T00:00:00.000Z';

const wireBlob = (text: string, type: string) => ({ __blob: true, type, base64: btoa(text) });

/** An AppData profile held in memory: summaries and records per store, as the reader would send them. */
function fakeBridge(stores: Record<string, { summary: SourceSummary; record: unknown }[]>): ProfileMergeBridge {
  return {
    offer: async () => ({ merged: [] }),
    summaries: async (keys) => Object.fromEntries(keys.map((key) => [key, (stores[key] ?? []).map((row) => row.summary)])),
    record: async (key, id) => (stores[key] ?? []).find((row) => row.summary.id === id)?.record ?? null,
    later: async () => {},
    mark: async () => true,
    settings: async () => ({}),
    modelFolder: async () => ({ source: {}, target: {} }),
    fillModelFolder: async () => {},
    models: async () => ({ source: [], target: [] }),
    moveModel: async () => {},
    restart: async () => {},
  };
}

/** Plan and apply the three categories against the in-memory AppData profile. */
async function merge(bridge: ProfileMergeBridge) {
  const categories = localStoreCategories(bridge);
  const { source, target } = await snapshotsOf(categories);
  const plans = planMerge(categories, source, target);
  const results = await applyMerge(plans, categories);
  return { plans, results };
}

const planOf = (plans: CategoryPlan[], key: string) => plans.find((plan) => plan.key === key)!;
const ids = (items: { id: string }[]) => items.map((item) => item.id).sort();

const avatarRow = (id: string, stamp: { editedAt?: string; createdAt?: string }, bytes: string) => ({
  summary: { id, size: bytes.length, name: id, ...stamp },
  record: {
    id,
    name: id,
    ...stamp,
    data: { type: 'model/vrm', blob: wireBlob(bytes, 'model/vrm'), size: bytes.length },
  },
});

describe('Avatars', () => {
  it('replaces a folder Avatar with a newer AppData copy, and a repeat run replaces nothing', async () => {
    await modelStorageService.storeModel({
      id: 'av-newer', name: 'Newer', createdAt: OLD, data: { type: 'model/vrm', blob: new Blob(['old']), size: 3 },
    });
    const bridge = fakeBridge({ avatars: [avatarRow('av-newer', { editedAt: NEW }, 'newer-file')] });

    const first = await merge(bridge);
    expect(ids(planOf(first.plans, 'avatars').replace)).toEqual(['av-newer']);
    expect((await modelStorageService.getModelData('av-newer')).size).toBe('newer-file'.length);

    const second = await merge(bridge);
    expect(planOf(second.plans, 'avatars').replace).toEqual([]);
    expect(ids(planOf(second.plans, 'avatars').keep)).toEqual(['av-newer']);
  });

  it('ties on a repeat run when the newer AppData copy carries only a creation stamp', async () => {
    await modelStorageService.storeModel({
      id: 'av-created', name: 'Created', createdAt: OLD, data: { type: 'model/vrm', blob: new Blob(['old']), size: 3 },
    });
    const bridge = fakeBridge({ avatars: [avatarRow('av-created', { createdAt: NEW }, 'created-file')] });

    expect(ids(planOf((await merge(bridge)).plans, 'avatars').replace)).toEqual(['av-created']);
    expect(planOf((await merge(bridge)).plans, 'avatars').replace).toEqual([]);
  });

  it('keeps the folder Avatar on an equal stamp and on a missing stamp', async () => {
    await modelStorageService.storeModel({
      id: 'av-tie', name: 'Tie', createdAt: OLD, editedAt: OLD, data: { type: 'model/vrm', blob: new Blob(['mine']), size: 4 },
    });
    await modelStorageService.storeModel({
      id: 'av-bare', name: 'Bare', createdAt: OLD, data: { type: 'model/vrm', blob: new Blob(['mine']), size: 4 },
    });
    const bridge = fakeBridge({ avatars: [avatarRow('av-tie', { editedAt: OLD }, 'theirs-1'), avatarRow('av-bare', {}, 'theirs-2')] });

    const { plans } = await merge(bridge);
    expect(ids(planOf(plans, 'avatars').keep)).toEqual(['av-bare', 'av-tie']);
    expect((await modelStorageService.getModelData('av-tie')).size).toBe(4);
    expect((await modelStorageService.getModelData('av-bare')).size).toBe(4);
  });

  it('copies a missing Avatar with its file, and leaves the retired default out of the plan', async () => {
    const bridge = fakeBridge({
      avatars: [avatarRow('av-new', { createdAt: OLD }, 'fresh-file'), avatarRow(LEGACY_DEFAULT_AVATAR_ID, { createdAt: OLD }, 'elaina')],
    });

    const { plans } = await merge(bridge);
    const plan = planOf(plans, 'avatars');
    expect(ids(plan.add)).toEqual(['av-new']);
    expect([...plan.add, ...plan.replace, ...plan.keep].some((item) => item.id === LEGACY_DEFAULT_AVATAR_ID)).toBe(false);
    const data = await modelStorageService.getModelData('av-new');
    expect(data.size).toBe('fresh-file'.length);
    expect(data.blob.size).toBe('fresh-file'.length);
  });

  it('copies a record from before the library wrapper', async () => {
    const bridge = fakeBridge({
      avatars: [{
        summary: { id: 'av-flat', size: 4, name: 'Flat' },
        record: { id: 'av-flat', name: 'Flat', blob: wireBlob('flat', 'model/vrm'), addedAt: OLD },
      }],
    });

    const { results } = await merge(bridge);
    expect(results.find((r) => r.key === 'avatars')!.skipped).toEqual([]);
    expect((await modelStorageService.getModelData('av-flat')).blob.size).toBe(4);
  });
});

describe('stat templates and Mascot images fill only what the folder lacks', () => {
  // The AppData summaries carry newer stamps on purpose: a stamped rule would replace the folder's copy.
  const stamped = (id: string): SourceSummary => ({ id, size: 5, name: id, editedAt: NEW, createdAt: NEW });

  it('keeps a stat template the folder holds and copies a missing one', async () => {
    const mine = await saveUserTemplate({
      id: 'tpl-mine', name: 'Mine', description: '', code: 'return 1;', kind: 'script', timings: ['after'],
    });
    const theirs = (id: string, code: string) => ({
      summary: stamped(id), record: { id, name: id, code, kind: 'script', timings: ['after'] },
    });
    const bridge = fakeBridge({ statTemplates: [theirs('tpl-mine', 'return 99;'), theirs('tpl-fresh', 'return 2;')] });

    const { plans } = await merge(bridge);
    const plan = planOf(plans, 'statTemplates');
    expect(ids(plan.add)).toEqual(['tpl-fresh']);
    expect(ids(plan.keep)).toEqual(['tpl-mine']);
    expect(plan.replace).toEqual([]);

    const held = await listUserTemplates();
    expect(held.find((t) => t.id === mine.id)!.code).toBe('return 1;');
    expect(held.find((t) => t.id === 'tpl-fresh')!.code).toBe('return 2;');
  });

  it('keeps a Mascot image the folder holds and copies a missing one with its bytes', async () => {
    await putMascotImage('img-mine', new Blob(['mine'], { type: 'image/png' }));
    const row = (id: string, bytes: string) => ({
      summary: stamped(id), record: { id, blob: wireBlob(bytes, 'image/webp') },
    });
    const bridge = fakeBridge({ mascotImages: [row('img-mine', 'theirs-overwrite'), row('img-fresh', 'fresh!')] });

    const { plans } = await merge(bridge);
    const plan = planOf(plans, 'mascotImages');
    expect(ids(plan.add)).toEqual(['img-fresh']);
    expect(ids(plan.keep)).toEqual(['img-mine']);
    expect(plan.replace).toEqual([]);

    expect((await getMascotImage('img-mine'))!.size).toBe(4);
    const fresh = (await getMascotImage('img-fresh'))!;
    expect(fresh.size).toBe(6);
    expect(fresh.type).toBe('image/webp');
    expect(await listMascotImageIds()).toEqual(expect.arrayContaining(['img-mine', 'img-fresh']));
  });
});
