import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
  listUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
  buildTemplatePack,
  parseTemplatePack,
  importTemplates,
  TEMPLATE_PACK_VERSION,
} from './StatTemplateStorageService';
import { BUILT_IN_TEMPLATES, type StatCodeTemplate } from '@/lib/statCodeTemplates';
import { APP_VERSION } from '@/lib/version';

const template = (over: Partial<StatCodeTemplate> = {}): StatCodeTemplate => ({
  id: '',
  name: 'Mine',
  description: 'A local template',
  code: 'return {{n:number=1}};',
  timing: 'after',
  ...over,
});

describe('StatTemplateStorageService', () => {
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

  it('keeps a template in the box it was saved for', async () => {
    const saved = await saveUserTemplate(template({ name: 'Setup', timing: 'before' }));
    expect((await listUserTemplates()).find(t => t.id === saved.id)?.timing).toBe('before');
    await deleteUserTemplate(saved.id);
  });

  // Every template saved before the boxes split ran where the after box runs, so that is where it stays.
  it('reads a template stored without a timing as an after-the-AI one', async () => {
    const { timing: _dropped, ...noTiming } = template({ name: 'Older' });
    const saved = await saveUserTemplate(noTiming as StatCodeTemplate);
    expect(saved.timing).toBe('after');
    expect((await listUserTemplates()).find(t => t.id === saved.id)?.timing).toBe('after');
    await deleteUserTemplate(saved.id);
  });

  it('re-issues a built-in id so a duplicate can’t shadow the bundled template', async () => {
    const saved = await saveUserTemplate(template({ id: BUILT_IN_TEMPLATES[0].id, name: 'Copy' }));
    expect(saved.id).not.toBe(BUILT_IN_TEMPLATES[0].id);
    await deleteUserTemplate(saved.id);
  });

  it('round-trips a pack through build and parse', () => {
    const pack = buildTemplatePack([template({ id: 'abc' })]);
    expect(pack.formamorphTemplates).toBe(TEMPLATE_PACK_VERSION);
    // The build that wrote the file, beside the shape number import checks — the two answer different
    // questions, and a bare `1` in the file reads as the app's version to anyone opening it.
    expect(pack.appVersion).toBe(APP_VERSION);
    const parsed = parseTemplatePack(JSON.stringify(pack));
    expect(parsed).toEqual([template({ id: 'abc' })]);
    // A pack hand-edited down to the fields that existed before the boxes split still imports.
    const older = { formamorphTemplates: 1, appVersion: 'x', templates: [{ id: 'legacy', name: 'Old', code: 'return 1;' }] };
    expect(parseTemplatePack(JSON.stringify(older))[0].timing).toBe('after');
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
