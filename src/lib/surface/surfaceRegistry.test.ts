import { describe, expect, it, vi } from 'vitest';
import { SURFACE_IDS } from '@/lib/docs/surfaceMap';
import { DEV_VIEWS } from '@/lib/devRoutes';
import { createSurfaceRegistry, SCREEN_IDS } from './surfaceRegistry';

let lastPlace = 0;

/** Reports a screen or dialog at a new place, above every place before it, and returns the place. */
function open(registry: ReturnType<typeof createSurfaceRegistry>, id: string): number {
  const place = ++lastPlace;
  registry.report(place, id, null);
  return place;
}

/** Reports a tab under a screen or dialog and returns its place. */
function openTab(registry: ReturnType<typeof createSurfaceRegistry>, layer: number, id: string): number {
  const place = ++lastPlace;
  registry.report(place, id, layer);
  return place;
}

describe('the Surface', () => {
  it('is empty before a screen reports', () => {
    expect(createSurfaceRegistry().get()).toEqual({ screen: null, dialog: null, tabs: [] });
  });

  it('names the open screen and its tab', () => {
    const registry = createSurfaceRegistry();
    const menu = open(registry, 'mainMenu');
    openTab(registry, menu, 'mainMenu.models');
    expect(registry.get()).toEqual({ screen: 'mainMenu', dialog: null, tabs: ['mainMenu.models'] });
  });

  it('names the top dialog and its tabs, outermost first, and hides the tabs under it', () => {
    const registry = createSurfaceRegistry();
    const game = open(registry, 'gameViewer');
    openTab(registry, game, 'gameViewer.notes');
    const settings = open(registry, 'settings');
    openTab(registry, settings, 'settings.prompts');
    openTab(registry, settings, 'settingsPrompts.narration');
    expect(registry.get()).toEqual({
      screen: 'gameViewer',
      dialog: 'settings',
      tabs: ['settings.prompts', 'settingsPrompts.narration'],
    });
  });

  it('follows a tab change in place', () => {
    const registry = createSurfaceRegistry();
    const settings = open(registry, 'settings');
    const outer = openTab(registry, settings, 'settings.prompts');
    openTab(registry, settings, 'settingsPrompts.narration');
    registry.report(outer, 'settings.tools', settings);
    expect(registry.get().tabs).toEqual(['settings.tools', 'settingsPrompts.narration']);
  });

  it('returns to the first dialog when a dialog over it closes', () => {
    const registry = createSurfaceRegistry();
    open(registry, 'mainMenu');
    const editor = open(registry, 'worldEditor');
    openTab(registry, editor, 'worldEditor.stats');
    const settings = open(registry, 'settings');
    const tab = openTab(registry, settings, 'settings.display');
    expect(registry.get().dialog).toBe('settings');

    registry.clear(tab);
    registry.clear(settings);
    expect(registry.get()).toEqual({ screen: 'mainMenu', dialog: 'worldEditor', tabs: ['worldEditor.stats'] });
  });

  it('returns to the screen when the last dialog closes', () => {
    const registry = createSurfaceRegistry();
    open(registry, 'mainMenu');
    const dialog = open(registry, 'backup');
    registry.clear(dialog);
    expect(registry.get()).toEqual({ screen: 'mainMenu', dialog: null, tabs: [] });
  });

  it('keeps the dialog that opened last on top when an earlier one closes', () => {
    const registry = createSurfaceRegistry();
    open(registry, 'mainMenu');
    const community = open(registry, 'community');
    open(registry, 'profile');
    registry.clear(community);
    expect(registry.get().dialog).toBe('profile');
  });

  it('keeps a dialog that was open before the screen changed on top of the new screen', () => {
    const registry = createSurfaceRegistry();
    const menu = open(registry, 'mainMenu');
    open(registry, 'privacyPolicy');
    registry.clear(menu);
    const game = open(registry, 'gameViewer');
    openTab(registry, game, 'gameViewer.notes');
    expect(registry.get()).toEqual({ screen: 'gameViewer', dialog: 'privacyPolicy', tabs: [] });
  });

  it('clears an entry that reports no id', () => {
    const registry = createSurfaceRegistry();
    const game = open(registry, 'gameViewer');
    const tab = openTab(registry, game, 'gameViewer.logs');
    registry.report(tab, null, game);
    expect(registry.get().tabs).toEqual([]);
  });
});

describe('what the registry stores', () => {
  it('stores surface ids only: any other text is dropped', () => {
    const registry = createSurfaceRegistry();
    const menu = open(registry, 'mainMenu');
    open(registry, 'The Sunken City of Varn');
    openTab(registry, menu, 'mainMenu.I walk north and open the door');
    // The mobile-only game tab has no surface id.
    openTab(registry, menu, 'gameViewer.model');
    expect(registry.get()).toEqual({ screen: 'mainMenu', dialog: null, tabs: [] });
  });

  it('drops the id an entry had when it reports other text', () => {
    const registry = createSurfaceRegistry();
    const game = open(registry, 'gameViewer');
    const tab = openTab(registry, game, 'gameViewer.logs');
    registry.report(tab, 'gameViewer.model', game);
    expect(registry.get().tabs).toEqual([]);
  });

  it('holds nothing but surface ids after every kind of report', () => {
    const registry = createSurfaceRegistry();
    const menu = open(registry, 'mainMenu');
    openTab(registry, menu, 'mainMenu.worlds');
    const settings = open(registry, 'settings');
    openTab(registry, settings, 'settings.data');
    openTab(registry, settings, 'a secret typed by the player');
    const { screen, dialog, tabs } = registry.get();
    expect([screen, dialog, ...tabs].filter((id) => id !== null && !SURFACE_IDS.includes(id))).toEqual([]);
    expect(JSON.stringify(registry.get())).not.toContain('secret');
  });
});

describe('subscribers', () => {
  it('hear a change, and keep the same Surface object until one happens', () => {
    const registry = createSurfaceRegistry();
    const listener = vi.fn();
    const stop = registry.subscribe(listener);
    const before = registry.get();
    expect(registry.get()).toBe(before);

    const menu = open(registry, 'mainMenu');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(registry.get()).not.toBe(before);

    // The same report again is not a change.
    registry.report(menu, 'mainMenu', null);
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    registry.clear(menu);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('the screen list', () => {
  it('names every top-level view', () => {
    expect([...SCREEN_IDS].sort()).toEqual([...DEV_VIEWS].sort());
  });
});
