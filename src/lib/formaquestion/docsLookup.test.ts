import { describe, expect, it } from 'vitest';
import { createDocsIndex, type DocSection } from '@/lib/docs/docsIndex';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import { toolsOfferedTo } from '@/lib/tools/toolOffer';
import { toolSchema } from '@/lib/tools/toolSchema';
import { createDocsLookup, DOCS_LOOKUP, type DocsLookupOptions } from './docsLookup';

/** A paragraph list long enough that the index splits its section into parts. */
const LONG_STEPS = Array.from({ length: 140 }, (_, n) => `- Folder rule ${n}: a folder holds worlds and saves.`).join('\n');

const PAGES = {
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## How to Add a Stat\n\n1. Open the **Stats** tab.\n2. Select **Add Stat**.\n\n## How to Remove a Stat\n\n1. Select **Remove**.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n\n## 🧭 Why It Exists\n\nTraits give an entity a shape.\n',
  Library: `# 📚 Library\n\nThe library holds worlds.\n\n## How to Import a World\n\n1. Select **Import**.\n\n## Folder Rules\n\n${LONG_STEPS}\n`,
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n- [Traits](Traits)\n- [Library](Library)\n' });

const lookup = (options: DocsLookupOptions = {}) => createDocsLookup(index, options);
const call = async (docs: ReturnType<typeof lookup>, args: unknown) =>
  docs.execute(DOCS_LOOKUP, typeof args === 'string' ? args : JSON.stringify(args));
const ids = (sections: readonly DocSection[]) => sections.map((section) => section.id);

describe('the docs lookup function', () => {
  it('is no Tool: the catalog does not hold it, and no Tool is offered to the help prompt', () => {
    expect(TOOL_CATALOG.map((tool) => tool.id)).not.toContain(DOCS_LOOKUP.id);
    expect(TOOL_CATALOG.map((tool) => tool.name)).not.toContain(DOCS_LOOKUP.name);
    const allOn = Object.fromEntries(TOOL_CATALOG.map((tool) => [tool.id, true]));
    expect(toolsOfferedTo('help', TOOL_CATALOG, allOn, true)).toEqual([]);
  });

  it('takes section ids or search words, both optional text', () => {
    expect(toolSchema(DOCS_LOOKUP).function.parameters).toEqual({
      type: 'object',
      properties: {
        sections: { type: 'string', description: expect.any(String) },
        search: { type: 'string', description: expect.any(String) },
      },
      required: [],
      additionalProperties: false,
    });
  });
});

describe('a section id the model has seen', () => {
  it('returns its section, for every section of the guide', async () => {
    const shown = index.contents().flatMap((page) => page.sections.map((section) => section.id));
    expect(shown.length).toBeGreaterThan(6);
    for (const id of shown) {
      const docs = lookup();
      const result = await call(docs, { sections: id });
      expect(ids(docs.fetched())[0], id).toBe(id);
      expect(result.text, id).toContain(`<section id="${id}">`);
    }
  });
});

describe('a call with section ids', () => {
  it('returns the text of each section, in the order asked', async () => {
    const docs = lookup();
    const result = await call(docs, { sections: 'Traits#how-to-add-a-trait, Stats#how-to-add-a-stat' });
    expect(result.failure).toBeUndefined();
    const trait = result.text.indexOf('1. Open the **Traits** tab.\n2. Select **Add Trait**.');
    const stat = result.text.indexOf('1. Open the **Stats** tab.\n2. Select **Add Stat**.');
    expect(trait).toBeGreaterThan(-1);
    expect(stat).toBeGreaterThan(trait);
    expect(result.text).toContain('<section id="Traits#how-to-add-a-trait">');
    expect(ids(docs.fetched())).toEqual(['Traits#how-to-add-a-trait', 'Stats#how-to-add-a-stat']);
  });

  it('returns every part of a split section', async () => {
    const docs = lookup({ budget: 100_000 });
    const result = await call(docs, { sections: 'Library#folder-rules' });
    expect(result.text).toContain('Folder rule 0:');
    expect(result.text).toContain('Folder rule 139:');
    expect(ids(docs.fetched())).toEqual(ids(index.get(['Library#folder-rules'])));
  });

  it.each([
    ['another letter case', 'traits#How-To-Add-A-Trait', 'Traits#how-to-add-a-trait'],
    ['the heading as the guide prints it', 'Traits: How to Add a Trait', 'Traits#how-to-add-a-trait'],
    ['a space before the #', 'Traits #how-to-add-a-trait', 'Traits#how-to-add-a-trait'],
    ['quotes around the id', '"Traits#how-to-add-a-trait"', 'Traits#how-to-add-a-trait'],
    ['the section name alone, when one page has it', 'how-to-add-a-trait', 'Traits#how-to-add-a-trait'],
    ['a heading with a symbol, without its leading hyphen', 'Traits#why-it-exists', 'Traits#-why-it-exists'],
  ])('reads an id written with %s', async (_name, written, id) => {
    const docs = lookup();
    const result = await call(docs, { sections: written });
    expect(result.failure).toBeUndefined();
    expect(ids(docs.fetched())).toEqual([id]);
    expect(result.text).toContain(index.get([id])[0].markdown);
  });

  it('reads a list of ids as well as text', async () => {
    const docs = lookup();
    await call(docs, { sections: ['Stats#how-to-add-a-stat', 'Stats#how-to-remove-a-stat'] });
    expect(ids(docs.fetched())).toEqual(['Stats#how-to-add-a-stat', 'Stats#how-to-remove-a-stat']);
  });

  it('returns the first section of a page for the page name alone', async () => {
    // The page's title differs from its name, so the name is no section name.
    const home = createDocsIndex({ pages: { Home: '# 🧬 Formamorph Wiki\n\nStart here.\n\n## Where to Go\n\nRead the pages.\n' } });
    const docs = createDocsLookup(home);
    const result = await docs.execute(DOCS_LOOKUP, JSON.stringify({ sections: 'home' }));
    expect(ids(docs.fetched())).toEqual(['Home#-formamorph-wiki']);
    expect(result.text).toContain('Start here.');
  });
});

describe('an unknown section id', () => {
  it('gets a result that names it and lists the ids near it on its page, and the function stays offered', async () => {
    const docs = lookup();
    const result = await call(docs, { sections: 'Stats#how-to-delete-a-stat' });
    expect(result.failure).toBeUndefined();
    expect(result.text).toContain('"Stats#how-to-delete-a-stat"');
    // The two sections that share the most words come first.
    expect(result.text).toMatch(/Stats#how-to-(add|remove)-a-stat, Stats#how-to-(add|remove)-a-stat/);
    expect(result.text).not.toContain('Traits#');
    expect(docs.fetched()).toEqual([]);
  });

  it('lists the ids of its page that share the most words first, and no more than five', async () => {
    const headings = ['Colors', 'Fonts', 'Sounds', 'Layout', 'Language', 'Shortcuts', 'How to Reset a Setting', 'How to Export a Setting'];
    const settings = createDocsIndex({ pages: { Settings: ['# Settings', ...headings.map((heading) => `## ${heading}\n\nText.`)].join('\n\n') } });
    const result = await createDocsLookup(settings).execute(DOCS_LOOKUP, JSON.stringify({ sections: 'Settings#how-to-restore-a-setting' }));
    const listed = result.text.match(/Settings#[\w-]+/g)?.slice(1);
    expect(listed).toEqual(['Settings#how-to-reset-a-setting', 'Settings#how-to-export-a-setting', 'Settings#settings', 'Settings#colors', 'Settings#fonts']);
  });

  it('gets the ids that match its words when its page is unknown too', async () => {
    const result = await call(lookup(), { sections: 'Worlds#import-a-world' });
    expect(result.text).toContain('"Worlds#import-a-world"');
    expect(result.text).toContain('Library#how-to-import-a-world');
  });

  it('names no near id when nothing in the guide is near', async () => {
    const result = await call(lookup(), { sections: 'Quasar#zxqv' });
    expect(result.failure).toBeUndefined();
    expect(result.text).toContain('"Quasar#zxqv"');
    expect(result.text).not.toMatch(/#how-to|Stats|Traits|Library/);
  });

  it('does not stop the known ids of the same call', async () => {
    const docs = lookup();
    const result = await call(docs, { sections: 'Stats#nope, Traits#how-to-add-a-trait' });
    expect(result.text).toContain('2. Select **Add Trait**.');
    expect(result.text).toContain('"Stats#nope"');
    expect(ids(docs.fetched())).toEqual(['Traits#how-to-add-a-trait']);
  });

  it('is unknown when two pages have the section name and the call names no page', async () => {
    const twoPages = createDocsIndex({ pages: { A: '# A\n\n## Setup\n\nA setup.\n', B: '# B\n\n## Setup\n\nB setup.\n' } });
    const docs = createDocsLookup(twoPages);
    const result = await docs.execute(DOCS_LOOKUP, JSON.stringify({ sections: 'setup' }));
    expect(docs.fetched()).toEqual([]);
    expect(result.text).toContain('A#setup');
    expect(result.text).toContain('B#setup');
  });
});

describe('a call with search words', () => {
  it('returns the sections that match, best first', async () => {
    const docs = lookup();
    const result = await call(docs, { search: 'import world' });
    expect(result.failure).toBeUndefined();
    expect(ids(docs.fetched())[0]).toBe('Library#how-to-import-a-world');
    expect(ids(docs.fetched())).toEqual(ids(index.search('import world', docs.fetched().length)));
    expect(result.text).toContain('1. Select **Import**.');
  });

  it('holds at most the given count of sections, whatever the request already holds', async () => {
    const held = index.get(['Library#how-to-import-a-world']);
    const docs = lookup({ searchLimit: 2, budget: 100_000, held });
    await call(docs, { search: 'stat trait' });
    expect(index.search('stat trait', 9).length).toBeGreaterThan(2);
    expect(docs.fetched()).toHaveLength(2);
  });

  it('says so when no section matches', async () => {
    const docs = lookup();
    const result = await call(docs, { search: 'quasar' });
    expect(result.failure).toBeUndefined();
    expect(result.text).toContain('"quasar"');
    expect(docs.fetched()).toEqual([]);
  });
});

describe('what one question can fetch', () => {
  it('leaves out a section that takes the fetched text over the budget, and names it', async () => {
    const [add, remove] = index.get(['Stats#how-to-add-a-stat', 'Stats#how-to-remove-a-stat']);
    const docs = lookup({ budget: add.markdown.length + remove.markdown.length - 1 });
    const result = await call(docs, { sections: 'Stats#how-to-add-a-stat, Stats#how-to-remove-a-stat' });
    expect(ids(docs.fetched())).toEqual(['Stats#how-to-add-a-stat']);
    expect(result.text).not.toContain(remove.markdown);
    expect(result.text).toContain('Stats#how-to-remove-a-stat');
  });

  it('returns the parts of a split section from the first one, and never a later part alone', async () => {
    const parts = index.get(['Library#folder-rules']);
    const last = parts.at(-1)!;
    expect(last.markdown.length).toBeLessThan(parts[0].markdown.length);
    // Room for the last part, and not for the first.
    const docs = lookup({ budget: last.markdown.length });
    const result = await call(docs, { sections: 'Library#folder-rules' });
    expect(docs.fetched()).toEqual([]);
    expect(result.text).not.toContain('<section ');
    for (const part of parts) expect(result.text).toContain(part.id);
  });

  it('counts the budget over every call of the question', async () => {
    const [add, remove] = index.get(['Stats#how-to-add-a-stat', 'Stats#how-to-remove-a-stat']);
    const docs = lookup({ budget: add.markdown.length + remove.markdown.length - 1 });
    await call(docs, { sections: 'Stats#how-to-add-a-stat' });
    const second = await call(docs, { sections: 'Stats#how-to-remove-a-stat' });
    expect(second.text).not.toContain(remove.markdown);
    expect(ids(docs.fetched())).toEqual(['Stats#how-to-add-a-stat']);
  });

  it('does not return a section twice', async () => {
    const docs = lookup();
    const first = await call(docs, { sections: 'Stats#how-to-add-a-stat' });
    const second = await call(docs, { sections: 'Stats#how-to-add-a-stat' });
    expect(first.text).toContain('2. Select **Add Stat**.');
    expect(second.text).not.toContain('2. Select **Add Stat**.');
    expect(second.text).toContain('Stats#how-to-add-a-stat');
    expect(docs.fetched()).toHaveLength(1);
  });

  it('does not return a section the request already holds', async () => {
    const held = index.get(['Traits#how-to-add-a-trait']);
    const docs = lookup({ held });
    const result = await call(docs, { sections: 'Traits#how-to-add-a-trait' });
    expect(result.text).not.toContain('2. Select **Add Trait**.');
    expect(result.text).toContain('Traits#how-to-add-a-trait');
    expect(docs.fetched()).toEqual([]);
  });

  it('skips a held section in a search and returns the next match in its place', async () => {
    const [best, next] = index.search('add stat', 2);
    const docs = lookup({ held: [best], searchLimit: 1 });
    await call(docs, { search: 'add stat' });
    expect(ids(docs.fetched())).toEqual([next.id]);
  });
});

describe('a call the function cannot read', () => {
  it.each([
    ['text that is not JSON', '{"sections": '],
    ['a JSON value that is not an object', '["Stats"]'],
    ['the JSON value null', 'null'],
    ['no sections and no search words', {}],
    ['blank values', { sections: '  ', search: '' }],
    ['a number for the ids', { sections: 4 }],
  ])('fails as an arguments error for %s', async (_name, args) => {
    const docs = lookup();
    const result = await call(docs, args);
    expect(result.failure).toBe('arguments');
    expect(JSON.parse(result.text)).toEqual({ error: expect.any(String) });
    expect(docs.fetched()).toEqual([]);
  });
});
