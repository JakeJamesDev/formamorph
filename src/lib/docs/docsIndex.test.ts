import { describe, expect, it } from 'vitest';
import { createDocsIndex, HUB_PAGE_COUNT, otherPagesLinked, SECTION_CHAR_LIMIT } from './docsIndex';
import { SECTION_CUT_MARKER } from './sectionParts';

const SIDEBAR = ['- [Home](Home)', '**Playing**', '- [Library](Library)', '- [Traits](Traits)', '- [↗ Repo](https://example.com)'].join('\n');

const TRAITS = [
  '# 🧬 Traits',
  '',
  'Traits change who an entity is.',
  '',
  '## How to Make a **Blueprint**',
  '',
  '1. Open the **Traits** tab.',
  '2. Press **New Group**.',
  '',
  '### Naming',
  '',
  'Give it a short name.',
  '',
  '## Trait Links',
  '',
  'A link points at a Blueprint, so one change reaches every entity.',
  '',
  '```md',
  '## Not a heading',
  '```',
].join('\n');

const LIBRARY = ['# 📚 Library', '', 'The board of everything on this device.', '', '## Folders', '', 'Drag one tile onto another.'].join('\n');

const HOME = ['# Home', '', 'Start here.'].join('\n');

function fixtureIndex(extra: Record<string, string> = {}) {
  return createDocsIndex({ pages: { Traits: TRAITS, Library: LIBRARY, Home: HOME, Zed: '# Zed\n\nLast.', ...extra }, sidebar: SIDEBAR });
}

describe('Docs Index contents', () => {
  it('splits a page at # and ## with wiki anchor ids, keeping ### and fenced lines inside', () => {
    const traits = fixtureIndex().contents().find((p) => p.page === 'Traits');
    expect(traits).toEqual({
      page: 'Traits',
      title: '🧬 Traits',
      sections: [
        { id: 'Traits#-traits', label: '🧬 Traits', level: 1 },
        { id: 'Traits#how-to-make-a-blueprint', label: 'How to Make a Blueprint', level: 2 },
        { id: 'Traits#trait-links', label: 'Trait Links', level: 2 },
      ],
    });
  });

  it('lists pages in sidebar order, then unlisted pages by name', () => {
    expect(fixtureIndex().contents().map((p) => p.page)).toEqual(['Home', 'Library', 'Traits', 'Zed']);
  });

  it('gives each section the headings above it', () => {
    const [blueprint] = fixtureIndex().get(['Traits#how-to-make-a-blueprint']);
    expect(blueprint.trail).toEqual(['🧬 Traits']);
  });

  it('keeps text above the first heading as a section named by the page', () => {
    const index = createDocsIndex({ pages: { Notes: 'Loose text.\n\n## Part\n\nMore.' } });
    expect(index.contents()[0].sections.map((s) => s.id)).toEqual(['Notes', 'Notes#part']);
  });
});

describe('Docs Index get', () => {
  it('returns the exact markdown of a section, in the order asked, skipping unknown ids', () => {
    const sections = fixtureIndex().get(['Traits#trait-links', 'Nope#none', 'Library#folders']);
    expect(sections.map((s) => s.markdown)).toEqual([
      ['## Trait Links', '', 'A link points at a Blueprint, so one change reaches every entity.', '', '```md', '## Not a heading', '```'].join('\n'),
      ['## Folders', '', 'Drag one tile onto another.'].join('\n'),
    ]);
  });

  it('keeps sub-headings inside their section', () => {
    const [section] = fixtureIndex().get(['Traits#how-to-make-a-blueprint']);
    expect(section.markdown).toBe(
      ['## How to Make a **Blueprint**', '', '1. Open the **Traits** tab.', '2. Press **New Group**.', '', '### Naming', '', 'Give it a short name.'].join('\n'),
    );
  });
});

