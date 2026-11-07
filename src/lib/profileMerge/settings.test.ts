import { beforeEach, describe, expect, it } from 'vitest';
import { applyMerge, planMerge, snapshotsOf, type MergeCategory } from './engine';
import type { ModelFolderField, ModelFolderFields, ProfileMergeBridge } from './bridge';
import { SETTINGS_CACHE_KEYS, modelFolderCategory, settingsCategory } from './settings';

/** A bridge whose AppData side is the given localStorage entries and model-folder fields. */
function fakeBridge(source: { settings?: Record<string, string>; modelFolder?: ModelFolderFields }, folderFields: ModelFolderFields = {}) {
  const filled: ModelFolderField[] = [];
  const target = { ...folderFields };
  const bridge = {
    settings: async () => source.settings ?? {},
    modelFolder: async () => ({ source: source.modelFolder ?? {}, target: { ...target } }),
    fillModelFolder: async (field: ModelFolderField) => {
      // The main process fills only a field the folder lacks.
      if (field in target) return;
      const value = source.modelFolder?.[field];
      if (value !== undefined) target[field] = value;
      filled.push(field);
    },
  } as unknown as ProfileMergeBridge;
  return { bridge, target, filled };
}

/** A Map-backed Storage: the folder's localStorage. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => map.clear(),
  };
}

let folder: Storage;
beforeEach(() => { folder = memoryStorage(); });

async function runMerge(category: MergeCategory) {
  const { source, target } = await snapshotsOf([category]);
  const plans = planMerge([category], source, target);
  return { plans, results: await applyMerge(plans, [category]) };
}

describe('settings and sign-in', () => {
  it('keeps a key the folder holds and copies a key only the AppData profile holds', async () => {
    folder.setItem('FORMAMORPH_endpointUrl', 'http://folder:1234');
    const { bridge } = fakeBridge({
      settings: { FORMAMORPH_endpointUrl: 'http://appdata:5678', FORMAMORPH_modelName: 'gemma' },
    });
    const { plans, results } = await runMerge(settingsCategory(bridge, folder));
    expect(plans[0].add.map((i) => i.id)).toEqual(['FORMAMORPH_modelName']);
    expect(plans[0].replace).toEqual([]);
    expect(folder.getItem('FORMAMORPH_endpointUrl')).toBe('http://folder:1234');
    expect(folder.getItem('FORMAMORPH_modelName')).toBe('gemma');
    expect(results[0]).toMatchObject({ added: 1, replaced: 0, kept: 1 });
  });

  it('signs a signed-out folder in with a signed-in AppData copy', async () => {
    const { bridge } = fakeBridge({ settings: { authToken: 'token-a', currentUser: '{"name":"Ann"}' } });
    await runMerge(settingsCategory(bridge, folder));
    expect(folder.getItem('authToken')).toBe('token-a');
    expect(folder.getItem('currentUser')).toBe('{"name":"Ann"}');
  });

  it('keeps a signed-in folder signed in as itself', async () => {
    folder.setItem('authToken', 'token-folder');
    const { bridge } = fakeBridge({ settings: { authToken: 'token-a', currentUser: '{"name":"Ann"}' } });
    await runMerge(settingsCategory(bridge, folder));
    expect(folder.getItem('authToken')).toBe('token-folder');
  });

  it('leaves the caches behind', async () => {
    const caches = Object.fromEntries(SETTINGS_CACHE_KEYS.map((key) => [key, 'cached']));
    const { bridge } = fakeBridge({ settings: { ...caches, FORMAMORPH_modelName: 'gemma' } });
    const { plans } = await runMerge(settingsCategory(bridge, folder));
    expect(plans[0].add.map((i) => i.id)).toEqual(['FORMAMORPH_modelName']);
    for (const key of SETTINGS_CACHE_KEYS) expect(folder.getItem(key)).toBeNull();
  });

  it('copies device identity and window layout, which are not caches', async () => {
    const { bridge } = fakeBridge({
      settings: { FORMAMORPH_hostedAiDevice: 'dev-1', 'formamorph.formaquestion.window': '{"x":1}' },
    });
    await runMerge(settingsCategory(bridge, folder));
    expect(folder.getItem('FORMAMORPH_hostedAiDevice')).toBe('dev-1');
    expect(folder.getItem('formamorph.formaquestion.window')).toBe('{"x":1}');
  });

  it('plans a value that differs as kept, never replaced', async () => {
    folder.setItem('FORMAMORPH_modelName', 'folder');
    const { bridge } = fakeBridge({ settings: { FORMAMORPH_modelName: 'appdata' } });
    const { plans } = await runMerge(settingsCategory(bridge, folder));
    expect(plans[0]).toMatchObject({ add: [], replace: [] });
    expect(plans[0].keep).toHaveLength(1);
  });
});

describe('merge order', () => {
  it('runs settings, then the model folder, ahead of a category with bytes', async () => {
    const { bridge } = fakeBridge({ settings: { a: 'x'.repeat(500) }, modelFolder: { downloadDir: 'D:/Models' } });
    const heavy: MergeCategory = {
      key: 'worlds', label: 'Worlds', stamped: true, unit: 'items',
      source: async () => [{ id: 'w', label: 'w', size: 1 }],
      target: async () => [],
      copy: async () => {},
    };
    const categories = [heavy, settingsCategory(bridge, folder), modelFolderCategory(bridge)];
    const { source, target } = await snapshotsOf(categories);
    expect(planMerge(categories, source, target).map((plan) => plan.key)).toEqual(['settings', 'modelFolder', 'worlds']);
  });
});

describe('model-folder choice', () => {
  it("keeps the folder's choice", async () => {
    const { bridge, target } = fakeBridge({ modelFolder: { downloadDir: 'D:\\Models' } }, { downloadDir: 'F:\\Mine' });
    const { plans } = await runMerge(modelFolderCategory(bridge));
    expect(plans[0].add).toEqual([]);
    expect(target.downloadDir).toBe('F:\\Mine');
  });

  it('takes the AppData value for each field the folder lacks', async () => {
    const { bridge, target, filled } = fakeBridge(
      { modelFolder: { downloadDir: 'D:\\Models', externalDir: 'E:\\Lm', searchSubfolders: false } },
      { externalDir: 'F:\\Mine' },
    );
    const { results } = await runMerge(modelFolderCategory(bridge));
    expect(filled.sort()).toEqual(['downloadDir', 'searchSubfolders']);
    expect(target).toEqual({ downloadDir: 'D:\\Models', externalDir: 'F:\\Mine', searchSubfolders: false });
    expect(results[0]).toMatchObject({ added: 2, kept: 1 });
  });

  it('plans nothing when the AppData profile sets no field', async () => {
    const { bridge } = fakeBridge({});
    const { plans } = await runMerge(modelFolderCategory(bridge));
    expect(plans[0]).toMatchObject({ add: [], replace: [], keep: [] });
  });
});
