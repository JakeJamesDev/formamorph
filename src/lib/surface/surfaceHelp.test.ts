import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { SURFACE_MAP, type SurfaceId } from '@/lib/docs/surfaceMap';
import { createGuide } from '@/lib/formaquestion/guide';
import type { Surface } from './surfaceRegistry';
import { surfaceHelpSection, surfaceHelpTarget } from './surfaceHelp';

const surface = (screen: SurfaceId | null, dialog: SurfaceId | null = null, tabs: SurfaceId[] = []): Surface => ({ screen, dialog, tabs });

describe('surfaceHelpTarget', () => {
  it('is null when nothing is open', () => {
    expect(surfaceHelpTarget(surface(null))).toBeNull();
  });

  it('takes the screen when no dialog or tab is open', () => {
    expect(surfaceHelpTarget(surface('gameViewer'))).toEqual({ page: 'How-to-Play', anchor: 'the-game-screen' });
  });

  it('takes the deepest tab before the outer tab, the dialog and the screen', () => {
    const open = surface('mainMenu', 'settings', ['settings.prompts', 'settingsPromptSurfaces.options']);
    expect(surfaceHelpTarget(open)).toEqual({ page: 'Prompts', anchor: 'options' });
    expect(surfaceHelpTarget({ ...open, tabs: ['settings.prompts'] })).toEqual({ page: 'Prompts', anchor: '-prompts' });
    expect(surfaceHelpTarget({ ...open, tabs: [] })).toEqual({ page: 'Settings', anchor: '\u{FE0F}-settings' });
  });

  it('takes the next id up when the deepest one has no docs section', () => {
    const map = { mainMenu: { page: 'Library', anchor: '-library' } };
    expect(surfaceHelpTarget(surface('mainMenu', null, ['mainMenu.models']), map, {})).toEqual(map.mainMenu);
  });

  it('is null for a surface players never see, with no fall back to the screen under it', () => {
    expect(surfaceHelpTarget(surface('mainMenu', 'adminPanel', ['adminPanel.users']))).toBeNull();
    expect(surfaceHelpTarget(surface('mainMenu', 'adminPanel'))).toBeNull();
    // An excluded dialog stops the walk even when its tab is mapped.
    const map = { mainMenu: { page: 'Library', anchor: '-library' } };
    expect(surfaceHelpTarget(surface('mainMenu', 'likers'), map, { likers: 'staff' })).toBeNull();
  });
});

describe('surfaceHelpSection', () => {
  const guide = createGuide(bundledDocsIndex());

  it('names the guide section a Surface maps to', () => {
    const id = surfaceHelpSection(surface('mainMenu', 'settings', ['settings.display']), guide);
    expect(id && guide.section(id)).toMatchObject({ page: 'Settings', heading: 'Display' });
  });

  it('is null for a Surface with no docs section', () => {
    expect(surfaceHelpSection(surface('mainMenu', 'adminPanel'), guide)).toBeNull();
  });

  it('finds a section in the bundled guide for every mapped surface', () => {
    const lost = (Object.keys(SURFACE_MAP) as SurfaceId[]).filter((id) => surfaceHelpSection(surface(id), guide) === null);
    expect(lost).toEqual([]);
  });
});