describe('Docs Index search', () => {
  it('ranks a heading match above a body-only match', () => {
    const ids = fixtureIndex().search('blueprint').map((s) => s.id);
    expect(ids).toEqual(['Traits#how-to-make-a-blueprint', 'Traits#trait-links']);
  });

  it('matches a plural query to a singular heading and drops filler words', () => {
    expect(fixtureIndex().search('What are blueprints?')[0]?.id).toBe('Traits#how-to-make-a-blueprint');
  });

  it('ranks a section matching more query words above one that repeats a single word', () => {
    const index = createDocsIndex({
      pages: {
        Tiles: '# Tiles\n\n## Tile Sizes\n\nA tile is small, medium or large. Each tile keeps its size. A tile can grow.',
        Folders: '# Folders\n\n## Moving\n\nDrag a tile onto another tile to make a folder.',
        Notes: '# Notes\n\n## Sorting\n\nA folder sorts by name.',
      },
    });
    expect(index.search('tile folder')[0]?.id).toBe('Folders#moving');
  });

  it('returns nothing for a query with no match or only filler words', () => {
    expect(fixtureIndex().search('quasar')).toEqual([]);
    expect(fixtureIndex().search('how do I')).toEqual([]);
  });

  it('returns at most the limit', () => {
    expect(fixtureIndex().search('a link blueprint tile traits', 2)).toHaveLength(2);
  });

  it('does not match words in link targets', () => {
    const index = createDocsIndex({ pages: { P: '# P\n\nSee [the guide](Secret-Page).' } });
    expect(index.search('secret')).toEqual([]);
  });

  it('matches singular and plural, and verb forms, to one stem', () => {
    const index = createDocsIndex({
      pages: {
        Library: '# Library\n\n## How to Make a Folder\n\nPress **New**.',
        Saves: '# Saves\n\n## Backing Up\n\nPress **Save**.',
        Worlds: '# Worlds\n\n## How to Delete a World\n\nPress **Trash**.',
        Play: '# Play\n\n## How to Re-generate a Turn\n\nPress **Again**.',
      },
    });
    const top = (query: string) => index.search(query)[0]?.id;
    expect(top('folders')).toBe('Library#how-to-make-a-folder');
    expect(top('backed')).toBe('Saves#backing-up');
    expect(top('deleting')).toBe('Worlds#how-to-delete-a-world');
    expect(top('regenerating')).toBe('Play#how-to-re-generate-a-turn');
  });
});

