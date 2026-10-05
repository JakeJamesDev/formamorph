import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import fullChangelog from '../../../docs/Changelog.md?raw';
import { BUNDLED_DOCS, bundledDocsIndex } from './bundledDocsIndex';
import { NON_GUIDE_PAGES, pageNameOf } from './docsChecks';
import { otherPagesLinked, SECTION_CHAR_LIMIT } from './docsIndex';
import { SECTION_CUT_MARKER } from './sectionParts';

// The query keeps vitest's related-test walk from parsing each page as a module.
const DOCS_FOLDER = Object.keys(import.meta.glob('../../../docs/*.md', { query: '?raw' })).map(pageNameOf);

const index = bundledDocsIndex();
const contents = index.contents();
const ids = contents.flatMap((page) => page.sections.map((s) => s.id));
const sections = ids.flatMap((id) => index.get([id]).filter((section) => section.id === id));

describe('the bundled Docs Index', () => {
  it('holds every docs page except the non-guide pages', () => {
    expect(Object.keys(BUNDLED_DOCS).sort()).toEqual(DOCS_FOLDER.filter((page) => !NON_GUIDE_PAGES.includes(page)).sort());
    expect(contents.map((page) => page.page).filter((page) => NON_GUIDE_PAGES.includes(page))).toEqual([]);
  });

  it('splits every page into at least one section', () => {
    expect(contents.filter((page) => page.sections.length === 0).map((page) => page.page)).toEqual([]);
  });

  it('starts at Home and follows the sidebar', () => {
    expect(contents.slice(0, 3).map((page) => page.page)).toEqual(['Home', 'Connect-Your-Own-AI', 'Install-on-Android']);
    expect(contents.at(-1)?.page).toBe('Changelog');
  });

  it('gives each section a unique id and keeps it within the size limit', () => {
    expect(sections.map((s) => s.id)).toEqual(ids);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    expect(sections.filter((s) => s.markdown.length > SECTION_CHAR_LIMIT).map((s) => s.id)).toEqual([]);
  });

  it('cuts no section: a block with nothing to split at needs a heading on its page', () => {
    expect(sections.filter((s) => s.markdown.includes(SECTION_CUT_MARKER)).map((s) => s.id)).toEqual([]);
  });

  it('shows no keyword line in a section, and finds a section by its keyword line', () => {
    expect(sections.filter((s) => /<!--\s*keywords:/i.test(s.markdown)).map((s) => s.id)).toEqual([]);
    expect(index.search('make a folder')[0]?.id).toBe('Library#how-to-make-a-group');
  });

  it('shows no route line in a section', () => {
    expect(sections.filter((s) => /<!--\s*route:/i.test(s.markdown)).map((s) => s.id)).toEqual([]);
  });

  it('routes each how-to on the Settings pages', () => {
    const howTos = sections.filter((s) => ['Settings', 'Prompts', 'Tools'].includes(s.page) && s.heading.startsWith('How to '));
    expect(howTos.filter((s) => s.route === undefined).map((s) => s.id)).toEqual([]);
    // How to Turn On Tools routes to the Output tab, where its first step is.
    expect(index.get(['Tools#how-to-turn-on-tools'])[0]?.route).toBe('settings.output');
    expect(index.get(['Settings#how-to-restore-default-worlds'])[0]?.route).toBe('settings.data');
  });

  it.each([
    ['Library#how-to-import-a-world', 'mainMenu.worlds', 'import-world'],
    ['Library#how-to-import-an-entity', 'mainMenu.entities', 'import-entity'],
    ['Library#how-to-import-a-dictionary', 'mainMenu.dictionaries', 'import-dictionary'],
    ['Avatars#how-to-import-an-avatar', 'mainMenu.models', 'import-avatar'],
    ['Avatars#how-to-customize-your-avatar', 'avatar', 'finalize-character'],
    ['Personas#how-to-import-sillytavern-personas', 'mainMenu.entities', 'import-entity'],
    ['Saves-and-Backup#how-to-import-a-save', 'menu', 'import-save'],
    ['Saves-and-Backup#how-to-make-a-backup', 'backup', 'start-backup'],
    ['Saves-and-Backup#how-to-restore-a-backup', 'backup', 'start-restore'],
    ['Saves-and-Backup#how-to-update-the-desktop-app', 'mainMenu', 'app-version'],
    ['Install-on-Android#how-to-update-the-app', 'mainMenu', 'app-version'],
    ['Install-on-Android#how-to-use-a-model-on-your-pc', 'settingsEndpoints.text', 'endpoint-url'],
    // The Preset list is the gate row: the engine preset hides the fields the last step names.
    ['Connect-Your-Own-AI#how-to-connect-lm-studio', 'settingsEndpoints.text', 'text-preset'],
    ['Connect-Your-Own-AI#how-to-connect-ollama', 'settingsEndpoints.text', 'text-preset'],
    ['Connect-Your-Own-AI#how-to-connect-a-hosted-api', 'settingsEndpoints.text', 'text-preset'],
    ['Connect-Your-Own-AI#how-to-play-against-your-pc-from-another-device', 'settingsEndpoints.text', 'endpoint-url'],
  ])('sends %s to the %s target %s', (id, route, target) => {
    const [section] = index.get([id]);
    expect(section.route).toBe(route);
    expect(section.target).toBe(target);
  });

  it('leaves a how-to that ends in a menu, a dialog or a tile without a target', () => {
    for (const id of [
      'Library#how-to-export-a-world', 'Library#how-to-export-an-entity-or-a-dictionary', 'Library#how-to-make-a-group',
      'Library#how-to-add-a-tile-to-a-group', 'Library#how-to-remove-a-tile-from-a-group', 'Library#how-to-move-a-tile',
      'Library#how-to-change-a-tiles-size', 'Library#how-to-rename-a-group', 'Library#how-to-delete-a-group',
      'Avatars#how-to-export-an-avatar', 'Personas#how-to-make-a-persona', 'Personas#how-to-set-a-default-persona',
      'Saves-and-Backup#how-to-load-a-game', 'Saves-and-Backup#how-to-export-a-save',
      'Starting-a-Game#how-to-start-a-game', 'Starting-a-Game#how-to-start-with-the-defaults',
      'Install-on-Android#how-to-get-beta-builds', 'Connect-Your-Own-AI#how-to-use-the-desktop-engine',
    ]) {
      expect(index.get([id])[0].target, id).toBeUndefined();
    }
  });

  it('stays out of the start chunk: only the loader names it, through a dynamic import', () => {
    const src = resolve(__dirname, '../..');
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .map((file) => join(src, file));
    const naming = files.filter((file) => /['"][^'"]*\/bundledDocsIndex['"]/.test(readFileSync(file, 'utf8')));
    expect(naming.map((file) => file.slice(src.length + 1).replace(/\\/g, '/'))).toEqual(['lib/docs/loadDocsIndex.ts']);
    const loader = readFileSync(naming[0], 'utf8');
    const mentions = loader.match(/['"]\.\/bundledDocsIndex['"]/g) ?? [];
    const dynamic = loader.match(/import\(\s*['"]\.\/bundledDocsIndex['"]\s*\)/g) ?? [];
    expect(dynamic.length).toBeGreaterThan(0);
    expect(mentions.length).toBe(dynamic.length);
  });

  it('holds only the released changelog sections of the newest minor series', () => {
    const released = [...fullChangelog.matchAll(/<summary><strong>✅ ((\d+\.\d+)\.\d+) — Released/g)];
    const series = released[0][2];
    const expected = released.filter((m) => m[2] === series).map((m) => m[1]);
    const changelog = contents.find((page) => page.page === 'Changelog');
    const versions = changelog?.sections.filter((s) => s.level === 2).map((s) => /\d+\.\d+\.\d+/.exec(s.label)?.[0]);
    expect(expected.length).toBeGreaterThan(0);
    expect(versions).toEqual(expected);
    expect(BUNDLED_DOCS.Changelog).not.toContain('In Progress');
  });
});

describe('hub sections in the bundled docs', () => {
  const hubIds = sections.filter((section) => otherPagesLinked(section) >= 5).map((section) => section.id);

  it('marks the two sections ticket 37 found as hubs', () => {
    expect(hubIds).toContain('Settings#output');
    expect(hubIds.filter((id) => id.startsWith('Glossary#') && id.endsWith('building-a-world'))).toHaveLength(1);
  });

  it('ranks a specific section above a hub for a task question that matches both', () => {
    const ids = index.search('how do I put a cover picture on my world so it looks nice when people browse?', 50).map((s) => s.id);
    const hub = ids.findIndex((id) => id.startsWith('WorldEditor#'));
    expect(ids.indexOf('Community-Creations#how-to-download-a-world')).toBeLessThan(hub < 0 ? Infinity : hub);
    const images = ids.indexOf('World-Editor-Overview#how-to-set-the-worlds-images');
    expect(images).toBeGreaterThanOrEqual(0);
    expect(images).toBeLessThan(3);
    expect(ids.slice(0, images).filter((id) => hubIds.includes(id))).toEqual([]);
  });

  it('does not lead with a hub for a question that holds its heading words apart', () => {
    const question = 'I finished building my world, how do I upload it so other people online can play it?';
    expect(index.search(question)[0]?.id).toBe('Community-Creations#how-to-publish-a-world');
  });

  it('still finds the Glossary hub for its own term', () => {
    const ids = index.search('what is Building a World in the glossary?', 3).map((s) => s.id);
    expect(ids.some((id) => id.startsWith('Glossary#') && id.endsWith('building-a-world'))).toBe(true);
  });

  it.each([
    ['how do I use a different AI for help?', 'Formaquestion#how-to-use-a-different-ai-for-help'],
    ['how do I turn on reasoning for help?', 'Formaquestion#how-to-turn-on-reasoning-for-help'],
    ['how do I turn on Semantic Search?', 'Formaquestion#how-to-turn-on-semantic-search'],
    ['how do I write my own help prompt?', 'Formaquestion#how-to-write-your-own-help-prompt'],
    ['how do I add a Tool to Formaquestion?', 'Formaquestion#how-to-add-a-tool-to-formaquestion'],
    ['how do I move a custom preset to another device?', 'Formaquestion#how-to-move-a-custom-preset-to-another-device'],
    ['how do I see what the app sent for a question?', 'Formaquestion#how-to-see-what-the-app-sent-for-a-question'],
    ['how do I use Formaquestion as a plain chat?', 'Formaquestion#how-to-use-formaquestion-as-a-plain-chat'],
  ])('finds the Formaquestion how-to in the top 5 for "%s"', (question, id) => {
    expect(index.search(question, 5).map((s) => s.id)).toContain(id);
  });

  it('still finds Settings#output for a question about what it holds', () => {
    expect(index.search('What does Settings → Output hold?', 5).map((s) => s.id)).toContain('Settings#output');
  });
});
