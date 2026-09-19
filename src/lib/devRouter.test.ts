import { describe, it, expect, vi } from 'vitest';
import { DEV_MODAL_TABS, DEV_MODALS } from './devRoutes';
import { BROWSE_TABS } from './browseTabs';
import { DEV_FIXTURES, PICKED_OPENING_TEXT, WORLD_OPENING_TEXT, WRITTEN_OPENING_TEXT, loadDevFixture } from './devFixtures';
import { SETTINGS_TABS } from '@/components/modals/settingsTabs';
import { PROMPT_SURFACE_ROUTES, PRESET_ROUTES } from './promptGroups';
import { WORLD_EDITOR_TABS } from '@/views/worldEditorTabs';
import { BUILT_BENCH_TABS } from '@/lib/testBench/benchTabs';
import { LOCATION_VIEWS } from '@/views/locationViews';
import { ENTITY_EDITOR_SUBTABS, ENTITY_EDITOR_TABS, ENTITY_PANEL_TABS } from '@/views/entityPanelTabs';
import { LOCATION_PANEL_TABS } from '@/views/locationPanelTabs';
import { STAT_PANEL_TABS } from '@/views/statPanelTabs';
import { TRAIT_PANEL_TABS } from '@/views/traitPanelTabs';
import { DICTIONARY_PANEL_TABS } from '@/views/dictionaryPanelTabs';
import { DICTIONARY_BOOK_PANEL_TABS } from '@/views/dictionaryBookPanelTabs';
import { MAIN_MENU_CARD_TABS } from '@/views/mainMenuTabs';
import { GAME_LEFT_PANEL_TABS } from '@/components/game/leftPanelTabs';
import { NARRATION_LAYOUTS } from '@/contexts/settingsDefaults';
import { PROFILE_TABS } from '@/components/menu/profileTabs';
import { ADMIN_PANEL_TABS } from '@/components/menu/adminPanelTabs';
import { POLICIES_TABS } from '@/components/menu/policiesTabs';
import { FEEDBACK_TABS } from '@/components/menu/feedbackTabs';
import { MY_FEEDBACK_TABS } from '@/components/menu/myFeedbackTabs';
import { EVENT_ACK_PHASES } from '@/components/events/eventAckPhases';
import { EVENTS_TAB_ROLE_VIEWS } from '@/lib/adminEvents';
import { isSaveEnvelope } from './version';
import whiteRoomWorld from './devFixtures/whiteRoomWorld.json';
import whiteRoomSave from './devFixtures/whiteRoomSave.json';

