import { describe, expect, it } from 'vitest';
import { HELP_TOPICS } from '@/lib/helpTopics';
import {
  docsLinkProblems, glossaryProblems, helpTopicProblems, indexProblems, keywordLineProblems, surfaceCoverageProblems,
  HOME_PAGE, SIDEBAR_PAGE, pageNameOf, type DocsPages,
} from './docsChecks';
import { SURFACE_EXCLUSIONS, SURFACE_IDS, SURFACE_MAP } from './surfaceMap';

const DOCS: DocsPages = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../../../docs/*.md', { query: '?raw', import: 'default', eager: true })).map(
    ([path, md]) => [pageNameOf(path), md],
  ),
);

describe('docs coverage of the app', () => {
  it('reads the docs folder', () => {
    expect(Object.keys(DOCS)).toEqual(expect.arrayContaining(['Home', '_Sidebar', 'WorldEditor']));
  });

  it('lists each surface id once', () => {
    expect(SURFACE_IDS.filter((id, i) => SURFACE_IDS.indexOf(id) !== i)).toEqual([]);
  });

  it('ties every player-facing surface to a docs heading', () => {
    expect(
      surfaceCoverageProblems({
        surfaceIds: SURFACE_IDS,
        map: SURFACE_MAP,
        exclusions: SURFACE_EXCLUSIONS,
        pages: DOCS,
      }),
    ).toEqual([]);
  });

  it('links every help topic to a docs heading', () => {
    expect(helpTopicProblems(HELP_TOPICS, DOCS)).toEqual([]);
  });

  it('resolves every link between docs pages', () => {
    expect(docsLinkProblems(DOCS)).toEqual([]);
  });

  it('lists every guide page on the home page and in the sidebar', () => {
    expect([...indexProblems(DOCS, HOME_PAGE), ...indexProblems(DOCS, SIDEBAR_PAGE)]).toEqual([]);
  });

  it('links every glossary term to the page that explains it', () => {
    expect(glossaryProblems(DOCS)).toEqual([]);
  });

  it('gives every how-to section a keyword line', () => {
    expect(keywordLineProblems(DOCS)).toEqual([]);
  });
});

const PAGES: DocsPages = {
  Home: '# Home\n\nSee [Stats](Stats#the-panel).\n',
  Stats: '# 📊 Stats\n\n## The Panel\n\nText.\n',
  'Design-System': '# Design System\n',
};

const PANEL = { 'stats.panel': { page: 'Stats', anchor: 'the-panel' } };
const STATS = { page: 'Stats', anchor: '-stats' };

function coverage(overrides: Partial<Parameters<typeof surfaceCoverageProblems>[0]>) {
  return surfaceCoverageProblems({
    surfaceIds: ['stats', 'stats.panel', 'admin'],
    map: { ...PANEL, stats: STATS },
    exclusions: { admin: 'staff' },
    pages: PAGES,
    ...overrides,
  });
}

describe('surfaceCoverageProblems', () => {
  it('passes a surface that is mapped or excluded', () => {
    expect(coverage({})).toEqual([]);
  });

  it('fails a surface with no map entry', () => {
    expect(coverage({ map: { stats: STATS } })).toEqual([
      'stats.panel has no docs section: add it to the surface map',
    ]);
  });

  it('fails a map entry whose heading or page does not exist', () => {
    expect(coverage({ map: { ...PANEL, stats: { page: 'Stats', anchor: 'stats' } } })).toEqual([
      'stats maps to Stats#stats, but heading #stats is not on Stats',
    ]);
    expect(coverage({ map: { ...PANEL, stats: { page: 'Stat', anchor: '-stats' } } })).toEqual([
      'stats maps to Stat#-stats, but page Stat does not exist',
    ]);
  });

  it('fails a map entry that points outside the player guide', () => {
    expect(coverage({ map: { ...PANEL, stats: { page: 'Design-System', anchor: 'design-system' } } })).toEqual([
      'stats maps to Design-System#design-system, but page Design-System is not a guide page',
    ]);
  });

  it('fails an excluded surface that is also mapped', () => {
    expect(coverage({ exclusions: { admin: 'staff', stats: 'dev' } })).toEqual([
      'stats is excluded, so it needs no map entry',
    ]);
  });

  it('fails a listed id that is not a surface', () => {
    const map = { ...PANEL, stats: STATS, 'stats.gone': STATS };
    expect(coverage({ map, exclusions: { admin: 'staff', old: 'dev' } })).toEqual([
      'stats.gone is listed but is not a surface id',
      'old is listed but is not a surface id',
    ]);
  });
});

describe('helpTopicProblems', () => {
  it('passes a topic that links a heading that exists', () => {
    expect(helpTopicProblems({ stats: { wikiPage: 'Stats', wikiAnchor: 'the-panel' } }, PAGES)).toEqual([]);
  });

  it('fails a topic whose heading does not exist', () => {
    expect(helpTopicProblems({ stats: { wikiPage: 'Stats', wikiAnchor: 'panel' } }, PAGES)).toEqual([
      'help topic stats links Stats#panel, but heading #panel is not on Stats',
    ]);
  });

  it('fails a topic that names no heading', () => {
    expect(helpTopicProblems({ stats: { wikiPage: 'Stats' }, other: {} }, PAGES)).toEqual([
      'help topic stats links no docs heading: set wikiPage and wikiAnchor',
      'help topic other links no docs heading: set wikiPage and wikiAnchor',
    ]);
  });

  it('fails a topic whose page is missing or outside the guide', () => {
    expect(helpTopicProblems({ stats: { wikiPage: 'Stat', wikiAnchor: 'x' } }, PAGES)).toEqual([
      'help topic stats links Stat#x, but page Stat does not exist',
    ]);
    expect(helpTopicProblems({ stats: { wikiPage: 'Design-System', wikiAnchor: 'design-system' } }, PAGES)).toEqual([
      'help topic stats links Design-System#design-system, but page Design-System is not a guide page',
    ]);
  });
});

describe('indexProblems', () => {
  const pages: DocsPages = {
    ...PAGES,
    Tools: '# Tools\n',
    _Sidebar: '- [Home](Home)\n- [Stats](Stats#the-panel)\n- [Tools](Tools)\n- [Repo](https://example.com/Tools)\n',
  };

  it('passes an index that links every guide page', () => {
    expect(indexProblems(pages, '_Sidebar')).toEqual([]);
  });

  it('fails a guide page the index does not link, and skips pages outside the guide', () => {
    expect(indexProblems(pages, 'Home')).toEqual(['Home does not list Tools']);
  });

  it('does not count a link inside code', () => {
    expect(indexProblems({ ...pages, _Sidebar: '- [Stats](Stats)\n```\n[Tools](Tools)\n```\n' }, '_Sidebar')).toEqual([
      '_Sidebar does not list Tools',
    ]);
  });
});

describe('glossaryProblems', () => {
  const glossary = (md: string): DocsPages => ({ ...PAGES, Glossary: md });
  const TABLE = '# Glossary\n\n| Term | Meaning |\n|---|---|\n';

  it('passes a glossary whose every term links a guide page', () => {
    expect(glossaryProblems(glossary(`${TABLE}| [Stat](Stats#the-panel) | A number. |\n| [Home](Home) | The start. |\n`))).toEqual([]);
  });

  it('fails a term with no link, or a link to no guide page', () => {
    expect(glossaryProblems(glossary(
      `${TABLE}| Stat | A number. |\n| [Design](Design-System) | A page. |\n| [Self](#glossary) | Here. |\n| [Site](https://example.com) | Away. |\n`,
    ))).toEqual([
      'Glossary:5 term Stat links no guide page',
      'Glossary:6 term [Design](Design-System) links no guide page',
      'Glossary:7 term [Self](#glossary) links no guide page',
      'Glossary:8 term [Site](https://example.com) links no guide page',
    ]);
  });

  it('fails a missing glossary page', () => {
    expect(glossaryProblems(PAGES)).toEqual(['page Glossary does not exist']);
  });
});

describe('docsLinkProblems', () => {
  it('passes links to pages, headings and the same page', () => {
    expect(docsLinkProblems({ ...PAGES, Stats: '# 📊 Stats\n\n## The Panel\n\n[Top](#-stats) · [Home](Home)\n' })).toEqual([]);
  });

  it('fails a link to a missing page or heading', () => {
    expect(docsLinkProblems({ ...PAGES, Home: '# Home\n\n[A](Stat) [B](Stats#panel) [C](#nope)\n' })).toEqual([
      'Home:3 links Stat, but page Stat does not exist',
      'Home:3 links Stats#panel, but heading #panel is not on Stats',
      'Home:3 links #nope, but heading #nope is not on Home',
    ]);
  });

  it('fails a link with a .md suffix, which the wiki serves as raw text', () => {
    expect(docsLinkProblems({ ...PAGES, Home: '# Home\n\n[Stats](Stats.md#the-panel)\n' })).toEqual([
      'Home:3 links Stats.md#the-panel: write Stats, the wiki page name',
    ]);
  });

  it('decodes a percent-encoded anchor', () => {
    expect(docsLinkProblems({ ...PAGES, Home: '# Home\n\n[Stats](Stats#%F0%9F%93%8A-stats)\n' })).toEqual([
      'Home:3 links Stats#%F0%9F%93%8A-stats, but heading #📊-stats is not on Stats',
    ]);
    expect(docsLinkProblems({ ...PAGES, Home: '# Home\n\n[Stats](Stats#%E0-stats)\n' })).toEqual([
      'Home:3 links Stats#%E0-stats, but heading #%E0-stats is not on Stats',
    ]);
  });

  it('skips outside sites, repo paths, images and code', () => {
    const page = '# Home\n\n[Site](https://example.com/x#y) [Src](../src/a.ts) ![Pic](missing.png) `[No](Nope)`\n```\n[No](Nope)\n```\n';
    expect(docsLinkProblems({ ...PAGES, Home: page })).toEqual([]);
  });
});

describe('keywordLineProblems', () => {
  it('passes a how-to heading with a keyword line under it, at any heading level', () => {
    const pages = { P: '# P\n\n## How to Go\n<!-- keywords: leave, exit -->\n\nText.\n\n### How to Stop\n\n<!-- keywords: halt -->\n' };
    expect(keywordLineProblems(pages)).toEqual([]);
  });

  it('fails a how-to heading with no keyword line, or an empty one', () => {
    const pages = { P: '# P\n\n## How to **Go**\n\nText.\n\n## How to Stop\n<!-- keywords: -->\n\n## Notes\n\nText.\n' };
    expect(keywordLineProblems(pages)).toEqual([
      'P:8 keyword line has an empty phrase',
      'P:3 heading How to Go has no keyword line under it',
      'P:7 heading How to Stop has no keyword line under it',
    ]);
  });

  it('skips headings inside code and pages outside the guide', () => {
    const pages = { P: '# P\n\n```md\n## How to Go\n```\n', 'Writing-Guide': '# W\n\n## How to Write\n\nText.\n' };
    expect(keywordLineProblems(pages)).toEqual([]);
  });

  it('passes a keyword line under any heading', () => {
    expect(keywordLineProblems({ P: '# P\n<!-- keywords: page -->\n\n## Notes\n\n<!-- keywords: memo, jot -->\n\nText.\n' })).toEqual([]);
  });

  it('fails a keyword line that is not the first line under its heading', () => {
    const pages = { P: '<!-- keywords: top -->\n# P\n\nText.\n<!-- keywords: body -->\n\n## Go\n<!-- keywords: leave -->\n<!-- keywords: exit -->\n' };
    expect(keywordLineProblems(pages)).toEqual([
      'P:1 keyword line is not the first line under a heading',
      'P:5 keyword line is not the first line under a heading',
      'P:9 keyword line is not the first line under a heading',
    ]);
  });

  it('fails a keyword line after a code block, or under a line the index does not read as a heading', () => {
    const pages = { P: '# P\n\n## Go\n\n```\ncode\n```\n\n<!-- keywords: leave -->\n\n# Stop\n<!-- keywords: halt -->\n' };
    expect(keywordLineProblems(pages)).toEqual([
      'P:9 keyword line is not the first line under a heading',
      'P:12 keyword line is not the first line under a heading',
    ]);
  });

  it('fails a keyword line with an empty or repeated phrase', () => {
    const pages = { P: '# P\n\n## Go\n<!-- keywords: leave, , exit -->\n\n## Stop\n<!-- keywords: halt, Halt , wait, halt -->\n\n## Notes\n<!-- keywords: -->\n' };
    expect(keywordLineProblems(pages)).toEqual([
      'P:4 keyword line has an empty phrase',
      'P:7 keyword line repeats "halt"',
      'P:10 keyword line has an empty phrase',
    ]);
  });

  it('checks no keyword line inside code or outside the guide', () => {
    const pages = { P: '# P\n\nText.\n```md\n<!-- keywords: a, a -->\n```\n', 'Writing-Guide': '# W\n\nText.\n<!-- keywords: a, a -->\n' };
    expect(keywordLineProblems(pages)).toEqual([]);
  });
});
