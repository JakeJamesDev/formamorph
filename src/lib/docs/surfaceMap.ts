/**
 * The surface map: every player-facing screen, dialog and tab, tied to the docs heading that explains it.
 * The ids come from the dev-router registry, so one list names every surface. A screen or dialog is its
 * bare name (`settings`); a tab is `<ledger key>.<tab>` (`settings.display`, `worldEditorTrait.pins`).
 * `docsCoverage.test.ts` fails when a surface is in none of the map, the exclusions or the known gaps.
 */
import { DEV_MODAL_TABS, DEV_MODALS, DEV_VIEWS, type DevModal, type DevView } from '@/lib/devRoutes';
import type { DocTarget } from './docsChecks';

type TabLedger = typeof DEV_MODAL_TABS;
type TabKey = keyof TabLedger;
type TabId = { [K in TabKey]: `${K}.${TabLedger[K][number]}` }[TabKey];

/** One screen, dialog or tab the player can have open. */
export type SurfaceId = DevView | DevModal | TabId;

/** Every tab id of one ledger entry, in ledger order. */
function tabsOf<K extends TabKey>(key: K): TabId[] {
  return (DEV_MODAL_TABS[key] as readonly string[]).map((tab) => `${key}.${tab}` as TabId);
}

export const SURFACE_IDS: readonly SurfaceId[] = [
  ...DEV_VIEWS,
  ...DEV_MODALS,
  ...(Object.keys(DEV_MODAL_TABS) as TabKey[]).flatMap(tabsOf),
];

/** Why players never see a surface: staff tools, or a dev-only view. */
export type SurfaceExclusionReason = 'staff' | 'dev';

function excludeAll(ids: readonly SurfaceId[], reason: SurfaceExclusionReason) {
  return Object.fromEntries(ids.map((id) => [id, reason])) as Partial<Record<SurfaceId, SurfaceExclusionReason>>;
}

/** Surfaces players never see. They need no docs section. */
export const SURFACE_EXCLUSIONS: Partial<Record<SurfaceId, SurfaceExclusionReason>> = {
  ...excludeAll(['adminPanel', 'likers'], 'staff'),
  ...excludeAll(
    [...tabsOf('adminPanel'), ...tabsOf('adminPanelEvents'), ...tabsOf('adminPanelPolicies'), ...tabsOf('adminPanelFeedback')],
    'staff',
  ),
  ...excludeAll(['designSystem', ...tabsOf('designSystemGroupPicker'), ...tabsOf('gameViewerAttach')], 'dev'),
};

const ENTITY_OWNED_PLACEHOLDERS: DocTarget = {
  page: 'World-Editor-Placeholders',
  anchor: 'placeholders-that-belong-to-an-entity-or-a-dictionary',
};

/** The docs heading for each player-facing surface. */
export const SURFACE_MAP: Partial<Record<SurfaceId, DocTarget>> = {
  aiSetup: { page: 'Connect-Your-Own-AI', anchor: '-connect-your-own-ai' },
  changelog: { page: 'Changelog', anchor: '-changelog' },
  componentUpdates: { page: 'LinkedContent', anchor: 'update-available' },
  connectReferences: { page: 'LinkedContent', anchor: 'connect-world-references' },
  dictionaryEditor: { page: 'World-Editor-Dictionary', anchor: 'in-the-library' },
  entityEditor: { page: 'World-Editor-Entities', anchor: 'in-the-library' },
  manageAddons: { page: 'LinkedContent', anchor: 'manage-add-ons' },
  memoryManager: { page: 'Memory', anchor: 'the-memory-manager' },
  persona: { page: 'Personas', anchor: 'change-it-in-game' },
  replaceSource: { page: 'LinkedContent', anchor: 'the-three-repairs' },
  worldEditor: { page: 'WorldEditor', anchor: '\u{FE0F}-world-editor' },
  worldUpdate: { page: 'LinkedContent', anchor: 'update-this-world' },

  'gameViewer.entities': { page: 'Entities', anchor: '-entities-in-play' },
  'gameViewer.memory': { page: 'Memory', anchor: 'the-memory-tab' },

  'worldEditor.overview': { page: 'World-Editor-Overview', anchor: '-world-editor-overview' },
  'worldEditor.stats': { page: 'World-Editor-Stats', anchor: '-world-editor-stats' },
  'worldEditor.entities': { page: 'World-Editor-Entities', anchor: '-world-editor-entities' },
  'worldEditor.locations': { page: 'World-Editor-Locations', anchor: '\u{FE0F}-world-editor-locations' },
  'worldEditor.traits': { page: 'World-Editor-Traits', anchor: '-world-editor-traits' },
  'worldEditor.dictionary': { page: 'World-Editor-Dictionary', anchor: '-world-editor-dictionary' },
  'worldEditor.placeholders': { page: 'World-Editor-Placeholders', anchor: '-world-editor-placeholders' },

  'worldEditorLocations.list': { page: 'World-Editor-Locations', anchor: 'list-and-canvas' },
  'worldEditorLocations.canvas': { page: 'World-Editor-Locations', anchor: 'list-and-canvas' },
  'worldEditorEntity.profile': { page: 'World-Editor-Entities', anchor: 'the-panel' },
  'worldEditorEntity.descriptions': { page: 'World-Editor-Entities', anchor: 'descriptions-and-summaries' },
  'worldEditorEntity.traits': { page: 'World-Editor-Traits', anchor: 'entity-traits' },
  'worldEditorEntity.placeholders': ENTITY_OWNED_PLACEHOLDERS,
  'worldEditorEntity.openings': { page: 'World-Editor-Entities', anchor: 'openings' },
  'worldEditorLocation.details': { page: 'World-Editor-Locations', anchor: 'the-panel' },
  'worldEditorLocation.presence': { page: 'World-Editor-Locations', anchor: 'entities' },
  'worldEditorLocation.pins': { page: 'World-Editor-Locations', anchor: 'placeholder-pins' },
  'worldEditorLocation.openings': { page: 'World-Editor-Openings', anchor: 'location-openings' },
  'worldEditorStat.details': { page: 'World-Editor-Stats', anchor: 'the-fields' },
  'worldEditorStat.descriptors': { page: 'World-Editor-Stats', anchor: 'stat-descriptors' },
  'worldEditorStat.code': { page: 'World-Editor-Stats', anchor: 'dynamic-value-calculation' },
  'worldEditorTrait.details': { page: 'World-Editor-Traits', anchor: 'the-panel' },
  'worldEditorTrait.availability': { page: 'World-Editor-Traits', anchor: 'requirements' },
  'worldEditorTrait.stats': { page: 'World-Editor-Traits', anchor: 'stat-changes' },
  'worldEditorTrait.pins': { page: 'World-Editor-Traits', anchor: 'placeholder-pins' },
  'worldEditorEntry.details': { page: 'World-Editor-Dictionary', anchor: 'details' },
  'worldEditorEntry.matching': { page: 'World-Editor-Dictionary', anchor: 'matching' },
  'worldEditorBook.details': { page: 'World-Editor-Dictionary', anchor: 'books' },
  'worldEditorBook.placeholders': ENTITY_OWNED_PLACEHOLDERS,

  'entityEditor.entity': { page: 'World-Editor-Entities', anchor: 'in-the-library' },
  'entityEditor.placeholders': ENTITY_OWNED_PLACEHOLDERS,
  'entityEditorEntity.profile': { page: 'World-Editor-Entities', anchor: 'the-panel' },
  'entityEditorEntity.descriptions': { page: 'World-Editor-Entities', anchor: 'descriptions-and-summaries' },
  'entityEditorEntity.openings': { page: 'World-Editor-Entities', anchor: 'openings' },
  'dictionaryEditor.overview': { page: 'World-Editor-Dictionary', anchor: 'in-the-library' },
  'dictionaryEditor.dictionary': { page: 'World-Editor-Dictionary', anchor: 'in-the-library' },
  'dictionaryEditor.placeholders': ENTITY_OWNED_PLACEHOLDERS,
};

