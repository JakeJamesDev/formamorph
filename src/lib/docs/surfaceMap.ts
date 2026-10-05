/**
 * Every player-facing screen, dialog and tab, tied to the docs heading that explains it. Ids come from the
 * dev-router registry: a screen or dialog is its bare name (`settings`), a tab is `<ledger key>.<tab>`.
 */
import { DEV_MODAL_TABS, DEV_MODALS, DEV_PANE_MODALS, DEV_VIEWS, type DevModal, type DevView } from '@/lib/devRoutes';
import type { DocTarget } from './docsLinks';

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
  ...excludeAll(DEV_PANE_MODALS, 'dev'),
};

const ENTITY_OWNED_PLACEHOLDERS: Required<DocTarget> = {
  page: 'World-Editor-Placeholders',
  anchor: 'placeholders-that-belong-to-an-entity-or-a-dictionary',
};
const ENTITY_OPENINGS: Required<DocTarget> = { page: 'World-Editor-Openings', anchor: 'entity-openings' };
// One table row per prompt says what it does in a turn and when it shows.
const THE_PROMPTS: Required<DocTarget> = { page: 'Prompts', anchor: 'the-prompts' };
const community = (anchor: string): Required<DocTarget> => ({ page: 'Community-Creations', anchor });
const PUBLISH_DIALOG = community('the-publish-dialog');
const EVENT_POSTERS = community('event-posters-and-banners');
const USER_PROFILE = community('the-user-profile-dialog');
const ACCOUNT_DELETION = community('account-deletion');
const BUGS_AND_SUGGESTIONS = community('bugs-and-suggestions');
const THE_LIBRARY_TABS: Required<DocTarget> = { page: 'Library', anchor: 'the-library-tabs' };
const THE_GROUP_DIALOGS: Required<DocTarget> = { page: 'Library', anchor: 'the-group-dialogs' };
const FORMAQUESTION_SETTINGS: Required<DocTarget> = { page: 'Formaquestion', anchor: 'formaquestion-settings' };

/** The docs heading for each player-facing surface. */
export const SURFACE_MAP: Partial<Record<SurfaceId, Required<DocTarget>>> = {
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

  // `menu` is the main menu's Load Game dialog.
  menu: { page: 'Saves-and-Backup', anchor: 'the-load-game-dialog' },
  backup: { page: 'Saves-and-Backup', anchor: 'the-backup--restore-dialog' },
  updateRequired: { page: 'Saves-and-Backup', anchor: 'the-update-required-dialog' },
  changelog: { page: 'Saves-and-Backup', anchor: 'whats-new' },
  mainMenu: { page: 'Library', anchor: '-library' },
  ...Object.fromEntries(tabsOf('mainMenu').map((id) => [id, THE_LIBRARY_TABS])),
  // The group picker ledger opens the library's production Groups dialogs.
  ...Object.fromEntries(tabsOf('designSystemGroupPicker').map((id) => [id, THE_GROUP_DIALOGS])),

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

  'settings.prompts': { page: 'Prompts', anchor: '-prompts' },
  settingsCompare: { page: 'Prompts', anchor: '-prompts' },
  worldPrompts: { page: 'Prompts', anchor: 'world-prompts-and-the-diff-viewer' },
  ...Object.fromEntries(tabsOf('settingsPrompts').map((id) => [id, THE_PROMPTS])),
  'settingsPromptPreset.overview': { page: 'Prompts', anchor: 'the-overview' },
  'settingsPromptSurfaces.anatomy': { page: 'Prompts', anchor: 'anatomy' },
  'settingsPromptSurfaces.system': { page: 'Prompts', anchor: 'system-prompt' },
  'settingsPromptSurfaces.user': { page: 'Prompts', anchor: 'user-message' },
  'settingsPromptSurfaces.messages': { page: 'Prompts', anchor: 'messages' },
  'settingsPromptSurfaces.options': { page: 'Prompts', anchor: 'options' },
  'settings.tools': { page: 'Tools', anchor: '-tools' },
  'settingsToolEdit.definition': { page: 'Tools', anchor: 'definition' },
  'settingsToolEdit.parameters': { page: 'Tools', anchor: 'parameters' },
  'settingsToolEdit.handler': { page: 'Tools', anchor: 'handler' },

  community: community('opening-community-creations'),
  // One table row per tab says what it holds.
  ...Object.fromEntries(tabsOf('community').map((id) => [id, community('the-tabs')])),
  'community.contest': community('contests'),
  publish: PUBLISH_DIALOG,
  'publish.world': PUBLISH_DIALOG,
  'publish.prompt': community('publishing-a-prompt-preset'),
  eventAck: EVENT_POSTERS,
  ...Object.fromEntries(tabsOf('eventAck').map((id) => [id, EVENT_POSTERS])),
  ageGate: community('the-adult-content-warning'),
  auth: community('login-and-register'),
  privacyPolicy: community('the-privacy-policy'),
  profile: USER_PROFILE,
  'profile.messages': USER_PROFILE,
  'profile.notifications': community('the-follow-feed'),
  'profile.terms': community('publishing-terms'),
  'profile.settings': USER_PROFILE,
  deleteAccount: ACCOUNT_DELETION,
  deletionCancelled: ACCOUNT_DELETION,
  feedbackHub: BUGS_AND_SUGGESTIONS,
  ...Object.fromEntries(tabsOf('feedbackHub').map((id) => [id, BUGS_AND_SUGGESTIONS])),

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

  'worldEditorBench.issues': { page: 'Test-Bench', anchor: 'issues' },
  'worldEditorBench.triggers': { page: 'Test-Bench', anchor: 'triggers' },
  'worldEditorBench.aiContext': { page: 'Test-Bench', anchor: 'ai-context' },
  'worldEditorBench.opening': { page: 'Test-Bench', anchor: 'opening' },
  ...Object.fromEntries(tabsOf('worldEditorTour').map((id) => [id, { page: 'WorldEditor', anchor: 'the-authoring-tour' }])),

  formaquestion: { page: 'Formaquestion', anchor: 'the-window' },
  'formaquestion.ask': { page: 'Formaquestion', anchor: 'ask' },
  'formaquestion.search': { page: 'Formaquestion', anchor: 'search' },
  'formaquestion.guide': { page: 'Formaquestion', anchor: 'guide' },
  formaquestionSettings: FORMAQUESTION_SETTINGS,
  formaquestionCompare: { page: 'Formaquestion', anchor: 'prompts' },
  formaquestionAiContext: { page: 'Formaquestion', anchor: 'ai-context' },
  'formaquestionSettings.general': { page: 'Formaquestion', anchor: 'general' },
  'formaquestionSettings.endpoint': { page: 'Formaquestion', anchor: 'endpoint' },
  'formaquestionSettings.prompts': { page: 'Formaquestion', anchor: 'prompts' },
  'formaquestionSettings.tools': { page: 'Formaquestion', anchor: 'tools' },
  'formaquestionSettings.mascot': { page: 'Formaquestion', anchor: 'mascot' },

  avatar: { page: 'Avatars', anchor: 'character-customization' },
  modelDetails: { page: 'Avatars', anchor: 'the-avatar-details-dialog' },
};
