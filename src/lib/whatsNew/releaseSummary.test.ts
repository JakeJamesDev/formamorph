// @vitest-environment node
import { readFileSync } from 'node:fs';
import * as lucide from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { MAJOR_ICONS, SUMMARY_LENGTH_WARNING, majorIcon, parseReleaseSummary } from './releaseSummary';

const SEED = readFileSync('docs/whats-new/3.7.0.md', 'utf8');
const FOOTER = '\n---\n\n[Full changelog](https://github.com/JakeJamesDev/formamorph/wiki/Changelog)\n';

const errors = (md: string, version?: string) =>
  parseReleaseSummary(md, { version }).problems.filter((p) => p.severity === 'error').map((p) => p.message);
const warnings = (md: string) =>
  parseReleaseSummary(md).problems.filter((p) => p.severity === 'warning').map((p) => p.message);

describe('the 3.7.0 seed', () => {
  it('parses to the full 3.7.0 shape with no problems', () => {
    const { summary, problems } = parseReleaseSummary(SEED, { version: '3.7.0' });
    expect(problems).toEqual([]);
    expect(summary.version).toBe('3.7.0');
    expect(summary.intro).toHaveLength(2);
    expect(summary.intro[0]).toMatch(/^This update adds a few new features .* moving around the world\.$/);
    expect(summary.major.map((m) => [m.title, m.icon, m.pair?.title ?? null])).toEqual([
      ['Since Last Turn', 'Hourglass', null],
      ['Daily routines', 'CalendarClock', 'Map strangers'],
    ]);
    expect(summary.major[1].pair?.body).toBe('the in-game Map shows entities you haven\'t met, under a name you heard or as unknowns.');
    expect(summary.newItems.map((n) => n.title)).toEqual(['Avatar looks from stats and traits', 'Openings and Connections tabs']);
    expect(summary.fixes).toEqual([
      'The item parser properly finds characters named by an alias, times of day like `evening` start on the hour, a failed turn puts your action back, and more.',
    ]);
  });

  it('parses the same with Windows line endings', () => {
    expect(parseReleaseSummary(SEED.replace(/\n/g, '\r\n'))).toEqual(parseReleaseSummary(SEED));
  });

  it('parses the same behind a byte order mark', () => {
    expect(parseReleaseSummary(String.fromCharCode(0xfeff) + SEED)).toEqual(parseReleaseSummary(SEED));
  });
});

describe('sections', () => {
  const intro = '# Formamorph v3.8.0\n\nIntro.\n\n';

  it('accepts a summary without New and Fixes', () => {
    const { summary, problems } = parseReleaseSummary(`${intro}## Major\n\n- ✨ **Shiny** — a thing.\n`);
    expect(problems).toEqual([]);
    expect(summary.major).toEqual([{ title: 'Shiny', body: 'a thing.', emoji: '✨', icon: 'Sparkles', pair: null }]);
    expect(summary.newItems).toEqual([]);
    expect(summary.fixes).toEqual([]);
  });

  it('accepts a patch with only Fixes, across several paragraphs', () => {
    const { summary, problems } = parseReleaseSummary(`${intro}## Fixes\n\nOne fix.\nStill the first.\n\nA second fix.\n`);
    expect(problems).toEqual([]);
    expect(summary.fixes).toEqual(['One fix. Still the first.', 'A second fix.']);
  });

  it('refuses a summary with no Major, New or Fixes content', () => {
    expect(errors(`${intro}## Major\n\n## Fixes\n`)).toEqual(['The summary has no Major, New or Fixes content.']);
  });

  it('warns when the intro is missing', () => {
    expect(warnings('# Formamorph v3.8.0\n\n## Fixes\n\nA fix.\n')).toEqual(['The summary has no intro paragraph.']);
  });

  it('refuses an unknown heading and drops its content', () => {
    const md = `${intro}## Fixes\n\nA fix.\n\n## Highlights\n\n- **Lost** — never read.\n`;
    expect(errors(md)).toEqual(['Unknown heading "## Highlights". Use only "## Major", "## New" and "## Fixes".']);
    expect(parseReleaseSummary(md).summary.fixes).toEqual(['A fix.']);
  });

  it('refuses a deeper heading inside a section', () => {
    expect(errors(`${intro}## Fixes\n\nA fix.\n\n### Small fixes\n`)).toHaveLength(1);
  });
});

