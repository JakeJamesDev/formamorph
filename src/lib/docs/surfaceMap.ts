/**
 * Every player-facing screen, dialog and tab, tied to the docs heading that explains it. Ids come from the
 * dev-router registry: a screen or dialog is its bare name (`settings`), a tab is `<ledger key>.<tab>`.
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
  ...excludeAll(['designSystem', ...tabsOf('gameViewerAttach')], 'dev'),
};

const ENTITY_OWNED_PLACEHOLDERS: DocTarget = {
  page: 'World-Editor-Placeholders',
  anchor: 'placeholders-that-belong-to-an-entity-or-a-dictionary',
};
const ENTITY_OPENINGS: DocTarget = { page: 'World-Editor-Openings', anchor: 'entity-openings' };

/** The docs heading for each player-facing surface. */
export const SURFACE_MAP: Partial<Record<SurfaceId, DocTarget>> = {
  aiSetup: { page: 'Connect-Your-Own-AI', anchor: 'the-set-up-your-ai-dialog' },
  componentUpdates: { page: 'LinkedContent', anchor: 'update-available' },
  connectReferences: { page: 'LinkedContent', anchor: 'connect-world-references' },
  dictionaryEditor: { page: 'World-Editor-Dictionary', anchor: 'in-the-library' },
  entityEditor: { page: 'World-Editor-Entities', anchor: 'in-the-library' },
  exitApp: { page: 'Install-on-Android', anchor: '\u{FE0F}-the-back-button' },
  importComponent: { page: 'LinkedContent', anchor: 'importing-an-entity-or-dictionary-file' },
  manageAddons: { page: 'LinkedContent', anchor: 'manage-add-ons' },
  memoryManager: { page: 'Memory', anchor: 'the-memory-manager' },
  persona: { page: 'Personas', anchor: 'change-it-in-game' },
  replaceSource: { page: 'LinkedContent', anchor: 'the-three-repairs' },
  settings: { page: 'Settings', anchor: '\u{FE0F}-settings' },
  worldEditor: { page: 'WorldEditor', anchor: '\u{FE0F}-world-editor' },
  worldUpdate: { page: 'LinkedContent', anchor: 'update-this-world' },

  aiContext: { page: 'How-to-Play', anchor: 'the-ai-context-inspector' },
  demoAI: { page: 'How-to-Play', anchor: 'the-demo-ai-notice' },
  editText: { page: 'How-to-Play', anchor: 'how-to-edit-narration' },
  entity: { page: 'How-to-Play', anchor: 'the-entity-dialog' },
  enterWorld: { page: 'Starting-a-Game', anchor: 'the-enter-world-dialog' },
  errorDetails: { page: 'How-to-Play', anchor: 'error-details' },
  export: { page: 'How-to-Play', anchor: 'how-to-export-the-story' },
  gameViewer: { page: 'How-to-Play', anchor: 'the-game-screen' },
  intro: { page: 'Starting-a-Game', anchor: 'the-welcome-animation' },
  likePrompt: { page: 'How-to-Play', anchor: 'the-like-prompt' },
  location: { page: 'How-to-Play', anchor: 'the-change-location-dialog' },

  'gameViewer.entities': { page: 'Entities', anchor: '-entities-in-play' },
  'gameViewer.notes': { page: 'How-to-Play', anchor: 'notes' },
  'gameViewer.memory': { page: 'Memory', anchor: 'the-memory-tab' },
  'gameViewer.logs': { page: 'How-to-Play', anchor: 'logs' },
  'gameViewerLayout.pages': { page: 'How-to-Play', anchor: 'narration-layout' },
  'gameViewerLayout.chat': { page: 'How-to-Play', anchor: 'narration-layout' },

  'settings.display': { page: 'Settings', anchor: 'display' },
  'settings.output': { page: 'Settings', anchor: 'output' },
  'settings.endpoints': { page: 'Settings', anchor: 'endpoints' },
  'settings.data': { page: 'Settings', anchor: 'data' },
  'settingsEndpoints.text': { page: 'Settings', anchor: 'text' },
  'settingsEndpoints.image': { page: 'Settings', anchor: 'image' },
  'settingsEndpoints.tagPrompt': { page: 'Settings', anchor: 'tag-prompt' },

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
  'worldEditorEntity.openings': ENTITY_OPENINGS,
  'worldEditorLocation.details': { page: 'World-Editor-Locations', anchor: 'the-panel' },
  'worldEditorLocation.presence': { page: 'World-Editor-Locations', anchor: 'entities' },
  'worldEditorLocation.media': { page: 'World-Editor-Locations', anchor: 'media' },
  'worldEditorLocation.pins': { page: 'World-Editor-Locations', anchor: 'placeholder-pins' },
  'worldEditorLocation.openings': { page: 'World-Editor-Openings', anchor: 'location-openings' },
  'worldEditorStat.details': { page: 'World-Editor-Stats', anchor: 'the-fields' },
  'worldEditorStat.descriptors': { page: 'World-Editor-Stats', anchor: 'stat-descriptors' },
  'worldEditorStat.code': { page: 'World-Editor-Stats', anchor: 'dynamic-value-calculation' },
  'worldEditorTrait.details': { page: 'World-Editor-Traits', anchor: 'the-panel' },
  'worldEditorTrait.availability': { page: 'World-Editor-Traits', anchor: 'availability' },
  'worldEditorTrait.stats': { page: 'World-Editor-Traits', anchor: 'stat-changes' },
  'worldEditorTrait.pins': { page: 'World-Editor-Traits', anchor: 'placeholder-pins' },
  'worldEditorEntry.details': { page: 'World-Editor-Dictionary', anchor: 'details' },
  'worldEditorEntry.matching': { page: 'World-Editor-Dictionary', anchor: 'matching' },
  'worldEditorBook.details': { page: 'World-Editor-Dictionary', anchor: 'books' },
  'worldEditorBook.placeholders': ENTITY_OWNED_PLACEHOLDERS,

  'entityEditor.entity': { page: 'World-Editor-Entities', anchor: 'in-the-library' },
  'entityEditor.traits': { page: 'World-Editor-Entities', anchor: 'in-the-library' },
  'entityEditor.placeholders': ENTITY_OWNED_PLACEHOLDERS,
  'entityEditorEntity.profile': { page: 'World-Editor-Entities', anchor: 'the-panel' },
  'entityEditorEntity.descriptions': { page: 'World-Editor-Entities', anchor: 'descriptions-and-summaries' },
  'entityEditorEntity.openings': ENTITY_OPENINGS,
  'dictionaryEditor.overview': { page: 'World-Editor-Dictionary', anchor: 'in-the-library' },
  'dictionaryEditor.dictionary': { page: 'World-Editor-Dictionary', anchor: 'in-the-library' },
  'dictionaryEditor.placeholders': ENTITY_OWNED_PLACEHOLDERS,
};

