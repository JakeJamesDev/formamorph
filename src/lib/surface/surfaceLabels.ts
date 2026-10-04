/**
 * The label the player sees for each surface id. A label comes from the constant that renders it where
 * one exists; the rest are the fixed word of a title that has none, or a generic noun for a dynamic one.
 */
import { CLOSE_APP_PROMPT } from '@/lib/leavePrompts';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import { BROWSE_TAB_LABELS } from '@/lib/browseTabs';
import { KIND_LABELS } from '@/lib/catalogKinds';
import { FEEDBACK_TYPE_LABELS } from '@/lib/feedbackPresentation';
import { HUB_LABEL, OVERVIEW_LABEL, PROMPT_LABELS, SURFACE_LABELS as PROMPT_SURFACE_LABELS } from '@/lib/promptGroups';
import { BENCH_TABS } from '@/lib/testBench/benchTabs';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { FORMAQUESTION_TABS } from '@/components/formaquestion/formaquestionTabs';
import { FORMAQUESTION_SETTINGS_TABS } from '@/components/formaquestion/formaquestionSettingsTabs';
import { SETTINGS_ENDPOINT_TABS, SETTINGS_TABS } from '@/components/modals/settingsTabs';
import { TOOL_EDIT_TABS } from '@/components/modals/toolsView';
import { DICTIONARY_BOOK_PANEL_TABS } from '@/views/dictionaryBookPanelTabs';
import { DICTIONARY_EDITOR_TABS } from '@/views/dictionaryEditorTabs';
import { DICTIONARY_PANEL_TABS } from '@/views/dictionaryPanelTabs';
import { ENTITY_EDITOR_TABS, ENTITY_PANEL_TABS } from '@/views/entityPanelTabs';
import { LOCATION_PANEL_TABS } from '@/views/locationPanelTabs';
import { STAT_PANEL_TABS } from '@/views/statPanelTabs';
import { TRAIT_PANEL_TABS } from '@/views/traitPanelTabs';
import { WORLD_EDITOR_TABS } from '@/views/worldEditorTabs';

/** The ids of one ledger, each with its tab's label. */
function tabsOf(ledger: string, tabs: readonly { value: string; label: string }[]): [string, string][] {
  return tabs.map((tab) => [`${ledger}.${tab.value}`, tab.label]);
}

