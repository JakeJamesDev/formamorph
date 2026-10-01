import { describe, expect, it } from 'vitest';
import { docHeadings, headingAnchor } from './headingAnchors';
import wikiAnchors from './wikiAnchors.fixture.json';

// Captured from the published GitHub wiki: each page's source headings in order, beside the anchor the
// wiki rendered for it. Refresh by pairing a page's `class="anchor"` hrefs with its source headings.
const WIKI_PAGES: Record<string, string[][]> = wikiAnchors;

describe('headingAnchor', () => {
  it('keeps letters, numbers and hyphens, and turns spaces into hyphens', () => {
    expect(headingAnchor('Stat Descriptors')).toBe('stat-descriptors');
    expect(headingAnchor('1. Get the files')).toBe('1-get-the-files');
  });

  it('drops punctuation and code ticks, and keeps the gap they leave', () => {
    expect(headingAnchor("Play a World's Own Entity")).toBe('play-a-worlds-own-entity');
    expect(headingAnchor('Writing to `self`')).toBe('writing-to-self');
    expect(headingAnchor('Thresholds in: Raw or % of Max')).toBe('thresholds-in-raw-or--of-max');
  });

  it('drops an emoji but keeps its variation selector', () => {
    expect(headingAnchor('🧬 World Editor: Traits')).toBe('-world-editor-traits');
    expect(headingAnchor('🗂️ How worlds are stored')).toBe('\u{FE0F}-how-worlds-are-stored');
  });

  it('slugs a link by its text, not its target', () => {
    expect(headingAnchor('See [Stats](World-Editor-Stats)')).toBe('see-stats');
  });
});

describe('docHeadings', () => {
  it.each(Object.entries(WIKI_PAGES))('matches every anchor the wiki made for %s', (_page, pairs) => {
    const page = pairs.map(([text]) => `## ${text}\n\nBody.\n`).join('\n');
    expect(docHeadings(page).map((h) => h.anchor)).toEqual(pairs.map(([, anchor]) => anchor));
  });

  it('numbers a repeated anchor the way the wiki does', () => {
    const page = '## Fixed\n## Added\n## Fixed\n## Fixed-1\n## Fixed\n';
    expect(docHeadings(page).map((h) => h.anchor)).toEqual(['fixed', 'added', 'fixed-1', 'fixed-1-1', 'fixed-2']);
  });

  it('skips headings inside a code fence', () => {
    const page = '# Real\n```js\n# not a heading\n~~~\n# still code\n```\n## After\n';
    expect(docHeadings(page).map((h) => h.text)).toEqual(['Real', 'After']);
  });

  it('reports level, text and line, and drops a closing hash run', () => {
    expect(docHeadings('intro\n\n### 🎬 Openings ###\n')).toEqual([
      { level: 3, text: '🎬 Openings', anchor: '-openings', line: 2 },
    ]);
  });

  it('needs a space after the hashes', () => {
    expect(docHeadings('#hashtag\n####### seven\n')).toEqual([]);
  });
});
