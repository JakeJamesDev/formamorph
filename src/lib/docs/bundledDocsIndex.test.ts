import { describe, expect, it } from 'vitest';
import fullChangelog from '../../../docs/Changelog.md?raw';
import { BUNDLED_DOCS, bundledDocsIndex } from './bundledDocsIndex';
import { NON_GUIDE_PAGES } from './docsChecks';
import { SECTION_CHAR_LIMIT } from './docsIndex';
import { SECTION_CUT_MARKER } from './sectionParts';

const DOCS_FOLDER = Object.keys(import.meta.glob('../../../docs/*.md')).map((path) =>
  path.slice(path.lastIndexOf('/') + 1, -'.md'.length),
);

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
