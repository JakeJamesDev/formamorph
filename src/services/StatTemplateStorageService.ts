/**
 * Local library of author-written stat-code templates, plus the file format for sharing them.
 *
 * These are an authoring convenience, not world content: they live on the machine, span every world, and
 * never enter a world or save export. They also get their own database rather than a store inside
 * `worldsDB`, because adding a store there would mean a version bump that every open tab must allow.
 */

import { cachedConnection, promisifyRequest } from '@/lib/idb';
import { randomUUID } from '@/lib/uuid';
import { isBuiltInTemplate, readTemplate, type CodeTemplate } from '@/lib/statCodeTemplates';
import { APP_VERSION } from '@/lib/version';

const DB_NAME = 'statTemplatesDB';
const DB_VERSION = 1;
const STORE_NAME = 'templates';

/**
 * The shared-pack file. Two version fields, answering different questions: `formamorphTemplates` is the
 * file's own shape, which is what import validates and what only moves when the shape does, and
 * `appVersion` is the build that wrote it, for a human reading the file or a bug report quoting it.
 */
export interface StatTemplatePack {
  formamorphTemplates: number;
  appVersion: string;
  templates: CodeTemplate[];
}

/** Version 2 writes `kind` and `timings`. Import also reads version 1, whose entries carry one `timing`. */
export const TEMPLATE_PACK_VERSION = 2;

const connect = cachedConnection(DB_NAME, DB_VERSION, [{ name: STORE_NAME, keyPath: 'id' }]);

/** Every saved template, newest edits last as stored (the UI sorts by name). A version 1 row reads back in the
 *  version 2 shape; a row that is no template is left out. */
export async function listUserTemplates(): Promise<CodeTemplate[]> {
  const db = await connect();
  const store = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME);
  const stored = await promisifyRequest<unknown[]>(store.getAll());
  return stored.map(readTemplate).filter((template): template is CodeTemplate => template !== null);
}

/** Insert or update one template. A blank id means "new", and a built-in id is refused so a duplicated
 *  built-in can never shadow the bundled one it was copied from. */
export async function saveUserTemplate(template: CodeTemplate): Promise<CodeTemplate> {
  const stored: CodeTemplate = {
    ...template,
    id: template.id && !isBuiltInTemplate(template.id) ? template.id : randomUUID(),
  };
  const db = await connect();
  const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
  await promisifyRequest(store.put(stored));
  return stored;
}

export async function deleteUserTemplate(id: string): Promise<void> {
  const db = await connect();
  const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
  await promisifyRequest(store.delete(id));
}

/** Wrap templates in the shareable pack shape. */
export function buildTemplatePack(templates: CodeTemplate[]): StatTemplatePack {
  return { formamorphTemplates: TEMPLATE_PACK_VERSION, appVersion: APP_VERSION, templates };
}

/** Read a pack file's contents into templates, rejecting anything that isn't one. Entries are re-checked
 *  field by field because the file is user-supplied and may have been hand-edited. */
export function parseTemplatePack(json: string): CodeTemplate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }

  const pack = parsed as Partial<StatTemplatePack>;
  if (!pack || typeof pack !== 'object' || !Array.isArray(pack.templates)) {
    throw new Error('That file isn’t a Formamorph template pack.');
  }

  const templates = (pack.templates as unknown[]).map(readTemplate)
    .filter((entry): entry is CodeTemplate => entry !== null);

  if (templates.length === 0) throw new Error('That pack contains no templates.');

  return templates.map(entry => ({
    ...entry,
    id: entry.id && !isBuiltInTemplate(entry.id) ? entry.id : randomUUID(),
  }));
}

/**
 * Add a pack's templates to the local library. An incoming id that already names a *different* template
 * is re-issued rather than overwriting it, so importing a pack never silently replaces the author's own
 * work; an identical re-import is a no-op.
 */
export async function importTemplates(incoming: CodeTemplate[]): Promise<number> {
  const existing = await listUserTemplates();
  const byId = new Map(existing.map(template => [template.id, template]));
  let added = 0;

  for (const template of incoming) {
    const clash = byId.get(template.id);
    if (clash && clash.name === template.name && clash.code === template.code) continue;
    await saveUserTemplate(clash ? { ...template, id: randomUUID() } : template);
    added += 1;
  }

  return added;
}
