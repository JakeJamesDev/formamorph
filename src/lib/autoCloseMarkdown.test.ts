import { describe, it, expect } from 'vitest';
import { autoCloseMarkdown, streamingMarkdown } from './autoCloseMarkdown';

describe('autoCloseMarkdown', () => {
  it('leaves complete / plain text unchanged', () => {
    expect(autoCloseMarkdown('')).toBe('');
    expect(autoCloseMarkdown('Just some prose.')).toBe('Just some prose.');
    expect(autoCloseMarkdown('He said **hello** and left.')).toBe('He said **hello** and left.');
  });

  it('closes an open bold/italic run', () => {
    expect(autoCloseMarkdown('He said **hel')).toBe('He said **hel**');
    expect(autoCloseMarkdown('an *ital')).toBe('an *ital*');
    expect(autoCloseMarkdown('***both')).toBe('***both***');
  });

  it('closes nested emphasis innermost-first', () => {
    expect(autoCloseMarkdown('a *b _c')).toBe('a *b _c_*');
  });

  it('holds back a trailing partial closing delimiter so the render does not flicker', () => {
    // The closing ** streams as **bold -> **bold* -> **bold**; all three must render the same.
    expect(autoCloseMarkdown('He said **bold')).toBe('He said **bold**');
    expect(autoCloseMarkdown('He said **bold*')).toBe('He said **bold**');
    expect(autoCloseMarkdown('He said **bold**')).toBe('He said **bold**');
  });

  it('holds back a trailing opening delimiter until content follows', () => {
    expect(autoCloseMarkdown('He said **')).toBe('He said ');
    expect(autoCloseMarkdown('an *')).toBe('an ');
    expect(autoCloseMarkdown('a ~~')).toBe('a ');
    expect(autoCloseMarkdown('run `')).toBe('run ');
  });

  it('renders a bold phrase identically across its closing-delimiter frames (no flicker)', () => {
    const stable = 'a vault of **salt-stained shelves**';
    expect(autoCloseMarkdown('a vault of **salt-stained shelves')).toBe(stable);
    expect(autoCloseMarkdown('a vault of **salt-stained shelves*')).toBe(stable);
    expect(autoCloseMarkdown('a vault of **salt-stained shelves**')).toBe(stable);
  });

  it('tucks a closing delimiter before trailing whitespace (a space before it breaks flanking)', () => {
    // `**salt-stained ` must close as `**salt-stained** ` — `**salt-stained **` cannot close per
    // CommonMark flanking, so the run would render unstyled for a frame as the reveal crosses a space.
    expect(autoCloseMarkdown('a vault of **salt-stained ')).toBe('a vault of **salt-stained** ');
    expect(autoCloseMarkdown('an *italic ')).toBe('an *italic* ');
    expect(autoCloseMarkdown('a ~~struck ')).toBe('a ~~struck~~ ');
  });

  it('auto-closes an in-progress link so the label renders', () => {
    expect(autoCloseMarkdown('See [the map](http')).toBe('See [the map](http)');
    expect(autoCloseMarkdown('See [the map](')).toBe('See [the map]()');
    expect(autoCloseMarkdown('See [the map](http://x)')).toBe('See [the map](http://x)');
    expect(autoCloseMarkdown('plain [not a link] yet')).toBe('plain [not a link] yet');
  });

  it('leaves a bare table header alone (table shaping is buffer-aware, in streamingMarkdown)', () => {
    expect(autoCloseMarkdown('| Item | Qty |')).toBe('| Item | Qty |');
  });

  it('closes an open inline code span', () => {
    expect(autoCloseMarkdown('run `npm i')).toBe('run `npm i`');
  });

  it('treats markers inside inline code as literal', () => {
    expect(autoCloseMarkdown('`a*b')).toBe('`a*b`');
    expect(autoCloseMarkdown('use `arr[*]` now')).toBe('use `arr[*]` now');
  });

  it('closes an open fenced code block', () => {
    expect(autoCloseMarkdown('```js\nconst x = 1')).toBe('```js\nconst x = 1\n```');
    expect(autoCloseMarkdown('```\ncode\n```\ndone')).toBe('```\ncode\n```\ndone');
  });

  it('does not treat list bullets as emphasis', () => {
    expect(autoCloseMarkdown('* item one\n* item')).toBe('* item one\n* item');
    expect(autoCloseMarkdown('- a\n- b')).toBe('- a\n- b');
  });

  it('does not treat intra-word underscores as emphasis', () => {
    expect(autoCloseMarkdown('the snake_case name')).toBe('the snake_case name');
    expect(autoCloseMarkdown('_emphasized')).toBe('_emphasized_');
  });

  it('handles strikethrough but ignores a lone tilde', () => {
    expect(autoCloseMarkdown('~~struck')).toBe('~~struck~~');
    expect(autoCloseMarkdown('about ~5 apples')).toBe('about ~5 apples');
  });

  it('resets emphasis across a blank line (paragraph break)', () => {
    expect(autoCloseMarkdown('*loose\n\nnext')).toBe('*loose\n\nnext');
  });

  it('leaves an incomplete table to render natively', () => {
    const t = 'Loot:\n\n| Item | Qty |\n| ---- | --- |\n| Sword';
    expect(autoCloseMarkdown(t)).toBe(t);
  });
});