describe('Docs Index search: guide above the changelog', () => {
  // The shape `releasedMinorChangelog` gives the index: a title, then released sections newest first. The
  // newest is over the size limit, so it splits at its sub-headings, and "Minor Changes" keeps only a heading.
  const filler = Array.from({ length: Math.ceil(SECTION_CHAR_LIMIT / 30) }, (_, i) => `- **Entry ${i}:** a tile moves.`);
  const CHANGELOG = [
    '# 📝 Changelog',
    '',
    '## ✅ 3.1.2 — Released 2026-09-30',
    '',
    'This version fixes the profile image.',
    '',
    '### Minor Changes',
    '',
    '#### ➕ Added',
    '',
    ...filler,
    '',
    '#### 🔧 Fixed',
    '',
    '- **Profile Image:** a change to the profile image keeps its position. Changing the profile image again saves.',
    '',
    '## ✅ 3.1.1 — Released 2026-09-20',
    '',
    'Morph art.',
    '',
    '- **Morph Art:** blank entities get art.',
  ].join('\n');
  // The guide section matches fewer of the question's words than the changelog section does.
  const AVATARS = ['# Avatars', '', '## User Profile', '', 'Open **User Profile** and pick an image.'].join('\n');
  const UPDATES = ['# Updates', '', '## How to Update the App', '', 'The latest version installs when you restart.'].join('\n');
  const index = () => createDocsIndex({ pages: { Avatars: AVATARS, Updates: UPDATES, Changelog: CHANGELOG } });

  const NEWEST_RELEASE = ['Changelog#-312--released-2026-09-30', 'Changelog#-added', 'Changelog#-added-part-2', 'Changelog#-fixed'];

  it('ranks every matching guide section above every matching changelog section', () => {
    const ids = index().search('change the profile image', 20).map((s) => s.id);
    expect(ids[0]).toBe('Avatars#user-profile');
    expect(ids.slice(1).every((id) => id.startsWith('Changelog#'))).toBe(true);
    expect(ids).toContain('Changelog#-fixed');
  });

  it('leads a what-is-new question with the newest release sections that hold text, then guide hits', () => {
    const ids = index().search("what's new in the latest update?", 20).map((s) => s.id);
    expect(ids.slice(0, NEWEST_RELEASE.length)).toEqual(NEWEST_RELEASE);
    expect(ids[NEWEST_RELEASE.length]).toBe('Updates#how-to-update-the-app');
    expect(ids).not.toContain('Changelog#minor-changes');
  });

  it('leads with the release a question names, and with none when the index lacks it', () => {
    expect(index().search('what was fixed in 3.1.1?')[0]?.id).toBe('Changelog#-311--released-2026-09-20');
    expect(index().search('what changed in 3.0?').map((s) => s.id)).not.toContain('Changelog#-312--released-2026-09-30');
  });

  it.each([
    'whats new', "What's new?", 'what changed in the newest version of the app?', 'anything new?', "what's in the latest update?",
    'recent changes', 'changes in the latest version', 'patch notes', 'new features?', 'what did the last update add?',
    'show me the changelog', "what's changed?", 'what is new in Formamorph?',
  ])('reads "%s" as a what-is-new question', (question) => {
    expect(index().search(question).map((s) => s.id).slice(0, NEWEST_RELEASE.length)).toEqual(NEWEST_RELEASE);
  });

  it.each([
    'what does the Listing Changelog do?', 'how do I edit the changelog of my listing?', 'what is different between a Group and a folder?',
    'what was added to the AI context?', 'what are fixed stats?', 'what is new game plus', 'what changed my stat?',
    "what's new with the stat code?", "what's added to the prompt each turn?", 'how do I update to the latest version?',
    'how do I turn on new features',
  ])('reads "%s" as a guide question', (question) => {
    expect(index().search(question).map((s) => s.id).slice(0, NEWEST_RELEASE.length)).not.toEqual(NEWEST_RELEASE);
  });

  it('keeps the first guide hit under a full floor when a changelog hit scores higher', () => {
    expect(index().search('change the profile image', 20, undefined, { floor: 1 })[0]?.id).toBe('Avatars#user-profile');
  });

  it('keeps the sections a what-is-new question leads with, and the top hit after them, under a full floor', () => {
    const question = "what's new in the latest update?";
    expect(index().search(question, 20).length).toBeGreaterThan(NEWEST_RELEASE.length + 1);
    expect(index().search(question, 20, undefined, { floor: 1 }).map((s) => s.id)).toEqual([...NEWEST_RELEASE, 'Updates#how-to-update-the-app']);
  });
});

describe('Docs Index keyword line', () => {
  const page = (heading: string, keywords: string) =>
    `# P\n\n## ${heading}\n${keywords}\nPress **Go** to start.\n`;
  const KEYWORDS = '<!-- keywords: folder, directory -->';

  it('finds a section by a word only its keyword line holds', () => {
    const index = createDocsIndex({ pages: { Library: page('How to Make a Group', KEYWORDS) } });
    expect(index.search('make a directory')[0]?.id).toBe('Library#how-to-make-a-group');
  });

  it('ranks a keyword-line match like a heading match', () => {
    const pages = {
      Heading: page('How to Make a Folder', ''),
      Keyword: page('How to Make a Group', KEYWORDS),
      Body: '# P\n\n## Tiles\n\nA folder holds tiles. Open the folder. Close the folder.\n',
    };
    // Equal scores keep page order, so each sidebar order puts its first page first.
    const first = (sidebar: string) => createDocsIndex({ pages, sidebar }).search('folder').map((s) => s.page);
    expect(first('[a](Heading) [b](Keyword) [c](Body)')).toEqual(['Heading', 'Keyword', 'Body']);
    expect(first('[a](Keyword) [b](Heading) [c](Body)')).toEqual(['Keyword', 'Heading', 'Body']);
  });

  it('keeps the keyword line out of the section text', () => {
    const index = createDocsIndex({ pages: { Library: page('How to Make a Group', KEYWORDS) } });
    expect(index.get(['Library#how-to-make-a-group'])[0]?.markdown).toBe('## How to Make a Group\nPress **Go** to start.');
  });

  it('reads no keyword line inside a code fence', () => {
    const fenced = '# P\n\n## Syntax\n\n```md\n<!-- keywords: zebra -->\n```\n';
    const index = createDocsIndex({
      pages: { A: fenced, B: '# Q\n\n## Stripes\n<!-- keywords: zebra -->\nA long body about stripes and more stripes.\n' },
      sidebar: '[a](A) [b](B)',
    });
    expect(index.search('zebra').map((s) => s.id)).toEqual(['B#stripes', 'A#syntax']);
    expect(index.get(['A#syntax'])[0]?.markdown).toContain('<!-- keywords: zebra -->');
  });
});

