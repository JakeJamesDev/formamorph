import { describe, expect, it } from 'vitest';
import { releasedMinorChangelog } from './changelogSlice';

const release = (version: string, body: string) =>
  [
    '<details>',
    `<summary><strong>✅ ${version} — Released 2026-09-30</strong> — Tagline for ${version} (click to expand)</summary>`,
    '',
    body,
    '',
    '</details>',
    '',
    '---',
    '',
  ].join('\n');

const CHANGELOG = [
  '# 📝 Changelog',
  '',
  'Intro about In Progress.',
  '',
  '## 🚧 In Progress',
  '',
  '### Minor Changes',
  '',
  '- Unreleased work.',
  '',
  '---',
  '',
  release('3.1.1', '### Minor Changes\n\n- Patch work.'),
  release('3.1.0', '### Minor Changes\n\n- Minor work.'),
  release('3.0.1', '### Minor Changes\n\n- Old work.'),
].join('\n');

describe('releasedMinorChangelog', () => {
  it('keeps the title and the released sections of the newest minor series as ## headings', () => {
    expect(releasedMinorChangelog(CHANGELOG)).toBe(
      [
        '# 📝 Changelog',
        '',
        '## ✅ 3.1.1 — Released 2026-09-30',
        '',
        'Tagline for 3.1.1',
        '',
        '### Minor Changes',
        '',
        '- Patch work.',
        '',
        '## ✅ 3.1.0 — Released 2026-09-30',
        '',
        'Tagline for 3.1.0',
        '',
        '### Minor Changes',
        '',
        '- Minor work.',
        '',
      ].join('\n'),
    );
  });

  it('leaves out the unreleased section and older series', () => {
    const sliced = releasedMinorChangelog(CHANGELOG);
    expect(sliced).not.toContain('Unreleased work');
    expect(sliced).not.toContain('3.0.1');
  });
});
