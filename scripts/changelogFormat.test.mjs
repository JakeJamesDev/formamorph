import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEntry, lintSection, inProgressBounds, latestReleaseBounds } from './changelogFormat.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Run the real extractor over a changelog fixture and return its stdout. */
function extract(markdown, args = []) {
  const dir = mkdtempSync(path.join(tmpdir(), 'changelog-'));
  const file = path.join(dir, 'Changelog.md');
  writeFileSync(file, markdown);
  return execFileSync('node', [path.join(ROOT, 'scripts', 'extractReleaseNotes.mjs'), '--file', file, ...args], {
    encoding: 'utf8',
  });
}

const section = (body) => `## 🚧 In Progress\n\n### Minor Changes\n\n#### ➕ Added\n\n${body}\n\n---\n`;

describe('parseEntry', () => {
  it('reads an entry at two spaces as depth 0 and one at four as depth 1', () => {
    expect(parseEntry('  - **A thing happened.** Detail.')).toEqual({ depth: 0, text: 'A thing happened', header: false });
    expect(parseEntry('    - **A thing happened.** Detail.')).toEqual({ depth: 1, text: 'A thing happened', header: false });
  });

  it('treats a bold lead ending in a colon as a group header and strips the colon', () => {
    expect(parseEntry('  - **Image Generation:**')).toEqual({ depth: 0, text: 'Image Generation', header: true });
  });

  it('ignores lines that are not bold-led bullets', () => {
    expect(parseEntry('- **👤 User-facing**')).toBeNull(); // audience group sits at zero indent
    expect(parseEntry('  Some prose.')).toBeNull();
  });
});

describe('lintSection', () => {
  const lines = (body) => section(body).split('\n');

  it('accepts a group with two children beside an ungrouped entry', () => {
    expect(lintSection(lines([
      '- **👤 User-facing**',
      '  - **Image Generation:**',
      '    - **Images now save to disc.** Detail.',
      '    - **Previews fill a full-size panel.** Detail.',
      '  - **An unrelated standalone change.** Detail.',
    ].join('\n')))).toEqual([]);
  });

  it('rejects a group with a single child', () => {
    const problems = lintSection(lines([
      '- **👤 User-facing**',
      '  - **Image Generation:**',
      '    - **Images now save to disc.** Detail.',
    ].join('\n')));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/Image Generation.*at least 2/);
  });

  it('rejects a bullet with no bold lead, which would ship nothing', () => {
    const problems = lintSection(lines('- **👤 User-facing**\n  - A change with no bold lead.'));
    expect(problems).toEqual([expect.stringMatching(/no bold lead/)]);
  });

  it('rejects nesting past one level', () => {
    const problems = lintSection(lines([
      '- **👤 User-facing**',
      '  - **Image Generation:**',
      '    - **Images now save to disc.** Detail.',
      '      - **A third level.** Detail.',
      '    - **Previews fill a full-size panel.** Detail.',
    ].join('\n')));
    expect(problems).toEqual([expect.stringMatching(/Nested past one level/)]);
  });

  it('rejects an indented entry with no header above it', () => {
    const problems = lintSection(lines('- **👤 User-facing**\n    - **An orphan.** Detail.'));
    expect(problems).toEqual([expect.stringMatching(/no group header/)]);
  });

  it('closes a group at the next audience or change-type heading', () => {
    // The one-child group ends at the 🛠️ header; without that boundary its count would absorb the entry below.
    const problems = lintSection(lines([
      '- **👤 User-facing**',
      '  - **Image Generation:**',
      '    - **Images now save to disc.** Detail.',
      '',
      '- **🛠️ Developer tooling**',
      '    - **A tooling change.** Detail.',
    ].join('\n')));
    expect(problems).toEqual([
      expect.stringMatching(/Image Generation.*at least 2/),
      expect.stringMatching(/no group header/),
    ]);
  });
});

describe('the shipped changelog', () => {
  const src = readFileSync(path.join(ROOT, 'docs', 'Changelog.md'), 'utf8').split(/\r?\n/);

  it('has a well-formed In Progress section', () => {
    const bounds = inProgressBounds(src);
    expect(bounds).not.toBeNull();
    expect(lintSection(src.slice(bounds[0], bounds[1]))).toEqual([]);
  });

  it('has a well-formed newest release section', () => {
    // The section the last release closed. Older releases predate the format and are left alone.
    const bounds = latestReleaseBounds(src);
    expect(bounds).not.toBeNull();
    expect(lintSection(src.slice(bounds[0], bounds[1]))).toEqual([]);
  });
});

describe('extractReleaseNotes', () => {
  it('emits a group header in bold with its children nested beneath it', () => {
    const out = extract(section([
      '- **👤 User-facing**',
      '  - **Image Generation:**',
      '    - **Images now save to disc.** Detail.',
      '    - **Previews fill a full-size panel.** Detail.',
      '  - **An unrelated standalone change.** Detail.',
    ].join('\n')));
    expect(out).toBe([
      '### Added',
      '',
      '- **Image Generation**',
      '  - Images now save to disc',
      '  - Previews fill a full-size panel',
      '- An unrelated standalone change',
      '',
    ].join('\n'));
  });

  it('drops 🛠️ and ⚙️ groups, headers included', () => {
    const out = extract(section([
      '- **👤 User-facing**',
      '  - **A user change.** Detail.',
      '',
      '- **🛠️ Developer tooling**',
      '  - **Tooling:**',
      '    - **A tooling change.** Detail.',
      '    - **Another tooling change.** Detail.',
    ].join('\n')));
    expect(out).not.toMatch(/Tooling/);
    expect(out).toMatch(/- A user change/);
  });

  it('leaves a legacy section without headers exactly as it was', () => {
    // Older releases nest sub-items under an entry whose lead has no colon; those must keep rendering as
    // plain nested bullets, so regenerating a historical release still produces its published notes.
    const out = extract(section([
      '- **👤 User-facing**',
      '  - **A long entry broken into parts.** Detail.',
      '    - **Its first part.** Detail.',
      '    - **Its second part.** Detail.',
    ].join('\n')));
    expect(out).toBe([
      '### Added',
      '',
      '- A long entry broken into parts',
      '  - Its first part',
      '  - Its second part',
      '',
    ].join('\n'));
  });
});