describe('Docs Index route line', () => {
  const ROUTE = '<!-- route: settings.display -->';
  const page = (route: string) => `# P\n\n## How to Go\n<!-- keywords: leave -->\n${route}\nPress **Go** to start.\n`;

  it('stores the route on its section and keeps the line out of the text', () => {
    const index = createDocsIndex({ pages: { Library: page(ROUTE) } });
    const [section] = index.get(['Library#how-to-go']);
    expect(section.route).toBe('settings.display');
    expect(section.markdown).toBe('## How to Go\nPress **Go** to start.');
  });

  it('gives a section without a route line no route', () => {
    const index = createDocsIndex({ pages: { Library: page('') } });
    expect(index.get(['Library#how-to-go'])[0].route).toBeUndefined();
  });

  it('reads a fragment as the target, apart from the surface id', () => {
    const index = createDocsIndex({ pages: { Library: page('<!-- route: settings.display#narration-layout -->') } });
    const [section] = index.get(['Library#how-to-go']);
    expect(section.route).toBe('settings.display');
    expect(section.target).toBe('narration-layout');
    expect(section.markdown).toBe('## How to Go\nPress **Go** to start.');
  });

  it('gives a bare route, and an empty fragment, no target', () => {
    const bare = createDocsIndex({ pages: { Library: page(ROUTE) } }).get(['Library#how-to-go'])[0];
    expect(bare).not.toHaveProperty('target');
    const empty = createDocsIndex({ pages: { Library: page('<!-- route: settings.display# -->') } }).get(['Library#how-to-go'])[0];
    expect(empty.route).toBe('settings.display');
    expect(empty).not.toHaveProperty('target');
  });

  it('gives each part of a split section the route', () => {
    const item = (n: number) => `- Item ${n}: ${Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')}`;
    const long = ['# Big', '', '## List', ROUTE, '', ...Array.from({ length: 12 }, (_, n) => item(n))].join('\n');
    const parts = createDocsIndex({ pages: { Big: long } }).get(['Big#list']);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((part) => part.route)).toEqual(parts.map(() => 'settings.display'));
  });

  it('keeps the route out of the search phrases', () => {
    const pages = { Library: page(ROUTE) };
    expect(createDocsIndex({ pages }).search('settings display')).toEqual([]);
  });

  it('reads no route line inside a code fence', () => {
    const fenced = `# P\n\n## Syntax\n\n\`\`\`md\n${ROUTE}\n\`\`\`\n`;
    const [section] = createDocsIndex({ pages: { A: fenced } }).get(['A#syntax']);
    expect(section.route).toBeUndefined();
    expect(section.markdown).toContain(ROUTE);
  });

  it('takes no route line from under a sub-heading the section holds', () => {
    const pages = { A: `# A\n\n## Part\n\nIntro.\n\n### One\n${ROUTE}\n\nText.\n` };
    const [section] = createDocsIndex({ pages }).get(['A#part']);
    expect(section.route).toBeUndefined();
    expect(section.markdown).toContain(ROUTE);
  });

  it('gives a sub-heading its own route when the index cuts the section there', () => {
    const filler = Array.from({ length: 700 }, (_, i) => `word${i}`).join(' ');
    const page = ['# Big', '', '## Part', '', 'Intro.', '', '### One', ROUTE, '', filler, '', '### Two', '', filler].join('\n');
    const index = createDocsIndex({ pages: { Big: page } });
    expect(index.get(['Big#one'])[0].route).toBe('settings.display');
    expect(index.get(['Big#part'])[0].route).toBeUndefined();
  });

  it('counts no route line toward the size limit', () => {
    const route = `<!-- route: ${'x'.repeat(SECTION_CHAR_LIMIT)} -->`;
    const index = createDocsIndex({ pages: { Big: `# Big\n\n## Part\n${route}\n\nIntro.\n\n### One\n\nText.\n` } });
    expect(index.contents()[0].sections.map((s) => s.label)).toEqual(['Big', 'Part']);
  });
});

