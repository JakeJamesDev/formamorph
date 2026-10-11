import { describe, expect, it } from 'vitest';
import { createDocsIndex, SECTION_CHAR_LIMIT } from '@/lib/docs/docsIndex';
import { createGuide } from './guide';
import { pageNameOf, wikiTarget } from './wikiTarget';

// "The Long List" is over the size limit with no sub-heading, so it splits into parts at its list items.
const filler = Array.from({ length: Math.ceil((SECTION_CHAR_LIMIT * 2) / 30) }, (_, i) => `- **Entry ${i}:** a tile moves.`);
const PAGES = {
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## The Panel\n\nThe panel shows each number.\n',
  Tiles: ['# 🧱 Tiles', '', 'Tiles move.', '', '## The Long List', '', ...filler, ''].join('\n'),
};
const guide = createGuide(createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n- [Tiles](Tiles)\n' }));
const section = (id: string) => {
  const found = guide.section(id);
  if (!found) throw new Error(`no section ${id}`);
  return found;
};

describe('the wiki target of the section the reader shows', () => {
  it('is the wiki page and heading of a section', () => {
    expect(wikiTarget(section('Stats#the-panel'))).toEqual({ url: 'https://github.com/JakeJamesDev/formamorph/wiki/Stats#the-panel', page: 'Stats' });
  });

  it('is the page alone for a page-level section', () => {
    expect(wikiTarget(section('Stats#-stats'))).toMatchObject({ page: 'Stats' });
  });

  it('is the heading of the whole section for every part of a split section', () => {
    const parts = guide.contents.find((entry) => entry.page === 'Tiles')!.sections.filter((entry) => entry.label.startsWith('The Long List'));
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.map((part) => part.id)).toContain('Tiles#the-long-list-part-2');
    for (const part of parts) {
      expect(wikiTarget(section(part.id)).url).toBe('https://github.com/JakeJamesDev/formamorph/wiki/Tiles#the-long-list');
    }
  });

  it('names a page by its title without the leading emoji', () => {
    expect(pageNameOf(guide.titleOf('Stats'))).toBe('Stats');
    expect(pageNameOf('❓ Formaquestion')).toBe('Formaquestion');
    expect(pageNameOf('⚙️ Settings')).toBe('Settings');
    expect(pageNameOf('Plain Title')).toBe('Plain Title');
  });

  it('is the wiki home with no section open', () => {
    expect(wikiTarget(null)).toEqual({ url: 'https://github.com/JakeJamesDev/formamorph/wiki', page: null });
  });
});
