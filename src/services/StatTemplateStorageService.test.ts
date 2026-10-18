import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import {
  listUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
  buildTemplatePack,
  parseTemplatePack,
  importTemplates,
} from './StatTemplateStorageService';
import { BUILT_IN_TEMPLATES, type CodeTemplate } from '@/lib/statCodeTemplates';
import { cachedConnection, promisifyRequest } from '@/lib/idb';
import { APP_VERSION } from '@/lib/version';

const template = (over: Partial<Omit<Extract<CodeTemplate, { kind: 'script' }>, 'kind'>> = {}): CodeTemplate => ({
  id: '',
  kind: 'script',
  name: 'Mine',
  description: 'A local template',
  code: 'return {{n:number=1}};',
  timings: ['after'],
  ...over,
});

/** Writes `row` into the library's store as is, as an older app left it. */
async function storeRaw(row: object): Promise<void> {
  const db = await cachedConnection('statTemplatesDB', 1, [{ name: 'templates', keyPath: 'id' }])();
  await promisifyRequest(db.transaction(['templates'], 'readwrite').objectStore('templates').put(row));
}

describe('StatTemplateStorageService', () => {
  it('retries the open on the next call after the first open fails', async () => {
    vi.resetModules();
    const fresh = await import('./StatTemplateStorageService');
    const real = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      const request = {} as IDBOpenDBRequest;
      queueMicrotask(() => {
        Object.defineProperty(request, 'error', { value: new DOMException('open failed', 'AbortError') });
        request.onerror?.(new Event('error'));
      });
      return request;
    }).mockImplementation(real);
    try {
      await expect(fresh.listUserTemplates()).rejects.toThrow('open failed');
      await expect(fresh.listUserTemplates()).resolves.toEqual(expect.any(Array));
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('saves, lists and deletes a template', async () => {
    const saved = await saveUserTemplate(template({ name: 'First' }));
    expect(saved.id).not.toBe('');
    expect(await listUserTemplates()).toContainEqual(saved);

    await saveUserTemplate({ ...saved, name: 'Renamed' });
    const listed = (await listUserTemplates()).filter(t => t.id === saved.id);
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('Renamed');

    await deleteUserTemplate(saved.id);
    expect((await listUserTemplates()).some(t => t.id === saved.id)).toBe(false);
  });

  it('keeps every timing a template was saved with', async () => {
    const saved = await saveUserTemplate(template({ name: 'Setup', timings: ['before', 'start'] }));
    expect((await listUserTemplates()).find(t => t.id === saved.id)?.timings).toEqual(['before', 'start']);
    await deleteUserTemplate(saved.id);
  });

  // A version 1 row holds one `timing`, or none from before the boxes split; any but `before` ran in the after box.
  it.each([
    ['before', ['before']],
    ['after', ['after']],
    ['output', ['after']],
    [undefined, ['after']],
  ] as const)('reads a stored version 1 row with timing %s as a stat script', async (timing, timings) => {
    const id = `v1-${timing}`;
    await storeRaw({ id, name: 'Older', description: 'd', code: 'return 1;', ...(timing && { timing }) });
    const expected = { id, kind: 'script', name: 'Older', description: 'd', code: 'return 1;', timings };
    const listed = (await listUserTemplates()).find(t => t.id === id);
    expect(listed).toEqual(expected);
    // A second read, and a save of what came back, give the same template.
    await saveUserTemplate(listed!);
    expect((await listUserTemplates()).find(t => t.id === id)).toEqual(expected);
    await deleteUserTemplate(id);
  });

  it('re-issues a built-in id so a duplicate can’t shadow the bundled template', async () => {
    const saved = await saveUserTemplate(template({ id: BUILT_IN_TEMPLATES[0].id, name: 'Copy' }));
    expect(saved.id).not.toBe(BUILT_IN_TEMPLATES[0].id);
    await deleteUserTemplate(saved.id);
  });

  it('round-trips a version 2 pack through export and import', async () => {
    for (const existing of await listUserTemplates()) await deleteUserTemplate(existing.id);
    const mixed: CodeTemplate[] = [
      template({ id: 'abc', timings: ['before', 'after', 'switch'] }),
      { id: 'tool', kind: 'worldTool', name: 'Roll', description: '', code: 'return 1;', timings: ['call', 'after'] },
      { id: 'world', kind: 'worldScript', name: 'Start', description: '', code: 'location.move("Inn");', timings: ['start', 'switch'] },
    ];
    const pack = buildTemplatePack(mixed);
    expect(pack.formamorphTemplates).toBe(2);
    // The build that wrote the file, beside the shape number import checks — the two answer different
    // questions, and a bare `1` in the file reads as the app's version to anyone opening it.
    expect(pack.appVersion).toBe(APP_VERSION);
    const file = JSON.stringify(pack);
    // Version 2 writes the list and never the one timing.
    expect(JSON.parse(file).templates.every((entry: object) => !('timing' in entry))).toBe(true);
    expect(await importTemplates(parseTemplatePack(file))).toBe(3);
    expect(await listUserTemplates()).toEqual(expect.arrayContaining(mixed));
    for (const existing of await listUserTemplates()) await deleteUserTemplate(existing.id);
  });

  it('imports a version 1 pack as stat scripts', () => {
    const older = {
      formamorphTemplates: 1, appVersion: 'x', templates: [
        { id: 'a', name: 'Setup', description: '', code: 'return 1;', timing: 'before' },
        { id: 'b', name: 'Drain', description: '', code: 'return 2;', timing: 'after' },
        { id: 'c', name: 'Oldest', code: 'return 3;' },
      ],
    };
    expect(parseTemplatePack(JSON.stringify(older)).map(({ id, kind, timings }) => ({ id, kind, timings }))).toEqual([
      { id: 'a', kind: 'script', timings: ['before'] },
      { id: 'b', kind: 'script', timings: ['after'] },
      { id: 'c', kind: 'script', timings: ['after'] },
    ]);
  });

  it('drops a hand-edited version 2 entry with an unknown kind or no timing of its kind', () => {
    const pack = {
      formamorphTemplates: 2, appVersion: 'x', templates: [
        { id: 'k', kind: 'trait', name: 'K', code: 'return 1;', timings: ['after'] },
        { id: 'e', kind: 'script', name: 'E', code: 'return 1;', timings: [] },
        { id: 'w', kind: 'worldTool', name: 'W', code: 'return 1;', timings: ['before'] },
        { id: 'ok', kind: 'script', name: 'Ok', code: 'return 1;', timings: ['switch', 'call', 'before'] },
      ],
    };
    expect(parseTemplatePack(JSON.stringify(pack))).toEqual([
      { id: 'ok', kind: 'script', name: 'Ok', description: '', code: 'return 1;', timings: ['before', 'switch'] },
    ]);
  });

  it('rejects malformed pack files', () => {
    expect(() => parseTemplatePack('not json')).toThrow(/valid JSON/);
    expect(() => parseTemplatePack('{"nope":1}')).toThrow(/template pack/);
    expect(() => parseTemplatePack('{"formamorphTemplates":1,"templates":[{"name":"no code"}]}')).toThrow(/no templates/);
  });

  it('fills in a missing description rather than dropping the template', () => {
    const parsed = parseTemplatePack('{"formamorphTemplates":1,"templates":[{"id":"x","name":"N","code":"return 1;"}]}');
    expect(parsed[0].description).toBe('');
  });

  it('imports new templates, skips identical re-imports, and re-ids a genuine clash', async () => {
    for (const existing of await listUserTemplates()) await deleteUserTemplate(existing.id);

    const incoming = [template({ id: 'shared', name: 'Packed' })];
    expect(await importTemplates(incoming)).toBe(1);

    // The same pack again is already present, so nothing is added or duplicated.
    expect(await importTemplates(incoming)).toBe(0);
    expect(await listUserTemplates()).toHaveLength(1);

    // A different template claiming the same id must not overwrite the author's own.
    expect(await importTemplates([template({ id: 'shared', name: 'Impostor', code: 'return 2;' })])).toBe(1);
    const all = await listUserTemplates();
    expect(all).toHaveLength(2);
    expect(all.find(t => t.id === 'shared')?.name).toBe('Packed');
  });
});
