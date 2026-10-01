import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SURFACE_MAP } from '@/lib/docs/surfaceMap';
import { UNREPORTED_SURFACES, reportedSurfaces, surfaceReportProblems } from './surfaceReportChecks';

const SRC = resolve(__dirname, '..', '..');

/** Every app source file, tests left out: a test names surfaces without reporting them to a player. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const SOURCES = Object.fromEntries(sourceFiles(SRC).map((path) => [relative(SRC, path), readFileSync(path, 'utf8')]));

describe('surface reports in the app', () => {
  it('reads the app source', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(500);
    expect(SOURCES[join('components', 'ui', 'dialog.tsx')]).toContain('SurfaceLayer');
  });

  it('reports every player-facing surface from a component, or lists it with a reason', () => {
    expect(surfaceReportProblems({ surfaceIds: Object.keys(SURFACE_MAP), sources: SOURCES, unreported: UNREPORTED_SURFACES })).toEqual([]);
  });
});

const SETTINGS = '<DialogContent surface="settings"><Tabs value={tab} surfaceTabs="settings" /></DialogContent>';

function problems(overrides: Partial<Parameters<typeof surfaceReportProblems>[0]>) {
  return surfaceReportProblems({
    surfaceIds: ['settings', 'settings.display', 'settings.data'],
    sources: { 'Settings.tsx': SETTINGS },
    unreported: {},
    ...overrides,
  });
}

describe('surfaceReportProblems', () => {
  it('passes a dialog that reports its id and a strip that reports its ledger', () => {
    expect(problems({})).toEqual([]);
  });

  it('fails a dialog id no component reports', () => {
    expect(problems({ sources: { 'Settings.tsx': '<DialogContent><Tabs surfaceTabs="settings" /></DialogContent>' } })).toEqual([
      'settings is never reported: report it from its component, or list it as unreported with the reason',
    ]);
  });

  it('fails every tab of a ledger no component reports', () => {
    expect(problems({ sources: { 'Settings.tsx': '<DialogContent surface="settings"><Tabs value={tab} /></DialogContent>' } })).toEqual([
      'settings.display is never reported: report it from its component, or list it as unreported with the reason',
      'settings.data is never reported: report it from its component, or list it as unreported with the reason',
    ]);
  });

  it('passes an unreported surface that is listed with a reason', () => {
    expect(problems({ surfaceIds: ['settings', 'likePrompt'], unreported: { likePrompt: 'An inline card.' } })).toEqual([]);
  });

  it('fails a listed surface that a component does report, so the list can only shrink', () => {
    expect(problems({ unreported: { settings: 'Not wired yet.' } })).toEqual([
      'settings is listed as unreported, but a component reports it',
    ]);
  });

  it('fails a listed id that is not a player-facing surface', () => {
    expect(problems({ unreported: { adminPanel: 'Staff.' } })).toEqual([
      'adminPanel is listed as unreported, but it is not a player-facing surface id',
    ]);
  });
});

describe('reportedSurfaces', () => {
  it('reads each way a component names a surface', () => {
    const sources = {
      'a.tsx': '<AlertDialogContent surface="export">',
      'b.tsx': '<SurfaceLayer id="mainMenu">',
      'c.tsx': "<DialogContent surface={panel === 'create' ? 'groups.create' : 'groups.picker'}>",
      'd.tsx': '<SurfaceTab ledger="publish" tab={kind} />',
      'e.tsx': "useSurfaceTab('worldEditor', activeTab);",
      'f.tsx': '<PanelTabs surfaceTabs="worldEditorStat" tabs={tabs}>',
    };
    expect(reportedSurfaces(sources)).toEqual({
      // Every quoted string of an expression counts. One that is not a surface id matches no surface.
      ids: new Set(['export', 'mainMenu', 'create', 'groups.create', 'groups.picker']),
      ledgers: new Set(['publish', 'worldEditor', 'worldEditorStat']),
    });
  });

  it('does not count a prop that passes a surface through', () => {
    expect(reportedSurfaces({ 'shell.tsx': '<DialogContent surface={surface}><Tabs surfaceTabs={surface} />' })).toEqual({
      ids: new Set(),
      ledgers: new Set(),
    });
  });
});