/** A Formaquestion docs ticket that writes a missing section (`docs-internal/specs/formaquestion/issues/`). */
export type DocsTicket = '02' | '03' | '04' | '06' | '07' | '08' | '09' | '10' | '11' | '12';

/** Surfaces with no docs section yet, by owning ticket. Each ticket removes its group; ticket 13 deletes the list. */
export const KNOWN_SURFACE_GAPS: Partial<Record<DocsTicket, readonly SurfaceId[]>> = {
  // Prompts and Tools
  '08': [
    'settings.prompts', 'settings.tools', ...tabsOf('settingsToolEdit'), ...tabsOf('settingsPromptSurfaces'),
    ...tabsOf('settingsPromptPreset'),
  ],
  // Saves and Backup, Library. The group picker ledger opens the library's production Groups dialogs.
  '09': [
    'mainMenu', 'menu', 'backup', 'updateRequired', 'changelog', ...tabsOf('mainMenu'),
    ...tabsOf('designSystemGroupPicker'),
  ],
  // Community Creations
  '10': [
    'community', 'profile', 'auth', 'feedbackHub', 'eventAck', 'publish', 'worldPrompts', 'ageGate',
    'privacyPolicy', 'deleteAccount', 'deletionCancelled', ...tabsOf('community'), ...tabsOf('publish'),
    ...tabsOf('profile'), ...tabsOf('feedbackHub'), ...tabsOf('eventAck'),
  ],
  // Avatars, Image Generation
  '11': ['avatar', 'modelDetails'],
  // Test Bench, editor basics. Every tour step maps to the one Authoring Tour heading.
  '12': [...tabsOf('worldEditorBench'), ...tabsOf('worldEditorTour')],
};

/** Help topics with no docs heading yet, by owning ticket. */
export const KNOWN_HELP_TOPIC_GAPS: Partial<Record<DocsTicket, readonly string[]>> = {};