// The parser is module-private; re-derive it here against the documented hash grammar so the encode
// (window.__fmDev.goto) and decode stay pinned to the same shape.
interface ParsedRoute { view?: string; modal?: string; tab?: string; subtab?: string; surface?: string; bench?: string }
function parseHash(hash: string): ParsedRoute | null {
  if (!hash.startsWith('#dev')) return null;
  const params = new URLSearchParams(hash.slice('#dev'.length).replace(/^\?/, ''));
  const route: ParsedRoute = {};
  const view = params.get('view');
  const modal = params.get('modal');
  const tab = params.get('tab');
  const subtab = params.get('subtab');
  const surface = params.get('surface');
  const bench = params.get('bench');
  if (view) route.view = view;
  if (modal) route.modal = modal;
  if (tab) route.tab = tab;
  if (subtab) route.subtab = subtab;
  if (surface) route.surface = surface;
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

  it('decodes a prompt surface alongside its prompt (surface)', () => {
    expect(parseHash('#dev?modal=settings&tab=prompts&subtab=narration&surface=anatomy')).toEqual({
      modal: 'settings',
      tab: 'prompts',
      subtab: 'narration',
      surface: 'anatomy',
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

  // Drift guard for the third level: a new prompt surface must be consciously made routable.
  it('ledger lists exactly the prompt surfaces the Prompts panel can show', () => {
    expect([...DEV_MODAL_TABS.settingsPromptSurfaces]).toEqual(PROMPT_SURFACE_ROUTES);
  });

  it('ledger lists exactly the preset-level entries the Prompts rail can show', () => {
    expect([...DEV_MODAL_TABS.settingsPromptPreset]).toEqual(PRESET_ROUTES);
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

  it('ledger lists exactly the tabs the entity panel switches between', () => {
    // Advanced-only tabs are listed too: the ledger says what the router can target, not what one mode shows.
    expect([...DEV_MODAL_TABS.worldEditorEntity]).toEqual(ENTITY_PANEL_TABS.map((t) => t.value));
  });

  it('ledger lists exactly the tabs the library entity editor switches between', () => {
    expect([...DEV_MODAL_TABS.entityEditor]).toEqual(ENTITY_EDITOR_TABS.map((t) => t.value));
  });

  it('ledger lists exactly the sub-tabs the library entity editor’s Entity tab switches between', () => {
    expect([...DEV_MODAL_TABS.entityEditorEntity]).toEqual(ENTITY_EDITOR_SUBTABS.map((t) => t.value));
  });

  it('ledger lists exactly the tabs the location panel switches between', () => {
    expect([...DEV_MODAL_TABS.worldEditorLocation]).toEqual(LOCATION_PANEL_TABS.map((t) => t.value));
  });

  it('ledger lists exactly the tabs the stat panel switches between', () => {
    expect([...DEV_MODAL_TABS.worldEditorStat]).toEqual(STAT_PANEL_TABS.map((t) => t.value));
  });

  it('ledger lists exactly the tabs the trait panel switches between', () => {
    expect([...DEV_MODAL_TABS.worldEditorTrait]).toEqual(TRAIT_PANEL_TABS.map((t) => t.value));
  });

  it('ledger lists exactly the tabs the dictionary entry panel switches between', () => {
    expect([...DEV_MODAL_TABS.worldEditorEntry]).toEqual(DICTIONARY_PANEL_TABS.map((t) => t.value));
  });

  it('ledger lists exactly the tabs the dictionary book panel switches between', () => {
    expect([...DEV_MODAL_TABS.worldEditorBook]).toEqual(DICTIONARY_BOOK_PANEL_TABS.map((t) => t.value));
  });

  // The Locations tab spends one `subtab=…` slot on both switches, so a value landing in both would make
  // the router move the panel and the view at once and neither call site could tell which was meant.
  it('keeps the Locations tab’s two subtab meanings apart', () => {
    const views = new Set<string>(LOCATION_VIEWS.map((v) => v.value));
    expect(LOCATION_PANEL_TABS.map((t) => t.value).filter((v) => views.has(v))).toEqual([]);
  });

  it('ledger lists exactly the tabs the Community browser switches between', () => {
    // The browser renders one tab per catalog kind plus Contest, so a new one must be consciously
    // covered here too.
    expect([...DEV_MODAL_TABS.community]).toEqual([...BROWSE_TABS]);
  });

  it('ledger lists exactly the library card tabs MainMenu renders', () => {
    expect([...DEV_MODAL_TABS.mainMenu]).toEqual([...MAIN_MENU_CARD_TABS]);
  });

  it('ledger lists exactly the game side panel tabs', () => {
    expect([...DEV_MODAL_TABS.gameViewer]).toEqual([...GAME_LEFT_PANEL_TABS]);
  });

  it('ledger lists exactly the narration layouts the game view can open in', () => {
    expect([...DEV_MODAL_TABS.gameViewerLayout]).toEqual(NARRATION_LAYOUTS.map((l) => l.value));
  });

  it('ledger lists exactly the Policies sub-tabs the surface renders', () => {
    expect([...DEV_MODAL_TABS.adminPanelPolicies]).toEqual([...POLICIES_TABS]);
  });

  it('ledger lists exactly the Events role views the tab renders', () => {
    expect([...DEV_MODAL_TABS.adminPanelEvents]).toEqual([...EVENTS_TAB_ROLE_VIEWS]);
  });

  it('ledger lists exactly the Feedback sub-tabs the surface renders', () => {
    expect([...DEV_MODAL_TABS.adminPanelFeedback]).toEqual([...FEEDBACK_TABS]);
  });

  it('ledger lists exactly the Feedback dialog tabs the surface renders', () => {
    expect([...DEV_MODAL_TABS.feedbackHub]).toEqual([...MY_FEEDBACK_TABS]);
  });

  it('ledger lists exactly the event acknowledge phases the poster renders', () => {
    expect([...DEV_MODAL_TABS.eventAck]).toEqual([...EVENT_ACK_PHASES]);
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
      'settings', 'entity', 'export', 'menu', 'worldEditor', 'intro', 'avatar', 'backup', 'aiSetup', 'entityEditor', 'dictionaryEditor', 'modelDetails', 'community', 'memoryManager', 'profile', 'auth', 'feedbackHub', 'adminPanel', 'editText', 'location', 'changelog', 'eventAck', 'publish', 'worldPrompts', 'aiContext', 'ageGate', 'likers', 'privacyPolicy', 'deleteAccount', 'deletionCancelled', 'updateRequired', 'exitApp', 'designSystem', 'enterWorld', 'connectReferences', 'manageAddons', 'componentUpdates', 'worldUpdate', 'importComponent', 'replaceSource', 'demoAI', 'persona',
    ]);
  });
});

describe('mid-game boot fixtures', () => {
  it('registers the white-room fixture', () => {
    expect(DEV_FIXTURES).toContain('whiteRoom');
  });

  it('every registered fixture loads', async () => {
    // The dev server serves fixture images; here each fetch answers with a tiny JPEG.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
    vi.stubGlobal('fetch', async () => ({ ok: true, blob: async () => new Blob([jpeg], { type: 'image/jpeg' }) }));
    try {
      for (const name of DEV_FIXTURES) expect(await loadDevFixture(name), name).not.toBeNull();
      const long = await loadDevFixture('thousandTurns');
      expect(Object.values(long!.save!.sceneImages!)[0][0]).toMatch(/^data:image\/jpeg;base64,/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the written-opening fixture is a new game whose one opening is a Narration', async () => {
    const fx = await loadDevFixture('writtenOpening');
    expect(fx?.save).toBeUndefined();
    expect(fx?.world.worldOverview.openings).toEqual([
      { id: 'written-opening', text: WRITTEN_OPENING_TEXT, kind: 'narration' },
    ]);
  });

  it('the picked-opening fixture is a new game whose picked entity carries an opening beside the world’s own', async () => {
    const fx = await loadDevFixture('pickedOpening');
    expect(fx?.save).toBeUndefined();
    expect(fx?.world.worldOverview.openings?.map((o) => o.text)).toEqual([WORLD_OPENING_TEXT]);
    expect(fx?.picked?.flatMap((e) => e.openings ?? []).map((o) => o.text)).toEqual([PICKED_OPENING_TEXT]);
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