describe('streamingMarkdown (buffer-aware)', () => {
  it('falls back to autoCloseMarkdown when there is no look-ahead', () => {
    for (const s of ['an *ital', 'run `npm i', 'plain text', 'He said **bold']) {
      expect(streamingMarkdown(s, s)).toBe(autoCloseMarkdown(s));
    }
  });

  it('types a link label as a link, pulling the URL from the buffer', () => {
    const buffer = 'See [the map](https://example.com) for details';
    expect(streamingMarkdown('See [the ma', buffer)).toBe('See [the ma](https://example.com)');
    expect(streamingMarkdown('See [the map', buffer)).toBe('See [the map](https://example.com)');
  });

  it('does not fabricate a link from a bare bracket', () => {
    expect(streamingMarkdown('a [side note', 'a [side note] with no link')).toBe('a [side note');
  });

  it('renders a heading at the buffer’s final level while its # run is still typing', () => {
    // `#` would render as <h1> then remount to <h2>/<h3> as the run deepens; the buffer knows the level.
    expect(streamingMarkdown('# The Drowned', '## The Drowned Archive')).toBe('## The Drowned');
    expect(streamingMarkdown('## Points', '### Points of interest')).toBe('### Points');
  });

  it('leaves a heading alone once its # run matches the buffer', () => {
    expect(streamingMarkdown('## Done', '## Done')).toBe(autoCloseMarkdown('## Done'));
  });

  it('synthesizes a delimiter so a header-only frame renders as a table (columns reflow in later)', () => {
    const buffer = '| Item | Qty | Notes |\n| --- | --- | --- |\n| Sword | 1 | sharp |';
    const out = streamingMarkdown('| Item | Qt', buffer).split('\n');
    expect(out[0]).toBe('| Item | Qt'); // header as-typed — columns reflow in as they arrive
    expect(out[1]).toBe('| --- | --- |'); // delimiter matching the current header cols → renders as a table
    expect(out.length).toBe(2); // no skeleton rows
  });

  it('replaces a partial/mismatched delimiter so the table never reverts to plain text', () => {
    const buffer = '| Item | Qty | Notes |\n| --- | --- | --- |\n| Sword | 1 | sharp |';
    const out = streamingMarkdown('| Item | Qty | Notes |\n| --', buffer).split('\n');
    expect(out[1]).toBe('| --- | --- | --- |'); // matches the 3-col header, not the partial `| --`
  });

  it('leaves a complete, column-matching table untouched so it reflows naturally', () => {
    const buffer = '| Item | Qty |\n| --- | --- |\n| Sword | 1 |';
    const out = streamingMarkdown('| Item | Qty |\n| --- | --- |\n| Sw', buffer).split('\n');
    expect(out[2]).toBe('| Sw'); // body row types in naturally (reflow), not pre-filled from the buffer
  });

  it('does not treat a leading-pipe non-table as a table', () => {
    // buffer has no delimiter row, so it is not a GFM table — leave it to render natively
    expect(streamingMarkdown('| just text', '| just text and more')).toBe('| just text');
  });

  it('renders a thematic break at its final form while the dashes type (not a bullet)', () => {
    expect(streamingMarkdown('-', '---')).toBe('---');
    expect(streamingMarkdown('--', '---')).toBe('---');
  });

  it('renders an ordered-list marker before its delimiter has typed (not a paragraph)', () => {
    expect(streamingMarkdown('1', '1. Pry open the Reliquary')).toBe('1. ');
    expect(streamingMarkdown('2.', '2. Read the notes')).toBe('2. ');
  });

  it('reveals a task checkbox with its first content char so it is a complete (checked) item', () => {
    // An empty `- [x] ` renders as a blank/contentless checkbox; pulling the first content char makes it
    // a real task item from frame one (no blank-`[]`-then-icon swap).
    expect(streamingMarkdown('- [', '- [x] Light the lanterns')).toBe('- [x] L');
    expect(streamingMarkdown('- ', '- [x] Light the lanterns')).toBe('- [x] L');
    expect(streamingMarkdown('- [x] Li', '- [x] Light the lanterns')).toBe('- [x] Li'); // natural once content typed
    expect(streamingMarkdown('- [ ] Open', '- [ ] Open the Reliquary')).toBe('- [ ] Open');
  });

  it('keeps a link rendered across the `]`→`](url` gap (no <a> drop-out)', () => {
    const buffer = 'read more at [the index](https://example.com).';
    expect(streamingMarkdown('read more at [the index]', buffer)).toBe('read more at [the index](https://example.com)');
    expect(streamingMarkdown('read more at [the index](htt', buffer)).toBe('read more at [the index](https://example.com)');
  });
});