describe('Docs Index section size', () => {
  const filler = (words: number) => Array.from({ length: words }, (_, i) => `word${i}`).join(' ');

  it('splits a section over the limit at its sub-headings', () => {
    const page = ['# Big', '', '## Part', '', 'Intro.', '', '### One', '', filler(700), '', '### Two', '', filler(700)].join('\n');
    expect(page.length).toBeGreaterThan(SECTION_CHAR_LIMIT);
    const index = createDocsIndex({ pages: { Big: page } });
    expect(index.contents()[0].sections.map((s) => s.id)).toEqual(['Big#big', 'Big#part', 'Big#one', 'Big#two']);
    const [part, one] = index.get(['Big#part', 'Big#one']);
    expect(part.markdown).toBe('## Part\n\nIntro.');
    expect(one.trail).toEqual(['Big', 'Part']);
  });

  it('counts no keyword line toward the size limit', () => {
    const keywords = (n: number) => `<!-- keywords: ${filler(500).replace(/ /g, ', ')} ${n} -->`;
    const page = ['# Big', '', '## Part', keywords(0), '', 'Intro.', '', '### One', keywords(1), '', 'Text.', '', '### Two', keywords(2), '', 'Text.'].join('\n');
    expect(page.length).toBeGreaterThan(SECTION_CHAR_LIMIT);
    const index = createDocsIndex({ pages: { Big: page } });
    expect(index.contents()[0].sections.map((s) => s.label)).toEqual(['Big', 'Part']);
    expect(index.search('word499 1').map((s) => s.id)).toEqual(['Big#part']);
  });

  it('splits a section with no sub-headings into parts at top-level list items', () => {
    const item = (n: number) => `- Item ${n}: ${filler(80)}\n  - nested ${n}\n\n  more ${n}`;
    const page = ['# Big', '', '## List', '', ...Array.from({ length: 12 }, (_, n) => item(n))].join('\n');
    const index = createDocsIndex({ pages: { Big: page } });
    const parts = index.get(['Big#list']);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((s) => s.id)).toEqual(['Big#list', ...parts.slice(1).map((_, k) => `Big#list-part-${k + 2}`)]);
    expect(parts.map((s) => s.label)).toEqual(parts.map((_, k) => `List (Part ${k + 1})`));
    expect(index.contents()[0].sections.map((s) => s.label)).toEqual(['Big', ...parts.map((p) => p.label)]);
    for (const part of parts) {
      expect(part.markdown.length).toBeLessThanOrEqual(SECTION_CHAR_LIMIT);
      expect(part.markdown.startsWith('## List\n\n- Item ')).toBe(true);
      // Each item stays whole in one part: its nested line and its continuation paragraph come along.
      expect(part.markdown.match(/^- Item/gm)?.length).toBe(part.markdown.match(/^ {2}more/gm)?.length);
    }
    const joined = parts.map((p) => p.markdown).join('\n');
    for (let n = 0; n < 12; n++) expect(joined).toContain(`  more ${n}`);
  });

  it('returns every part in order for the id of a split section, and one part for a part id', () => {
    const page = ['# Big', '', '## Wall', '', ...Array.from({ length: 30 }, (_, n) => `Paragraph ${n} ${filler(40)}\n`)].join('\n');
    const index = createDocsIndex({ pages: { Big: page } });
    const parts = index.get(['Big#wall']);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((p) => p.id)).toEqual(['Big#wall', ...parts.slice(1).map((_, k) => `Big#wall-part-${k + 2}`)]);
    expect(index.get(['Big#wall-part-2']).map((p) => p.id)).toEqual(['Big#wall-part-2']);
  });

  it('repeats a table header row in each part that holds rows of the table', () => {
    const rows = Array.from({ length: 60 }, (_, n) => `| Term ${n} | ${filler(15)} |`);
    const page = ['# Glossary', '', '## Terms', '', '| Term | Meaning |', '|---|---|', ...rows].join('\n');
    const parts = createDocsIndex({ pages: { Glossary: page } }).get(['Glossary#terms']);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.markdown.startsWith('## Terms\n\n| Term | Meaning |\n|---|---|\n| Term ')).toBe(true);
    }
    expect(parts.flatMap((p) => p.markdown.match(/^\| Term \d+/gm) ?? [])).toHaveLength(60);
  });

  it('splits a list item over the limit at its nested items, repeating its lead lines in each part', () => {
    const feature = (n: number) => `    - Feature ${n}: ${filler(60)}`;
    const group = (g: number) => [`  - **Group ${g}:**`, ...Array.from({ length: 16 }, (_, n) => feature(g * 100 + n))];
    const page = ['# Log', '', '## Added', '', '- **User-facing**', ...group(1), ...group(2), '- **Developer tooling**', '  - Small.'].join('\n');
    const parts = createDocsIndex({ pages: { Log: page } }).get(['Log#added']);
    expect(parts.length).toBeGreaterThan(2);
    for (const part of parts) {
      expect(part.markdown.length).toBeLessThanOrEqual(SECTION_CHAR_LIMIT);
      expect(part.markdown).not.toContain(SECTION_CUT_MARKER);
      // A part opens with the lead lines of the list it starts inside, so every feature keeps its group.
      expect(part.markdown).toMatch(/^## Added\n\n- \*\*(User-facing\*\*\n {2}- \*\*Group \d:\*\*\n {4}- Feature|Developer tooling)/);
    }
    const features = parts.flatMap((p) => p.markdown.match(/Feature \d+/g) ?? []);
    expect(features).toEqual([...group(1), ...group(2)].flatMap((line) => line.match(/Feature \d+/g) ?? []));
    expect(parts.at(-1)?.markdown.endsWith('- **Developer tooling**\n  - Small.')).toBe(true);
  });

  it('splits between code fences, never inside one', () => {
    const fence = (n: number) => ['```md', `- not an item ${n}`, '', filler(70), '```'].join('\n');
    const page = ['# Code', '', '## Samples', '', ...Array.from({ length: 12 }, (_, n) => `${fence(n)}\n`)].join('\n');
    const parts = createDocsIndex({ pages: { Code: page } }).get(['Code#samples']);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.markdown.match(/^```md$/gm)?.length).toBe(part.markdown.match(/^```$/gm)?.length);
    }
    expect(parts.flatMap((p) => p.markdown.match(/not an item \d+/g) ?? [])).toHaveLength(12);
  });

  it('closes a cut code fence with its own marker', () => {
    const page = ['# Code', '', '## Wall', '', '~~~', ...Array.from({ length: 200 }, (_, n) => `line ${n} ${filler(6)}`), '~~~'].join('\n');
    const [wall] = createDocsIndex({ pages: { Code: page } }).get(['Code#wall']);
    expect(wall.markdown.length).toBeLessThanOrEqual(SECTION_CHAR_LIMIT);
    expect(wall.markdown.endsWith(`\n~~~\n\n${SECTION_CUT_MARKER}`)).toBe(true);
  });

  it('cuts a single block over the limit, with a marker', () => {
    const page = ['# Big', '', '## Wall', '', filler(1500)].join('\n');
    const [wall] = createDocsIndex({ pages: { Big: page } }).get(['Big#wall']);
    expect(wall.markdown.length).toBeLessThanOrEqual(SECTION_CHAR_LIMIT);
    expect(wall.markdown.endsWith(SECTION_CUT_MARKER)).toBe(true);
  });
});

