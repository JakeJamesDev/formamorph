import { describe, expect, it } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { helpSections } from './helpSession';

const CHANGELOG = [
  '# 📝 Changelog',
  '',
  '## ✅ 3.1.2 — Released 2026-09-30',
  '',
  'Profile image fixes.',
  '',
  '- **Profile Image:** a change to the profile image keeps its position.',
  '',
  '## ✅ 3.1.1 — Released 2026-09-20',
  '',
  'Morph art.',
  '',
  '- **Morph Art:** blank entities get art.',
].join('\n');
const UPDATES = ['# Updates', '', '## How to Update the App', '', 'The newest version installs when you restart.'].join('\n');
const AVATARS = ['# Avatars', '', '## User Profile', '', 'Open **User Profile** and pick an image.'].join('\n');
const index = createDocsIndex({ pages: { Avatars: AVATARS, Updates: UPDATES, Changelog: CHANGELOG } });

describe('help session docs block and the changelog', () => {
  it('sends the released changelog sections, newest first, for a what-is-new question', () => {
    const ids = helpSections(index, 'what changed in the newest version of the app?').map((s) => s.id);
    expect(ids.slice(0, 2)).toEqual(['Changelog#-312--released-2026-09-30', 'Changelog#-311--released-2026-09-20']);
  });

  it('sends the guide section first for a how-to question', () => {
    expect(helpSections(index, 'change the profile image')[0]?.id).toBe('Avatars#user-profile');
  });
});