describe('the title', () => {
  it('refuses a missing title', () => {
    const md = 'Intro.\n\n## Fixes\n\nA fix.\n';
    expect(errors(md)).toEqual(['The summary has no "# Formamorph v<version>" title.']);
    expect(parseReleaseSummary(md).summary.version).toBeNull();
  });

  it('refuses a title in another form', () => {
    expect(errors('# What\'s New in 3.8.0\n\nIntro.\n\n## Fixes\n\nA fix.\n')).toEqual([
      'The title must read "# Formamorph v<version>", not "# What\'s New in 3.8.0".',
    ]);
  });

  it('refuses a title that names another version, pre-release suffix included', () => {
    const md = '# Formamorph v3.8.0\n\nIntro.\n\n## Fixes\n\nA fix.\n';
    expect(errors(md, '3.8.0')).toEqual([]);
    expect(errors(md, '3.8.0-beta')).toEqual(['The title names v3.8.0, but this summary is for v3.8.0-beta.']);
    expect(parseReleaseSummary(md.replace('3.8.0', '3.8.0-beta')).summary.version).toBe('3.8.0-beta');
  });
});

describe('Major items', () => {
  const wrap = (major: string) => `# Formamorph v3.8.0\n\nIntro.\n\n## Major\n\n${major}\n`;

  it('refuses an item without an emoji, and keeps it without an icon', () => {
    const md = wrap('- **Plain** — no emoji.');
    expect(errors(md)).toEqual(['The Major item "Plain" has no emoji.']);
    expect(parseReleaseSummary(md).summary.major[0]).toMatchObject({ title: 'Plain', emoji: '', icon: null });
  });

  it('refuses an emoji outside the icon map, and keeps the item without an icon', () => {
    const md = wrap('- 🦄 **Unicorn** — unmapped.');
    expect(errors(md)).toEqual(['The emoji 🦄 on "Unicorn" has no icon. Use one from the icon map.']);
    expect(parseReleaseSummary(md).summary.major[0]).toMatchObject({ title: 'Unicorn', emoji: '🦄', icon: null });
    expect(parseReleaseSummary(md).problems.map((p) => p.code)).toEqual(['unmapped-emoji']);
  });

  it('marks the other Major errors with their own codes', () => {
    const codes = (md: string) => parseReleaseSummary(md).problems.filter((p) => p.severity === 'error').map((p) => p.code);
    expect(codes(wrap('- **Plain** — no emoji.'))).toEqual(['major-no-emoji']);
    // The malformed item is dropped, which leaves the summary empty.
    expect(codes(wrap('- ✨ Shiny: a thing.'))).toEqual(['major-item-shape', 'empty']);
  });

  it('refuses an item that is not "**Title** — body", and drops it', () => {
    const md = wrap('- ✨ Shiny: a thing.');
    expect(errors(md)).toEqual([
      'A Major item must read "<emoji> **Title** — body": "✨ Shiny: a thing.".',
      'The summary has no Major, New or Fixes content.',
    ]);
    expect(parseReleaseSummary(md).summary.major).toEqual([]);
  });

  it('refuses a malformed pair', () => {
    expect(errors(wrap('- ✨ **Shiny** — a thing.\n  - Paired but plain.'))).toEqual([
      'A New item must read "**Title** — body": "Paired but plain.".',
    ]);
  });

  it('matches an emoji with or without its variation selector', () => {
    expect(parseReleaseSummary(wrap('- 🗓 **Bare** — no selector.')).summary.major[0].icon).toBe('CalendarClock');
    expect(majorIcon('🗓️')).toBe('CalendarClock');
    expect(majorIcon('🗓')).toBe('CalendarClock');
  });

  it('reads a tab-indented bullet as the pair', () => {
    const { summary, problems } = parseReleaseSummary(wrap('- ✨ **Shiny** — a thing.\n\t- **Pair** — paired.'));
    expect(problems).toEqual([]);
    expect(summary.major[0]).toMatchObject({ body: 'a thing.', pair: { title: 'Pair', body: 'paired.' } });
  });

  it('joins a wrapped body line onto its item', () => {
    expect(parseReleaseSummary(wrap('- ✨ **Shiny** — a thing\n  that wraps.')).summary.major[0].body).toBe('a thing that wraps.');
  });
});

