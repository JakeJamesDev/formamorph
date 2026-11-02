import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasLicenseText, parseNotices } from './noticesFormat';

describe('parseNotices', () => {
  it('returns entries in file order with their section and text', () => {
    const notices = '# Title\n\nIntro.\n\n## One\n\n### a\n\nFirst.\n\n### b\n\nSecond.\n\n## Two\n\nProse.\n\n### c\n\nThird.\n';
    expect(parseNotices(notices)).toEqual([
      { name: 'a', section: 'One', text: 'First.' },
      { name: 'b', section: 'One', text: 'Second.' },
      { name: 'c', section: 'Two', text: 'Third.' },
    ]);
  });

  it('keeps headings inside a fence as text', () => {
    const notices = '## One\n\n### a\n\n```\n## Commons Clause\n### Not an entry\n```\n\n### b\n\nSecond.\n';
    const entries = parseNotices(notices);
    expect(entries.map((entry) => entry.name)).toEqual(['a', 'b']);
    expect(entries[0].text).toContain('### Not an entry');
  });

  it('closes a long fence only on a fence of its length', () => {
    const notices = '## One\n\n### a\n\n````\n```\n### inner\n```\n### inner too\n````\n\n### b\n\nSecond.\n';
    expect(parseNotices(notices).map((entry) => entry.name)).toEqual(['a', 'b']);
  });

  it('reads CRLF as it reads LF', () => {
    expect(parseNotices('## One\r\n\r\n### a\r\n\r\nFirst.\r\n')).toEqual([{ name: 'a', section: 'One', text: 'First.' }]);
  });

  it('reads the real file: every entry named and non-empty, sections in order', () => {
    const entries = parseNotices(readFileSync('THIRD-PARTY-NOTICES.md', 'utf8'));
    expect([...new Set(entries.map((entry) => entry.section))]).toEqual(['Bundled assets', 'Standards & specifications', 'Components and license texts']);
    expect(entries.filter((entry) => !entry.name || !entry.text)).toEqual([]);
    expect(new Set(entries.map((entry) => entry.name)).size).toBe(entries.length);
  });
});

describe('hasLicenseText', () => {
  it.each([
    ['a filled fence', '- License: **MIT**\n\n```\nMIT\n```', true],
    ['no fence', '- License: **MIT**', false],
    ['an empty fence', '```\n\n```', false],
  ])('reads %s', (_label, text, expected) => {
    expect(hasLicenseText(text)).toBe(expected);
  });
});