const ENTRIES: [string, string][] = [
  // Screens and dialogs. A title that changes with the open item shows its kind of item.
  ['mainMenu', 'Main Menu'],
  ['gameViewer', 'Game'],
  ['aiSetup', 'Set up your AI'],
  ['componentUpdates', 'Update Available'],
  ['connectReferences', 'Connect World References'],
  ['dictionaryEditor', 'Dictionary'],
  ['entityEditor', 'Entity'],
  ['exitApp', CLOSE_APP_PROMPT.title],
  ['importComponent', 'Import'],
  ['manageAddons', 'Manage Add-ons'],
  ['memoryManager', 'Memories'],
  ['persona', 'Change Persona'],
  ['replaceSource', 'Replace Source'],
  ['settings', 'Settings'],
  ['worldEditor', 'World Editor'],
  ['worldUpdate', 'Update This World'],
  ['aiContext', 'AI Context'],
  ['demoAI', "You're Playing on the Demo AI"],
  ['editText', 'Edit Text'],
  ['entity', 'Entity'],
  ['enterWorld', 'Enter World'],
  ['errorDetails', 'Error Details'],
  ['export', 'Export story'],
  ['intro', 'Introduction'],
  ['location', 'Change Location'],
  ['menu', 'Load Game'],
  ['backup', 'Backup & Restore'],
  ['updateRequired', 'Update Formamorph'],
  ['changelog', "What's new"],
  ['avatar', 'Character Customization'],
  ['modelDetails', 'Avatar'],
  ['community', 'Community Creations'],
  ['publish', 'Publish'],
  ['eventAck', 'Event'],
  ['ageGate', 'Adult Content Ahead'],
  ['auth', 'Login'],
  ['privacyPolicy', 'Privacy Policy'],
  ['profile', 'User Profile'],
  ['deleteAccount', 'Delete Account'],
  ['deletionCancelled', 'Deletion Cancelled'],
  ['feedbackHub', 'Feedback'],
  ['worldPrompts', 'Custom Prompts'],
  ['likePrompt', 'Like Prompt'],
  ['formaquestion', 'Formaquestion'],
  ['formaquestionSettings', 'Formaquestion Settings'],
  ['formaquestionCompare', 'Compare'],
  ['settingsCompare', 'Compare'],
  ['formaquestionAiContext', 'AI Context'],
  ['designSystemGroupPicker.picker', 'Add To Group'],
  ['designSystemGroupPicker.create', 'Create New Group'],

  // Tabs
  ...tabsOf('settings', SETTINGS_TABS),
  ...tabsOf('settingsEndpoints', SETTINGS_ENDPOINT_TABS.map((tab) => ({ value: tab.route, label: tab.label }))),
  ...tabsOf('settingsToolEdit', TOOL_EDIT_TABS),
  ...Object.entries(PROMPT_LABELS).map(([tab, label]): [string, string] => [`settingsPrompts.${tab}`, label]),
  ...Object.entries(PROMPT_SURFACE_LABELS).map(([tab, label]): [string, string] => [`settingsPromptSurfaces.${tab}`, label]),
  ['settingsPromptSurfaces.anatomy', HUB_LABEL],
  ['settingsPromptPreset.overview', OVERVIEW_LABEL],
  ...tabsOf('worldEditor', WORLD_EDITOR_TABS),
  ...tabsOf('worldEditorLocations', [{ value: 'list', label: 'List' }, { value: 'canvas', label: 'Canvas' }]),
  ...tabsOf('worldEditorEntity', ENTITY_PANEL_TABS),
  ...tabsOf('worldEditorLocation', LOCATION_PANEL_TABS),
  ...tabsOf('worldEditorStat', STAT_PANEL_TABS),
  ...tabsOf('worldEditorTrait', TRAIT_PANEL_TABS),
  ...tabsOf('worldEditorEntry', DICTIONARY_PANEL_TABS),
  ...tabsOf('worldEditorBook', DICTIONARY_BOOK_PANEL_TABS),
  ...tabsOf('worldEditorBench', BENCH_TABS),
  ...tabsOf('worldEditorTour', TOUR_STEPS.map((step) => ({ value: step.id, label: step.title }))),
  ...tabsOf('entityEditor', ENTITY_EDITOR_TABS),
  ...tabsOf('entityEditorEntity', ENTITY_PANEL_TABS.filter((tab) => tab.value !== 'traits' && tab.value !== 'placeholders')),
  ...tabsOf('dictionaryEditor', DICTIONARY_EDITOR_TABS),
  ...tabsOf('formaquestion', FORMAQUESTION_TABS),
  ...tabsOf('formaquestionSettings', FORMAQUESTION_SETTINGS_TABS),
  ...tabsOf('mainMenu', [
    { value: 'worlds', label: BROWSE_TAB_LABELS.world.many },
    { value: 'entities', label: BROWSE_TAB_LABELS.entity.many },
    { value: 'dictionaries', label: BROWSE_TAB_LABELS.dictionary.many },
    { value: 'models', label: BROWSE_TAB_LABELS.model.many },
  ]),
  ...(['world', 'entity', 'dictionary', 'model', 'prompt', 'contest'] as const).map((tab): [string, string] => [`community.${tab}`, BROWSE_TAB_LABELS[tab].many]),
  ['publish.world', KIND_LABELS.world.one],
  ['publish.prompt', KIND_LABELS.prompt.one],
  ['feedbackHub.bugs', FEEDBACK_TYPE_LABELS.bug.many],
  ['feedbackHub.suggestions', FEEDBACK_TYPE_LABELS.suggestion.many],
  ['profile.messages', 'Messages'],
  ['profile.notifications', 'Notifications'],
  ['profile.terms', 'Terms'],
  ['profile.settings', 'Settings'],
  ['eventAck.start', 'Event Start'],
  ['eventAck.end', 'Event End'],
  ['gameViewer.entities', 'Entities'],
  ['gameViewer.notes', 'Notes'],
  ['gameViewer.memory', 'Memory'],
  ['gameViewer.logs', 'Logs'],
];

/** The label for each surface id the player can have open. */
export const SURFACE_LABELS: Partial<Record<SurfaceId, string>> = Object.fromEntries(ENTRIES);

/** The label for an id. The coverage test fails for an id without one. */
export function surfaceLabel(id: SurfaceId): string {
  return SURFACE_LABELS[id] as string;
}
