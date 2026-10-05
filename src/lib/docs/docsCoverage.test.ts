import { describe, expect, it } from 'vitest';
import { HELP_TOPICS } from '@/lib/helpTopics';
import { SURFACE_TARGETS } from '@/lib/surface/surfaceTargets';
import {
  docsLinkProblems, glossaryProblems, helpTopicProblems, indexProblems, keywordLineProblems, routeLineProblems,
  surfaceCoverageProblems, surfaceRouteProblems, unclosedFenceProblems, untargetedSections, HOME_PAGE, SIDEBAR_PAGE, pageNameOf, type DocsPages,
  type SurfaceRouteInput,
} from './docsChecks';
import { createDocsIndex } from './docsIndex';
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

  it('points every route line at a surface players see, and a target it registers', () => {
    expect(routeLineProblems(DOCS, { surfaceIds: SURFACE_IDS, exclusions: SURFACE_EXCLUSIONS, targets: SURFACE_TARGETS })).toEqual([]);
  });

  it('closes every code fence on every page', () => {
    expect(unclosedFenceProblems(DOCS)).toEqual([]);
  });

  it('reports how-to sections that could name a target (report only)', () => {
    const untargeted = untargetedSections(DOCS, SURFACE_TARGETS);
    if (untargeted.length > 0) console.info(`How-to sections whose surface has targets but whose route names none:\n${untargeted.join('\n')}`);
  });

  it('gives every surface-map section the route of its surface', () => {
    expect(surfaceRouteProblems({ map: SURFACE_MAP, exclusions: SURFACE_EXCLUSIONS, index: createDocsIndex({ pages: DOCS }) })).toEqual([]);
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

describe('routeLineProblems', () => {
  const surfaces = { surfaceIds: ['stats', 'stats.panel', 'admin'], exclusions: { admin: 'staff' }, targets: { 'stats.panel': ['bar-color'] } };
  const route = (line: string) => ({ P: `# P\n\n## How to Go\n<!-- keywords: leave -->\n${line}\n\nText.\n` });

  it('passes a route that names a surface, and a section with no route', () => {
    expect(routeLineProblems(route('<!-- route: stats.panel -->'), surfaces)).toEqual([]);
    expect(routeLineProblems(route(''), surfaces)).toEqual([]);
  });

  it('fails a route that is not a surface id', () => {
    expect(routeLineProblems(route('<!-- route: stats.pane -->'), surfaces)).toEqual(['P:5 route stats.pane is not a surface id']);
    expect(routeLineProblems(route('<!-- route: -->'), surfaces)).toEqual(['P:5 route line names no surface']);
    expect(routeLineProblems(route('<!--route: stats panel-->'), surfaces)).toEqual(['P:5 route stats panel is not a surface id']);
  });

  it('passes a fragment the surface registers', () => {
    expect(routeLineProblems(route('<!-- route: stats.panel#bar-color -->'), surfaces)).toEqual([]);
  });

  it('fails a fragment the surface does not register, naming the page and the section', () => {
    expect(routeLineProblems(route('<!-- route: stats.panel#bar-colour -->'), surfaces)).toEqual([
      'P:5 section How to Go routes to stats.panel#bar-colour, but stats.panel has no target bar-colour',
    ]);
    expect(routeLineProblems(route('<!-- route: stats#bar-color -->'), surfaces)).toEqual([
      'P:5 section How to Go routes to stats#bar-color, but stats has no target bar-color',
    ]);
    expect(routeLineProblems(route('<!-- route: stats.panel# -->'), surfaces)).toEqual([
      'P:5 section How to Go routes to stats.panel#, but the target is empty',
    ]);
  });

  it('checks the surface before the fragment', () => {
    expect(routeLineProblems(route('<!-- route: stats.pane#bar-color -->'), surfaces)).toEqual(['P:5 route stats.pane is not a surface id']);
  });

  it('fails a route on an excluded surface', () => {
    expect(routeLineProblems(route('<!-- route: admin -->'), surfaces)).toEqual(['P:5 route admin is on a staff surface that players never see']);
  });

  it('fails a second route line in one section', () => {
    const pages = { P: '# P\n\n## Go\n<!-- route: stats -->\n<!-- route: stats.panel -->\n\n## Stop\n<!-- route: stats -->\n' };
    expect(routeLineProblems(pages, surfaces)).toEqual(['P:5 section has a second route line']);
  });

  it('checks no route line inside code or outside the guide', () => {
    const pages = { P: '# P\n\n```md\n<!-- route: nope -->\n```\n', 'Writing-Guide': '# W\n\n<!-- route: nope -->\n' };
    expect(routeLineProblems(pages, surfaces)).toEqual([]);
  });
});

describe('unclosedFenceProblems', () => {
  it('passes closed fences of either marker', () => {
    expect(unclosedFenceProblems({ P: '# P\n\n```js\nreturn 1;\n```\n\n~~~\ntext\n~~~\n' })).toEqual([]);
  });

  it('fails a fence left open, naming the page and the opening line', () => {
    expect(unclosedFenceProblems({ P: '# P\n\n```js\nreturn 1;\n\n### Next\n' })).toEqual(['P:3 code fence is never closed']);
  });

  it('does not close a fence with the other marker', () => {
    expect(unclosedFenceProblems({ P: '~~~\ntext\n```\n' })).toEqual(['P:1 code fence is never closed']);
  });

  it('checks each page on its own', () => {
    expect(unclosedFenceProblems({ A: '```\nx\n', B: '```\nx\n```\n' })).toEqual(['A:1 code fence is never closed']);
  });
});

describe('untargetedSections', () => {
  const targets = { 'stats.panel': ['bar-color'] };
  const section = (heading: string, route: string) => `## ${heading}\n<!-- keywords: k -->\n<!-- route: ${route} -->\n\nText.\n`;

  it('lists how-to sections on a targeted surface whose route names no target', () => {
    const pages = {
      P: [
        '# P\n',
        section('How to Paint the Bar', 'stats.panel'),
        section('How to Size the Bar', 'stats.panel#bar-color'),
        section('How to Open Stats', 'stats'),
        section('The Panel', 'stats.panel'),
        '## How to Read\n\nNo route.\n',
      ].join('\n'),
      'Writing-Guide': `# W\n\n${section('How to Write', 'stats.panel')}`,
    };
    expect(untargetedSections(pages, targets)).toEqual(['P#how-to-paint-the-bar']);
  });

  it('lists nothing when no surface registers a target', () => {
    expect(untargetedSections({ P: `# P\n\n${section('How to Paint the Bar', 'stats.panel')}` }, {})).toEqual([]);
  });
});

describe('surfaceRouteProblems', () => {
  const stats = { page: 'P', anchor: 'stats' };
  const panel = { page: 'P', anchor: 'the-panel' };
  const routed = (statsLine: string, panelLine: string) => ({
    P: `# P\n\n## Stats\n${statsLine}\n\nText.\n\n## The Panel\n${panelLine}\n\nText.\n`,
  });
  const input = (pages: DocsPages, overrides: Partial<SurfaceRouteInput> = {}): SurfaceRouteInput => ({
    map: { stats, 'stats.panel': panel },
    exclusions: {},
    index: createDocsIndex({ pages }),
    ...overrides,
  });

  it('passes a target whose route line names its surface', () => {
    expect(surfaceRouteProblems(input(routed('<!-- route: stats -->', '<!-- route: stats.panel -->')))).toEqual([]);
  });

  it('fails a target with no route line', () => {
    expect(surfaceRouteProblems(input(routed('<!-- route: stats -->', '')))).toEqual([
      'P#the-panel is the section of stats.panel but has no route line',
    ]);
  });

  it('fails a target whose route names another surface', () => {
    expect(surfaceRouteProblems(input(routed('<!-- route: stats.panel -->', '<!-- route: stats.panel -->')))).toEqual([
      'P#stats is the section of stats but its route is stats.panel',
    ]);
  });

  it('reads the route line only up to the next heading', () => {
    const pages = { P: '# P\n\n## Stats\n\nText.\n\n## The Panel\n<!-- route: stats -->\n<!-- route: stats.panel -->\n' };
    expect(surfaceRouteProblems(input(pages))).toEqual([
      'P#stats is the section of stats but has no route line',
      'P#the-panel is the section of stats.panel but its route is stats',
    ]);
  });

  it('accepts any of the surfaces that share one section', () => {
    const shared = { map: { stats: panel, 'stats.panel': panel } };
    expect(surfaceRouteProblems(input({ P: '# P\n\n## The Panel\n<!-- route: stats.panel -->\n' }, shared))).toEqual([]);
    expect(surfaceRouteProblems(input({ P: '# P\n\n## The Panel\n<!-- route: other -->\n' }, shared))).toEqual([
      'P#the-panel is the section of stats, stats.panel but its route is other',
    ]);
  });

  it('skips an excluded surface', () => {
    const pages = routed('<!-- route: stats -->', '');
    expect(surfaceRouteProblems(input(pages, { exclusions: { 'stats.panel': 'dev' } }))).toEqual([]);
  });

  it('leaves a target that is not a heading, or not on a page, to the coverage check', () => {
    expect(surfaceRouteProblems(input({ P: '# P\n\n## Stats\n<!-- route: stats -->\n' }))).toEqual([]);
    expect(surfaceRouteProblems(input({}))).toEqual([]);
  });

  it('skips a target the index folds into the section above it', () => {
    const pages = { P: '# P\n\n## Stats\n<!-- route: stats -->\n\n### The Panel\n\nText.\n' };
    expect(surfaceRouteProblems(input(pages))).toEqual([]);
  });
});