describe('the end of the summary', () => {
  it('ignores the Full changelog link the release workflow appends', () => {
    expect(parseReleaseSummary(SEED + FOOTER)).toEqual(parseReleaseSummary(SEED));
  });

  it('ends at a `---` directly under text, which CommonMark would read as a heading underline', () => {
    const md = '# Formamorph v3.8.0\n\nIntro.\n\n## Fixes\n\nA fix.\n---\nMore.\n';
    expect(parseReleaseSummary(md).summary.fixes).toEqual(['A fix.']);
  });

  it('ignores everything after the first thematic break', () => {
    const md = '# Formamorph v3.8.0\n\nIntro.\n\n## Fixes\n\nA fix.\n\n***\n\n## Unknown\n\nMore.\n';
    const { summary, problems } = parseReleaseSummary(md);
    expect(problems).toEqual([]);
    expect(summary.fixes).toEqual(['A fix.']);
  });
});

describe('a hand-edited body with extra content', () => {
  const edited = [
    'Release notes, pasted by hand.',
    '',
    '# Formamorph v3.7.0',
    '',
    'Intro.',
    '',
    '## Major',
    '',
    '- ⏳ **Since Last Turn** — a tray.',
    '',
    'A stray note between items.',
    '',
    '- 🗓️ **Daily routines** — schedules.',
    '  - **Map strangers** — unknowns.',
    '  - **Second pair** — one too many.',
    '',
    '## New',
    '',
    '- 🎨 **Avatar looks** — sliders.',
    '  - **Nested** — New items have no pairs.',
    '',
    '## Fixes',
    '',
    '- A fix written as a list.',
  ].join('\n');

  it('keeps every highlight and only warns', () => {
    const { summary, problems } = parseReleaseSummary(edited, { version: '3.7.0' });
    expect(problems.every((p) => p.severity === 'warning')).toBe(true);
    expect(problems.map((p) => p.line)).toEqual([3, 11, 15, 19, 20, 24]);
    expect(summary.intro).toEqual(['Intro.']);
    expect(summary.major.map((m) => [m.title, m.pair?.title ?? null])).toEqual([
      ['Since Last Turn', null],
      ['Daily routines', 'Map strangers'],
    ]);
    expect(summary.newItems).toEqual([{ title: 'Avatar looks', body: 'sliders.' }]);
    expect(summary.fixes).toEqual(['- A fix written as a list.']);
  });

  it('merges a repeated section with a warning', () => {
    const md = '# Formamorph v3.8.0\n\nIntro.\n\n## New\n\n- **A** — a.\n\n## New\n\n- **B** — b.\n';
    const { summary, problems } = parseReleaseSummary(md);
    expect(summary.newItems.map((n) => n.title)).toEqual(['A', 'B']);
    expect(problems).toEqual([{ severity: 'warning', code: 'duplicate-section', line: 9, message: '"## New" appears twice; its items are merged.' }]);
  });
});

describe('the length warning', () => {
  it('stays quiet for the seed and warns once a summary passes the limit', () => {
    expect(warnings(SEED)).toEqual([]);
    const long = `${SEED}\n${'x'.repeat(SUMMARY_LENGTH_WARNING)}\n`;
    expect(warnings(long)).toEqual([expect.stringMatching(/visible characters, past 1450; What's New will scroll\.$/)]);
    expect(errors(long)).toEqual([]);
  });
});

describe('the icon map', () => {
  it('names only icons lucide-react exports', () => {
    const missing = Object.values(MAJOR_ICONS).filter((name) => !(name in lucide));
    expect(missing).toEqual([]);
  });

  it('holds no variation selectors in its keys', () => {
    expect(Object.keys(MAJOR_ICONS).filter((key) => key.includes('\uFE0F'))).toEqual([]);
  });
});