/**
 * Surfaces with no docs section yet, grouped by the docs ticket that writes one
 * (`docs-internal/specs/formaquestion/issues/`). Each ticket removes its group; ticket 13 deletes the list.
 */
export const KNOWN_SURFACE_GAPS: Record<string, readonly SurfaceId[]> = {
  '02 traits, placeholders, persona authoring': ['entityEditor.traits'],
  '03 world editor pages': ['worldEditorLocation.media'],
  '04 player pages': ['exitApp', 'importComponent'],
  '06 how to play, starting a game': [
    'gameViewer', 'entity', 'export', 'intro', 'editText', 'location', 'aiContext', 'enterWorld', 'demoAI',
    'likePrompt', 'errorDetails', 'gameViewer.notes', 'gameViewer.logs', ...tabsOf('gameViewerLayout'),
  ],
  '07 settings': ['settings', 'settings.display', 'settings.output', 'settings.endpoints', 'settings.data'],
  '08 prompts and tools': [
    'settings.prompts', 'settings.tools', ...tabsOf('settingsToolEdit'), ...tabsOf('settingsPromptSurfaces'),
    ...tabsOf('settingsPromptPreset'),
  ],
  '09 saves and library': ['mainMenu', 'menu', 'backup', 'updateRequired', ...tabsOf('mainMenu')],
  '10 community creations': [
    'community', 'profile', 'auth', 'feedbackHub', 'eventAck', 'publish', 'worldPrompts', 'ageGate',
    'privacyPolicy', 'deleteAccount', 'deletionCancelled', ...tabsOf('community'), ...tabsOf('publish'),
    ...tabsOf('profile'), ...tabsOf('feedbackHub'), ...tabsOf('eventAck'),
  ],
  '11 avatars, image generation': ['avatar', 'modelDetails'],
  '12 test bench, editor basics': [...tabsOf('worldEditorBench'), ...tabsOf('worldEditorTour')],
};

/** Help topics with no docs heading yet, grouped like `KNOWN_SURFACE_GAPS`. */
export const KNOWN_HELP_TOPIC_GAPS: Record<string, readonly string[]> = {
  '02 traits, placeholders, persona authoring': [
    'worldEditor.traits', 'worldEditor.statChanges', 'worldEditor.statAvailability', 'worldEditor.placeholderPins',
    'worldEditor.pinsOnPlaceholder', 'worldEditor.placeholders',
  ],
  '03 world editor pages': [
    'worldEditor.locations', 'worldEditor.entities', 'worldEditor.aliases', 'worldEditor.locationPins',
    'worldEditor.stats', 'worldEditor.dictionary',
  ],
  '04 player pages': ['game.entities', 'worldEditor.statCode', 'library.linkedContent'],
  '06 how to play, starting a game': ['game.howToPlay'],
};
