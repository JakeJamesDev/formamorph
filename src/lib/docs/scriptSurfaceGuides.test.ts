import { describe, expect, it } from 'vitest';
import {
  DICTIONARY_ENTRY_FIELDS, DICTIONARY_FIELDS, ENTITY_FIELDS, LOCATION_ENTRY_FIELDS, LOCATION_MEMBERS, MEMORY_ENTRY_FIELDS, MEMORY_MEMBERS,
  PERSONA_FIELDS,
} from '@/lib/statCodeSurface';
import type { SurfaceEntry } from '@/lib/codeSurface';
import { BUNDLED_DOCS, bundledDocsIndex } from './bundledDocsIndex';

/**
 * The Script Surface spec's paths against the guide text: each field and verb of the surface has a row with a
 * help line in the section that explains its global, and no guide names a retired form outside the one section
 * that tells a Tool author how old scripts move.
 */
const sectionMarkdown = (id: string): string => {
  const [section] = bundledDocsIndex().get([id]);
  if (!section) throw new Error(`${id} is missing`);
  return section.markdown;
};

/** The first-cell name and the help cell of each table row in `markdown`. */
function tableRows(markdown: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of markdown.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const name = /^`(\w+)[^`]*`/.exec(cells[0] ?? '')?.[1];
    if (name && cells[1]) rows.set(name, cells[1]);
  }
  return rows;
}

/** The heading that names old forms on purpose, so a Tool author can match them to the new ones. */
const MIGRATION = /#### Moving an Old Script to the New Names[\s\S]*?(?=\n#{1,3} |$)/;

const names = (entries: readonly SurfaceEntry[]) => entries.map((entry) => entry.name);

const SURFACE: ReadonlyArray<[string, string, readonly string[]]> = [
  ['locations and location', 'ScriptsGuide#location', [...names(LOCATION_ENTRY_FIELDS), ...names(LOCATION_MEMBERS)]],
  ['entity entries', 'ScriptsGuide#entities', names(ENTITY_FIELDS)],
  ['persona', 'ScriptsGuide#persona', names(PERSONA_FIELDS).filter((name) => name === 'name' || name === 'traits' || name === 'placeholders' || name === 'stats')],
  ['memories', 'ScriptsGuide#memory', [...names(MEMORY_ENTRY_FIELDS), ...names(MEMORY_MEMBERS)]],
  ['dictionaries', 'ScriptsGuide#dictionaries', [...names(DICTIONARY_FIELDS), ...names(DICTIONARY_ENTRY_FIELDS)]],
];

describe('the Scripts Guide', () => {
  it.each(SURFACE)('gives every field and verb of %s a row or a bullet with a help line', (_label, id, expected) => {
    const markdown = sectionMarkdown(id);
    const rows = tableRows(markdown);
    // A verb that takes a name or a line has a bullet or a paragraph: "- **`memories.add(<text>)`** adds a line".
    const bullet = (name: string) => new RegExp(`^(- \\*\\*)?\`\\w+\\.${name}\\([^\`]*\`(\\*\\*)? \\S`, 'm').test(markdown);
    const missing = [...new Set(expected)].filter((name) => !rows.has(name) && !bullet(name));
    expect(missing).toEqual([]);
  });

  it('documents notes and discover', () => {
    expect(sectionMarkdown('ScriptsGuide#notes')).toContain('`notes`');
    expect(sectionMarkdown('ScriptsGuide#discover')).toContain('`discover(');
  });

  it('says a pinned summary can lose to the memory limit and a pinned line never does', () => {
    expect(sectionMarkdown('ScriptsGuide#memory')).toMatch(/pinned summary can still lose[\s\S]*pinned line never does/);
  });
});

describe('the Tools guide', () => {
  it('lists every global a user Tool reads', () => {
    const markdown = sectionMarkdown('Tools#what-a-script-can-read');
    for (const name of ['args', 'entities', 'locations', 'location', 'memories', 'dictionaries', 'clock', 'notes', 'stats', 'traits', 'placeholders', 'persona', 'console']) {
      expect(markdown, name).toContain(`\`${name}\``);
    }
  });

  it('says a Tool script is read-only and names the names it lacks', () => {
    const markdown = sectionMarkdown('Tools#what-a-script-can-read');
    expect(markdown).toContain('Every value is read-only');
    for (const name of ['memories.add', 'memories.pin', 'location.move', 'diary', 'self', 'owner', 'trait', 'narration', 'player', 'discover', 'clock.advance']) {
      expect(markdown, name).toContain(name);
    }
  });

  it('lists each exact rewrite and each flagged form with its new spelling', () => {
    const migration = BUNDLED_DOCS.Tools.match(MIGRATION)?.[0] ?? '';
    const rows = tableRows(migration);
    const oldForms = migration.split('\n').filter((line) => line.startsWith('| `')).map((line) => line.split('|')[1].trim());
    for (const form of [
      '`world.entities`', '`world.locations`', '`scene.location.id`, `scene.location.name`', '`scene.time.elapsed`', '`scene.stats.<Stat>`', '`scene.notes`',
      '`world.dictionary`', '`scene.persona`', '`scene.present`', '`scene.inScene`',
    ]) expect(oldForms, form).toContain(form);
    expect(rows.size).toBeGreaterThan(0);
    expect(migration).toContain('`memory.add(` to `memories.add(`');
  });
});

describe('the guide pages', () => {
  const RETIRED = [/memory\.add/, /memory\.pin/, /(?<![.\w`])diary\(/, /world\.entities/, /\bscene\.\w/];

  it.each(Object.keys(BUNDLED_DOCS).filter((page) => !page.startsWith('Changelog')))('%s names no retired form', (page) => {
    let text = BUNDLED_DOCS[page];
    if (page === 'Tools') {
      expect(text).toMatch(MIGRATION);
      text = text.replace(MIGRATION, '');
    }
    expect(RETIRED.filter((pattern) => pattern.test(text)).map(String)).toEqual([]);
  });
});
