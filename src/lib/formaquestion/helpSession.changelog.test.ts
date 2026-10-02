import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { helpSections } from './helpSession';

const index = bundledDocsIndex();
const changelog = index.contents().find((page) => page.page === 'Changelog');
const newestRelease = changelog?.sections.find((section) => section.level === 2);

describe('help session docs block and the changelog', () => {
  it.each(["what's new in the latest update?", 'what changed in the newest version of the app?', 'whats new'])(
    'leads "%s" with the newest release from the bundled changelog',
    (question) => {
      const [first] = helpSections(index, question);
      expect(newestRelease).toBeDefined();
      expect(first?.id).toBe(newestRelease?.id);
    },
  );

  it('sends a guide section, not the changelog, first for a how-to question', () => {
    const [first] = helpSections(index, 'how do I swap the little picture that shows up next to my name?');
    expect(first?.page).not.toBe('Changelog');
  });
});
