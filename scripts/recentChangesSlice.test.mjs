import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recentChanges } from './recentChangesSlice.mjs';

const release = (version, body) => [
  '<details>',
  `<summary><strong>✅ ${version} — Released 2026-09-30</strong> — Tagline (click to expand)</summary>`,
  '',
  '### Minor Changes',
  '',
  body,
  '',
  '</details>',
  '',
  '---',
  '',
].join('\n');

const user = (type, ...leads) => [
  `#### ${type}`, '', '- **👤 User-facing**',
  ...leads.map((l) => `  - **${l}.** Detail the tab never shows.`),
].join('\n');
const dev = (type, lead) => `#### ${type}\n\n- **🛠️ Developer tooling**\n  - **${lead}.** Detail.\n- **⚙️ Backend**\n  - **Backend ${lead}.** Detail.`;

const CHANGELOG = [
  '# 📝 Changelog',
  '## 🚧 In Progress',
  '',
  user('➕ Added', 'Unreleased lead'),
  '',
  '---',
  '',
  release('3.8.0', user('➕ Added', 'Eight lead')),
  release('3.7.1', `${user('🐛 Fixed', 'Seven one fix')}\n\n${dev('➕ Added', 'Dev only')}`),
  release('3.7.0', `${user('➕ Added', 'Seven lead', 'Second seven lead')}\n\n${user('🗑️ Removed', 'Gone feature')}`),
  release('3.6.2', user('🐛 Fixed', 'Six two fix')),
  release('3.6.1', user('➕ Added', 'Six one lead')),
].join('\n');

describe('recentChanges', () => {
  it('takes the installed version and the two before it, across a minor-series boundary', () => {
    const text = recentChanges(CHANGELOG, '3.7.0');
    expect(text.match(/^### v.*$/gm)).toEqual(['### v3.7.0', '### v3.6.2', '### v3.6.1']);
    expect(text.match(/^## v.*$/gm)).toEqual(['## v3.7', '## v3.6']);
  });

  it('shows the bold leads under Added, Removed and Fixed labels', () => {
    const text = recentChanges(CHANGELOG, '3.7.0');
    expect(text).toContain('### v3.7.0\n\n**Added**\n\n- Seven lead\n- Second seven lead\n\n**Removed**\n\n- Gone feature\n\n## v3.6\n\n### v3.6.2');
    expect(text).not.toContain('Detail the tab never shows');
  });

  it('leaves out the unreleased section and releases newer than the installed one', () => {
    const text = recentChanges(CHANGELOG, '3.7.0');
    expect(text).not.toContain('Unreleased lead');
    expect(text).not.toContain('Eight lead');
    expect(text).not.toContain('Seven one fix');
  });

  it('never shows developer or backend entries', () => {
    const text = recentChanges(CHANGELOG, '3.7.1');
    expect(text).toContain('Seven one fix');
    expect(text).not.toContain('Dev only');
    expect(text).not.toContain('Backend');
  });

  it('shows what exists when fewer than three releases do', () => {
    const text = recentChanges(CHANGELOG, '3.6.2');
    expect(text.match(/^### v.*$/gm)).toEqual(['### v3.6.2', '### v3.6.1']);
  });

  it('shows nothing when no release is at or below the version', () => {
    expect(recentChanges(CHANGELOG, '1.0.0')).toBe('');
  });

  it('sits a pre-release below its own release', () => {
    const text = recentChanges(CHANGELOG, '3.8.0-beta.1');
    expect(text.match(/^### v.*$/gm)).toEqual(['### v3.7.1', '### v3.7.0', '### v3.6.2']);
  });

  it('shows the maintenance line for a release with no user-facing entries', () => {
    const only = [CHANGELOG, release('3.5.0', dev('➕ Added', 'Dev only'))].join('\n');
    expect(recentChanges(only, '3.5.0')).toBe('## v3.5\n\n### v3.5.0\n\n- Maintenance and internal improvements.');
  });

  it('keeps a feature group header bold with its entry nested under it', () => {
    const group = `#### ➕ Added\n\n- **👤 User-facing**\n  - **Image Generation:**\n    - **Kept on disk.** Detail.`;
    expect(recentChanges(release('3.9.0', group), '3.9.0')).toContain('**Added**\n\n- **Image Generation**\n  - Kept on disk');
  });

  it('cuts the real changelog down to three released versions of leads', () => {
    const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'Changelog.md');
    const text = recentChanges(readFileSync(file, 'utf8'), '3.7.0');
    expect(text.match(/^### v.*$/gm)).toEqual(['### v3.7.0', '### v3.6.2', '### v3.6.1']);
  });
});