describe('Docs Index search: filler words', () => {
  const PAGES = {
    Help: '# Help\n\n## Help for This Screen\n\nOpen **Help for This Screen** to read about the screen.\n',
    Map: '# Map\n\n## Pin a Place\n\nDrag a pin here to mark a place.\n',
    Tour: '# Tour\n\n## Here\n\nPress **Here** to begin the tour.\n',
  };
  const index = (fillerWords?: boolean) => createDocsIndex({ pages: PAGES, fillerWords });

  it('does not match a section on "here" in the question or its body', () => {
    expect(index().search('what am I looking at here?')).toEqual([]);
    expect(index(false).search('what am I looking at here?').length).toBeGreaterThan(0);
  });

  it('matches a section by its own name when the name holds a filler word', () => {
    expect(index().search('how do I use Here?')[0]?.id).toBe('Tour#here');
    expect(index().search('how do I use Help for This Screen?')[0]?.id).toBe('Help#help-for-this-screen');
  });

  it('matches a section by a keyword-line phrase that holds a filler word', () => {
    const keyed = createDocsIndex({ pages: { Tour: '# Tour\n\n## Start\n<!-- keywords: start here -->\nPress **Go**.\n' } });
    expect(keyed.search('where do I start here')[0]?.id).toBe('Tour#start');
    expect(keyed.search('what am I looking at here?')).toEqual([]);
  });

  it('counts a name only as whole words of the question', () => {
    expect(index().search('how do I use there?')).toEqual([]);
    expect(index().search('how do I use here?').map((s) => s.id)).toEqual(['Tour#here']);
  });

  it('keeps a topic word beside a filler word', () => {
    expect(index().search('how do I pin a place here?')[0]?.id).toBe('Map#pin-a-place');
  });
});

