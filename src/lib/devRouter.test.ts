import { describe, it, expect } from 'vitest';
import { DEV_MODAL_TABS, DEV_MODALS } from './devRoutes';
import { CATALOG_KINDS } from './catalogKinds';
import { DEV_FIXTURES } from './devFixtures';
import { SETTINGS_TABS } from '@/components/modals/settingsTabs';
import { WORLD_EDITOR_TABS } from '@/views/worldEditorTabs';
import { BUILT_BENCH_TABS } from '@/components/editor/benchTabs';
import { LOCATION_VIEWS } from '@/views/locationViews';
import { MAIN_MENU_CARD_TABS } from '@/views/mainMenuTabs';
import { GAME_LEFT_PANEL_TABS } from '@/components/game/leftPanelTabs';
import { PROFILE_TABS } from '@/components/menu/profileTabs';
import { ADMIN_PANEL_TABS } from '@/components/menu/adminPanelTabs';
import { POLICIES_TABS } from '@/components/menu/policiesTabs';
import { FEEDBACK_TABS } from '@/components/menu/feedbackTabs';
import { MY_FEEDBACK_TABS } from '@/components/menu/myFeedbackTabs';
import { isSaveEnvelope } from './version';
import whiteRoomWorld from './devFixtures/whiteRoomWorld.json';
import whiteRoomSave from './devFixtures/whiteRoomSave.json';

// The parser is module-private; re-derive it here against the documented hash grammar so the encode
// (window.__fmDev.goto) and decode stay pinned to the same shape.
interface ParsedRoute { view?: string; modal?: string; tab?: string; subtab?: string; bench?: string }
function parseHash(hash: string): ParsedRoute | null {
  if (!hash.startsWith('#dev')) return null;
  const params = new URLSearchParams(hash.slice('#dev'.length).replace(/^\?/, ''));
  const route: ParsedRoute = {};
  const view = params.get('view');
  const modal = params.get('modal');
  const tab = params.get('tab');
  const subtab = params.get('subtab');
  const bench = params.get('bench');
  if (view) route.view = view;
  if (modal) route.modal = modal;
  if (tab) route.tab = tab;
  if (subtab) route.subtab = subtab;
  if (bench) route.bench = bench;
  return route;
}

describe('dev-router hash parsing', () => {
  it('ignores hashes that are not #dev', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#/some/route')).toBeNull();
  });

  it('decodes view/modal/tab from a #dev hash', () => {
    expect(parseHash('#dev?view=gameViewer&modal=settings&tab=prompts')).toEqual({
      view: 'gameViewer',
      modal: 'settings',
      tab: 'prompts',
    });
  });

  it('omits absent fields (a bare #dev is an empty route, not null)', () => {
    expect(parseHash('#dev')).toEqual({});
    expect(parseHash('#dev?modal=settings')).toEqual({ modal: 'settings' });
  });

  it('decodes the Test Bench instrument (bench), alongside an editor tab', () => {
    expect(parseHash('#dev?modal=worldEditor&tab=entities&bench=issues')).toEqual({
      modal: 'worldEditor',
      tab: 'entities',
      bench: 'issues',
    });
  });

  it('decodes a prompt sub-tab (subtab)', () => {
    expect(parseHash('#dev?modal=settings&tab=prompts&subtab=thinking')).toEqual({
      modal: 'settings',
      tab: 'prompts',
      subtab: 'thinking',
    });
  });
});

describe('dev-router coverage guard', () => {
  // Drift guard: the Settings surface renders its triggers from SETTINGS_TABS, so if a tab is added or
  // renamed there without updating the DEV_MODAL_TABS ledger, this fails — forcing conscious coverage.
  it('ledger lists exactly the Settings modal tabs the surface renders', () => {
    expect([...DEV_MODAL_TABS.settings]).toEqual(SETTINGS_TABS.map((t) => t.value));
  });

  it('ledger lists exactly the World Editor tabs the surface renders', () => {
    expect([...DEV_MODAL_TABS.worldEditor]).toEqual(WORLD_EDITOR_TABS.map((t) => t.value));
  });

  it('ledger lists exactly the Test Bench instruments an author can stand on', () => {
    // Unbuilt instruments render disabled, so landing one means making it routable here too.
    expect([...DEV_MODAL_TABS.worldEditorBench]).toEqual(BUILT_BENCH_TABS);
  });

  it('ledger lists exactly the views the Locations tab switches between', () => {
    expect([...DEV_MODAL_TABS.worldEditorLocations]).toEqual(LOCATION_VIEWS.map((v) => v.value));
  });

  it('ledger lists exactly the kinds the Community browser tabs between', () => {
    // The browser renders one tab per catalog kind, so a new kind must be consciously covered here too.
    expect([...DEV_MODAL_TABS.community]).toEqual([...CATALOG_KINDS]);
  });

  it('ledger lists exactly the library card tabs MainMenu renders', () => {
    expect([...DEV_MODAL_TABS.mainMenu]).toEqual([...MAIN_MENU_CARD_TABS]);
  });

  it('ledger lists exactly the game side panel tabs', () => {
    expect([...DEV_MODAL_TABS.gameViewer]).toEqual([...GAME_LEFT_PANEL_TABS]);
  });

  it('ledger lists exactly the Policies sub-tabs the surface renders', () => {
    expect([...DEV_MODAL_TABS.adminPanelPolicies]).toEqual([...POLICIES_TABS]);
  });

  it('ledger lists exactly the Feedback sub-tabs the surface renders', () => {
    expect([...DEV_MODAL_TABS.adminPanelFeedback]).toEqual([...FEEDBACK_TABS]);
  });

  it('ledger lists exactly the Feedback dialog tabs the surface renders', () => {
    expect([...DEV_MODAL_TABS.feedbackHub]).toEqual([...MY_FEEDBACK_TABS]);
  });

  it('ledger lists exactly the profile dialog tabs', () => {
    expect([...DEV_MODAL_TABS.profile]).toEqual([...PROFILE_TABS]);
  });

  it('ledger lists exactly the Admin Panel tabs', () => {
    expect([...DEV_MODAL_TABS.adminPanel]).toEqual([...ADMIN_PANEL_TABS]);
  });

  it('registers the modals the router opens', () => {
    // localModel is deliberately excluded (it lives inside Settings, not as a standalone modal). worldEditor
    // is an in-place MainMenu modal (no longer a top-level view).
    expect(DEV_MODALS).toEqual([
      'settings', 'entity', 'export', 'menu', 'worldEditor', 'intro', 'avatar', 'backup', 'aiSetup', 'entityEditor', 'dictionaryEditor', 'modelDetails', 'community', 'memoryManager', 'profile', 'feedbackHub', 'adminPanel', 'editText', 'changelog',
    ]);
  });
});

describe('mid-game boot fixtures', () => {
  it('registers the white-room fixture', () => {
    expect(DEV_FIXTURES).toContain('whiteRoom');
  });

  it('white-room world has a location to start in', () => {
    expect(Array.isArray(whiteRoomWorld.locations) && whiteRoomWorld.locations.length).toBeTruthy();
  });

  it('white-room save is a loadable envelope whose current state matches the world location', () => {
    expect(isSaveEnvelope(whiteRoomSave)).toBe(true);
    // 8-turn fixture: history holds each page and current is the latest (what loadGame restores).
    expect(whiteRoomSave.stateHistory).toHaveLength(8);
    expect(whiteRoomSave.currentState.locationId).toBe(whiteRoomWorld.locations[0].id);
  });
});
