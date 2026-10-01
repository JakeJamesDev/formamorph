import { describe, expect, it } from 'vitest';
import { BUNDLED_DOCS, bundledDocsIndex } from './bundledDocsIndex';
import { docsLinkProblems } from './docsChecks';
import { docsHrefs } from './docsLinks';
import { createDocsIndex, SECTION_CHAR_LIMIT } from './docsIndex';
import {
  createDocsLinkResolver, readerLinkTarget, sectionBody, sectionExcerpt, sectionWithId, withReaderLinks,
} from './docsReader';
import { docHeadings, forEachProseLine } from './headingAnchors';

const LONG_LIST = Array.from({ length: 400 }, (_, i) => `- Item ${i} of a list that is long enough to split.`).join('\n');

const PAGES = {
  Home: '# 🏠 Home\n\nStart with [Stats](Stats) or [the panel](Stats#the-panel).\n',
  Stats: [
    'Text above the first heading.',
    '',
    '# 📊 Stats',
    '',
    'See [Home](Home), [the fields](#fields) and [a site](https://example.com/Stats#the-panel).',
    '',
    '## The Panel',
    '',
    'The panel has two **tabs**. Use `[Not a link](Home)` as text.',
    '',
    '### Fields',
    '',
    'Each field has a label.',
    '',
    '```',
    '[In a fence](Home)',
    '```',
    '',
    '## Fields',
    '',
    'A second heading with the same name.',
  ].join('\n'),
  Long: `# Long\n\n## Big List\n\n${LONG_LIST}\n\n## After\n\nThe end.\n\n## Big List\n\nA short one.\n`,
};

/** The hrefs of a section's links to docs pages, outside code. */
function docsHrefsOf(markdown: string): string[] {
  const hrefs: string[] = [];
  forEachProseLine(markdown, (source) => hrefs.push(...docsHrefs(source)));
  return hrefs;
}

const index = createDocsIndex({ pages: PAGES });
const resolve = createDocsLinkResolver(index);

describe('createDocsLinkResolver', () => {
  it('opens the first section of a page for a page link', () => {
    expect(resolve('Home', 'Stats')).toBe('Stats');
    expect(resolve('Stats', 'Home')).toBe('Home#-home');
  });

  it('opens the section of a heading link', () => {
    expect(resolve('Home', 'Stats#the-panel')).toBe('Stats#the-panel');
  });

  it('opens the section that holds a sub-heading', () => {
    expect(resolve('Stats', '#fields')).toBe('Stats#the-panel');
  });

  it('follows the wiki suffix of a repeated heading', () => {
    expect(resolve('Home', 'Stats#fields-1')).toBe('Stats#fields-1');
  });

  it('reads a same-page link from the page that holds it', () => {
    expect(resolve('Stats', '#the-panel')).toBe('Stats#the-panel');
    expect(resolve('Home', '#the-panel')).toBeNull();
  });

  it('returns null for an outside site, a repo path, a missing page and a missing heading', () => {
    expect(resolve('Home', 'https://example.com/Stats')).toBeNull();
    expect(resolve('Home', '../src/index.css')).toBeNull();
    expect(resolve('Home', 'Nope')).toBeNull();
    expect(resolve('Home', 'Stats#nope')).toBeNull();
  });

  it('keeps anchors right after a section that splits into parts', () => {
    expect(index.get(['Long#big-list']).length).toBeGreaterThan(1);
    expect(LONG_LIST.length).toBeGreaterThan(SECTION_CHAR_LIMIT);
    expect(resolve('Home', 'Long#big-list')).toBe('Long#big-list');
    expect(resolve('Home', 'Long#after')).toBe('Long#after');
    // Each part repeats the heading line. A repeat must not take the suffix of the second heading.
    expect(resolve('Home', 'Long#big-list-1')).toBe('Long#big-list-1');
    expect(sectionBody(index.get(['Long#big-list-1'])[0])).toBe('A short one.');
  });
});