describe('Docs Index search: hub sections', () => {
  const links = Array.from({ length: HUB_PAGE_COUNT }, (_, i) => `[Page ${i}](Page${i})`).join(', ');
  const PAGES = {
    Overview: `# Overview\n\n## Stat Overview\n\nStats link to ${links}. Add a stat to track hunger. A stat tracks hunger when you add a stat. Add a stat, add a stat.\n`,
    Stats: '# Stats\n\n## Tracking\n\nTrack a stat for hunger.\n',
  };
  const index = createDocsIndex({ pages: PAGES });

  it('marks a section that links to enough other pages, and not one that links to fewer', () => {
    const section = (id: string) => index.get([id])[0];
    expect(otherPagesLinked(section('Overview#stat-overview'))).toBe(HUB_PAGE_COUNT);
    expect(otherPagesLinked(section('Stats#tracking'))).toBe(0);
  });

  it('counts each page once and skips its own page and same-page links', () => {
    const markdown = '[a](Other), [b](Other#x), [c](Own), [d](#here), [e](https://example.com), `[f](Code)`';
    expect(otherPagesLinked({ page: 'Own', markdown })).toBe(1);
  });

  it('ranks a specific section above a hub for a task question that matches both', () => {
    const ids = index.search('how do I add a stat to track hunger?').map((s) => s.id);
    expect(ids.indexOf('Stats#tracking')).toBeLessThan(ids.indexOf('Overview#stat-overview'));
    expect(ids).toContain('Overview#stat-overview');
  });

  it('finds a hub when the question holds its heading as a phrase', () => {
    expect(index.search('stat overview')[0]?.id).toBe('Overview#stat-overview');
  });
});

describe('Docs Index search: score floor', () => {
  const index = createDocsIndex({
    pages: {
      Editor: '# Editor\n\n## Find and Replace\n\nRename the villain everywhere in the world with **Find and Replace**.\n',
      Library: '# Library\n\n## Groups\n\nRename a group from its menu.\n',
    },
  });
  const question = 'rename the villain everywhere in the world';

  it('keeps every hit with no floor', () => {
    expect(index.search(question).map((s) => s.id)).toEqual(['Editor#find-and-replace', 'Library#groups']);
  });

  it('leaves out a hit under the share of the top hit', () => {
    expect(index.search(question, 5, undefined, { floor: 0.5 }).map((s) => s.id)).toEqual(['Editor#find-and-replace']);
  });

  it('keeps the top hit under a full floor', () => {
    expect(index.search(question, 5, undefined, { floor: 1 }).map((s) => s.id)).toEqual(['Editor#find-and-replace']);
    expect(index.search('rename a group', 5, undefined, { floor: 1 })[0]?.id).toBe('Library#groups');
  });
});
