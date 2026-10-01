import { describe, expect, it } from 'vitest';
import { HELP_TOPICS } from '@/lib/helpTopics';
import { docsLinkProblems, helpTopicProblems, surfaceCoverageProblems, type DocsPages } from './docsChecks';
import { KNOWN_HELP_TOPIC_GAPS, KNOWN_SURFACE_GAPS, SURFACE_EXCLUSIONS, SURFACE_IDS, SURFACE_MAP } from './surfaceMap';

const DOCS: DocsPages = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../../../docs/*.md', { query: '?raw', import: 'default', eager: true })).map(
    ([path, md]) => [path.slice(path.lastIndexOf('/') + 1, -'.md'.length), md],
  ),
);

const surfaceGaps = Object.values(KNOWN_SURFACE_GAPS).flat();
const topicGaps = Object.values(KNOWN_HELP_TOPIC_GAPS).flat();

describe('docs coverage of the app', () => {
  it('reads the docs folder', () => {
    expect(Object.keys(DOCS)).toEqual(expect.arrayContaining(['Home', '_Sidebar', 'WorldEditor']));
  });

  it('lists each surface id once', () => {
    expect(SURFACE_IDS.filter((id, i) => SURFACE_IDS.indexOf(id) !== i)).toEqual([]);
    expect(surfaceGaps.filter((id, i) => surfaceGaps.indexOf(id) !== i)).toEqual([]);
  });

  it('ties every player-facing surface to a docs heading', () => {
    expect(
      surfaceCoverageProblems({
        surfaceIds: SURFACE_IDS,
        map: SURFACE_MAP,
        exclusions: SURFACE_EXCLUSIONS,
        knownGaps: surfaceGaps,
        pages: DOCS,
      }),
    ).toEqual([]);
  });

  it('links every help topic to a docs heading', () => {
    expect(helpTopicProblems(HELP_TOPICS, topicGaps, DOCS)).toEqual([]);
  });

  it('resolves every link between docs pages', () => {
    expect(docsLinkProblems(DOCS)).toEqual([]);
  });
});

const PAGES: DocsPages = {
  Home: '# Home\n\nSee [Stats](Stats#the-panel).\n',
  Stats: '# 📊 Stats\n\n## The Panel\n\nText.\n',
  'Design-System': '# Design System\n',
};

function coverage(overrides: Partial<Parameters<typeof surfaceCoverageProblems>[0]>) {
  return surfaceCoverageProblems({
    surfaceIds: ['stats', 'stats.panel', 'admin'],
    map: { stats: { page: 'Stats', anchor: '-stats' } },
    exclusions: { admin: 'staff' },
    knownGaps: ['stats.panel'],
    pages: PAGES,
    ...overrides,
  });
}

describe('surfaceCoverageProblems', () => {
  it('passes a surface that is mapped, excluded or a known gap', () => {
    expect(coverage({})).toEqual([]);
  });

  it('fails a surface with no map entry and no known gap', () => {
    expect(coverage({ knownGaps: [] })).toEqual(['stats.panel has no docs section: add it to the surface map']);
  });

  it('fails a map entry whose heading or page does not exist', () => {
    expect(coverage({ map: { stats: { page: 'Stats', anchor: 'stats' } } })).toEqual([
      'stats maps to Stats#stats, but heading #stats is not on Stats',
    ]);
    expect(coverage({ map: { stats: { page: 'Stat', anchor: '-stats' } } })).toEqual([
      'stats maps to Stat#-stats, but page Stat does not exist',
    ]);
  });

  it('fails a map entry that points outside the player guide', () => {
    expect(coverage({ map: { stats: { page: 'Design-System', anchor: 'design-system' } } })).toEqual([
      'stats maps to Design-System#design-system, but page Design-System is not a guide page',
    ]);
  });

  it('fails a known gap that has a valid map entry, so the list only shrinks', () => {
    expect(
      coverage({ map: { stats: { page: 'Stats', anchor: '-stats' }, 'stats.panel': { page: 'Stats', anchor: 'the-panel' } } }),
    ).toEqual(['stats.panel maps to Stats#the-panel, so remove it from the known gaps']);
  });

  it('fails an excluded surface that is also mapped or a gap', () => {
    expect(coverage({ knownGaps: ['stats.panel', 'admin'] })).toEqual([
      'admin is excluded, so it needs no map entry or known gap',
    ]);
  });

  it('fails a listed id that is not a surface', () => {
    expect(coverage({ knownGaps: ['stats.panel', 'stats.gone'], exclusions: { admin: 'staff', old: 'dev' } })).toEqual([
      'old is listed but is not a surface id',
      'stats.gone is listed but is not a surface id',
    ]);
  });
});

describe('helpTopicProblems', () => {
  it('passes a topic that links a heading that exists', () => {
    expect(helpTopicProblems({ stats: { wikiPage: 'Stats', wikiAnchor: 'the-panel' } }, [], PAGES)).toEqual([]);
  });

  it('fails a topic whose heading does not exist', () => {
    expect(helpTopicProblems({ stats: { wikiPage: 'Stats', wikiAnchor: 'panel' } }, [], PAGES)).toEqual([
      'help topic stats links Stats#panel, but heading #panel is not on Stats',
    ]);
  });

  it('fails a topic that names no heading unless it is a known gap', () => {
    expect(helpTopicProblems({ stats: { wikiPage: 'Stats' }, other: {} }, ['other'], PAGES)).toEqual([
      'help topic stats links no docs heading: set wikiPage and wikiAnchor',
    ]);
  });

  it('fails a topic whose page does not exist, even as a known gap', () => {
    expect(helpTopicProblems({ stats: { wikiPage: 'Stat' } }, ['stats'], PAGES)).toEqual([
      'help topic stats links page Stat, which does not exist',
    ]);
  });

  it('fails a known gap that links a valid heading, or that is no topic', () => {
    expect(
      helpTopicProblems({ stats: { wikiPage: 'Stats', wikiAnchor: 'the-panel' } }, ['stats', 'gone'], PAGES),
    ).toEqual([
      'help topic stats links Stats#the-panel, so remove it from the known gaps',
      'help topic gone is a known gap but is not a help topic',
    ]);
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
      'Home:3 links Stats.md#the-panel, but the wiki serves Page.md as raw text: write Stats',
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