describe('withReaderLinks', () => {
  const stats = withReaderLinks(PAGES.Stats, 'Stats', resolve);

  it('turns each docs link into a reader link to its section', () => {
    expect(stats).toContain('[Home](#docs=Home%23-home)');
    expect(stats).toContain('[the fields](#docs=Stats%23the-panel)');
    expect(readerLinkTarget('#docs=Home%23-home')).toBe('Home#-home');
  });

  it('leaves outside sites, inline code and code fences as written', () => {
    expect(stats).toContain('[a site](https://example.com/Stats#the-panel)');
    expect(stats).toContain('`[Not a link](Home)`');
    expect(stats).toContain('\n[In a fence](Home)\n');
  });

  it('leaves a link that resolves to nothing as written', () => {
    expect(withReaderLinks('[Gone](Nope#x)', 'Home', resolve)).toBe('[Gone](Nope#x)');
  });

  it('leaves an image as written, even when its address names a docs page', () => {
    expect(withReaderLinks('![Stats](Stats) and [Stats](Stats)', 'Home', resolve)).toBe('![Stats](Stats) and [Stats](#docs=Stats)');
  });

  it('keeps a link title and a link text with code in it', () => {
    expect(withReaderLinks('[`Stats`](Stats "The stats page")', 'Home', resolve))
      .toBe('[`Stats`](#docs=Stats "The stats page")');
  });
});

describe('readerLinkTarget', () => {
  it('is null for every href that is not a reader link', () => {
    expect(readerLinkTarget('https://example.com')).toBeNull();
    expect(readerLinkTarget('#the-panel')).toBeNull();
    expect(readerLinkTarget(undefined)).toBeNull();
    expect(readerLinkTarget('#docs=%E0%A4%A')).toBeNull();
  });
});

describe('sectionBody and sectionExcerpt', () => {
  const [panel] = index.get(['Stats#the-panel']);
  const [intro] = index.get(['Stats']);

  it('drops the heading line of a section, and nothing from text with no heading', () => {
    expect(sectionBody(panel).startsWith('The panel has two **tabs**.')).toBe(true);
    expect(sectionBody(intro)).toBe('Text above the first heading.');
  });

  it('gives the body as plain text', () => {
    // No emphasis marks, code marks, heading marks or link syntax, and no space where a mark was.
    expect(sectionExcerpt(panel)).toBe('The panel has two tabs. Use Not a link as text. Fields Each field has a label. In a fence');
  });

  it('cuts a long body', () => {
    const [list] = index.get(['Long#big-list']);
    expect(sectionExcerpt(list).length).toBeLessThanOrEqual(241);
    expect(sectionExcerpt(list).endsWith('…')).toBe(true);
  });
});

describe('the bundled docs in the reader', () => {
  const realIndex = bundledDocsIndex();
  const realResolve = createDocsLinkResolver(realIndex);

  it('has no broken docs link, so every link below must resolve', () => {
    expect(docsLinkProblems(BUNDLED_DOCS)).toEqual([]);
  });

  it('opens a section that holds the heading, for every heading of every page', () => {
    const missing: string[] = [];
    for (const [page, markdown] of Object.entries(BUNDLED_DOCS)) {
      for (const heading of docHeadings(markdown)) {
        const id = realResolve('Home', `${page}#${heading.anchor}`);
        const section = id === null ? null : sectionWithId(realIndex, id);
        // A split section keeps the heading on part 1, and a later part may hold a sub-heading.
        const text = id === null ? '' : realIndex.get([id.replace(/-part-\d+$/, '')]).map((s) => s.markdown).join('\n');
        if (!section || !text.includes(heading.text)) missing.push(`${page}#${heading.anchor}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('turns every link between docs pages into a reader link', () => {
    const left: string[] = [];
    let readerLinks = 0;
    for (const { page, sections } of realIndex.contents()) {
      for (const { id } of sections) {
        const section = sectionWithId(realIndex, id)!;
        for (const href of docsHrefsOf(withReaderLinks(section.markdown, page, realResolve))) {
          if (readerLinkTarget(href) === null) left.push(`${id}: ${href}`);
          else readerLinks++;
        }
      }
    }
    expect(left).toEqual([]);
    expect(readerLinks).toBeGreaterThan(100);
  });
});
