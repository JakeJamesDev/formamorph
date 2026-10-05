import { describe, expect, it } from 'vitest';
import { SURFACE_EXCLUSIONS, SURFACE_IDS } from '@/lib/docs/surfaceMap';
import { opensInHelpWindow, resolveSurface, stepTab, targetRoute } from './surfaceRoute';
import { routeText, SURFACE_TARGETS } from './surfaceTargets';

describe('resolveSurface', () => {
  it('opens a screen alone', () => {
    expect(resolveSurface('gameViewer')).toEqual({ view: 'gameViewer', dialog: null, tabs: [] });
  });

  it('opens a dialog on the screen that hosts it', () => {
    expect(resolveSurface('backup')).toEqual({ view: 'mainMenu', dialog: 'backup', tabs: [] });
    expect(resolveSurface('export')).toEqual({ view: 'gameViewer', dialog: 'export', tabs: [] });
  });

  it('opens a dialog that both screens host over whichever is showing', () => {
    expect(resolveSurface('settings')).toEqual({ view: null, dialog: 'settings', tabs: [] });
  });

  it('adds the tab, and every outer tab before it', () => {
    expect(resolveSurface('settings.display')).toEqual({ view: null, dialog: 'settings', tabs: ['settings.display'] });
    expect(resolveSurface('settingsEndpoints.image')).toEqual({
      view: null, dialog: 'settings', tabs: ['settings.endpoints', 'settingsEndpoints.image'],
    });
  });

  it('opens a screen tab on its screen with no dialog', () => {
    expect(resolveSurface('mainMenu.models')).toEqual({ view: 'mainMenu', dialog: null, tabs: ['mainMenu.models'] });
  });

  it('opens the nearest ancestor of a surface that needs an item', () => {
    expect(resolveSurface('worldEditorEntity.openings')).toEqual({
      view: null, dialog: 'worldEditor', tabs: ['worldEditor.entities'],
    });
    expect(resolveSurface('entity')).toEqual({ view: 'gameViewer', dialog: null, tabs: ['gameViewer.entities'] });
    expect(resolveSurface('publish.prompt')).toEqual({ view: 'mainMenu', dialog: null, tabs: [] });
  });

  it('gives nothing for an unknown id, an excluded surface, or one only the app raises', () => {
    expect(resolveSurface('settings.nope')).toBeNull();
    expect(resolveSurface('nowhere')).toBeNull();
    expect(resolveSurface('adminPanel.users')).toBeNull();
    expect(resolveSurface('errorDetails')).toBeNull();
  });

  it('resolves every player-facing surface without throwing', () => {
    for (const id of SURFACE_IDS) {
      const steps = resolveSurface(id);
      if (SURFACE_EXCLUSIONS[id]) expect(steps, id).toBeNull();
      else if (steps) expect(steps.view !== null || steps.dialog !== null, id).toBe(true);
    }
  });

  it('marks the help window surfaces as its own', () => {
    expect(opensInHelpWindow(resolveSurface('formaquestionSettings.endpoint')!)).toBe(true);
    expect(opensInHelpWindow(resolveSurface('formaquestionCompare')!)).toBe(true);
    expect(opensInHelpWindow(resolveSurface('settings.display')!)).toBe(false);
  });
});

describe('resolveSurface with a target', () => {
  it('carries a registered target on the steps', () => {
    expect(resolveSurface('settings.display', 'narration-layout')).toEqual({
      view: null, dialog: 'settings', tabs: ['settings.display'], target: 'narration-layout',
    });
  });

  it('opens the bare surface for a target the surface does not register', () => {
    expect(resolveSurface('settings.display', 'nowhere')).toEqual({ view: null, dialog: 'settings', tabs: ['settings.display'] });
    expect(resolveSurface('settings.output', 'narration-layout')).toEqual({ view: null, dialog: 'settings', tabs: ['settings.output'] });
  });

  it('gives a bare route no target', () => {
    expect(resolveSurface('settings.display')).not.toHaveProperty('target');
  });
});

describe('targetRoute', () => {
  it('gives back the route text of every registered target', () => {
    for (const [surface, targets] of Object.entries(SURFACE_TARGETS)) {
      for (const target of targets) expect(targetRoute(resolveSurface(surface, target)!)).toBe(routeText(surface, target));
    }
  });

  it('gives nothing for steps with no target', () => {
    expect(targetRoute(resolveSurface('settings.display')!)).toBeUndefined();
    expect(targetRoute(resolveSurface('settings.display', 'nowhere')!)).toBeUndefined();
  });
});

describe('stepTab', () => {
  it('reads one ledger tab out of the steps', () => {
    const steps = resolveSurface('settingsEndpoints.image')!;
    expect(stepTab(steps, 'settings')).toBe('endpoints');
    expect(stepTab(steps, 'settingsEndpoints')).toBe('image');
    expect(stepTab(steps, 'worldEditor')).toBeUndefined();
  });
});
