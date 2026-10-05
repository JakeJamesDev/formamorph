/**
 * Turns a surface id into the steps that open it: the screen, the dialog, and the tabs. It reads the
 * ledger the surface map reads, so a new surface needs one entry here and none elsewhere.
 */
import { DEV_MODAL_TABS, DEV_VIEWS, type DevModal, type DevView } from '@/lib/devRoutes';
import { SURFACE_EXCLUSIONS, SURFACE_IDS, type SurfaceId } from '@/lib/docs/surfaceMap';
import { isSurfaceTarget, routeText } from './surfaceTargets';

export type TabKey = keyof typeof DEV_MODAL_TABS;
type LedgerTab<L extends TabKey> = (typeof DEV_MODAL_TABS)[L][number];

/** What opens a surface. */
export interface SurfaceSteps {
  /** The screen to show; null when the dialog opens over either screen. */
  view: DevView | null;
  dialog: DevModal | null;
  /** The tabs to select, outermost first. */
  tabs: readonly SurfaceId[];
  /** The registered target to land on inside the last step. */
  target?: string;
}

/** A guide route: the surface to open and, optionally, the target inside it. */
export interface SurfaceRoute {
  id: SurfaceId;
  target?: string;
}

/**
 * How a dialog or a tab ledger opens. `host` names the screen a dialog opens on (`any` for both);
 * `parent` names the surface a ledger's tabs sit in; `ancestor` stands in for a surface that needs an item
 * the request cannot name, or that sits too deep to open from outside. A null ancestor opens nothing.
 */
type DialogRoute = { host: DevView | 'any' } | { ancestor: SurfaceId | null };
type LedgerRoute = { parent: SurfaceId } | { ancestor: SurfaceId };

const DIALOGS: Record<DevModal, DialogRoute> = {
  settings: { host: 'any' },
  worldEditor: { host: 'any' },
  formaquestion: { host: 'any' },
  formaquestionSettings: { host: 'any' },
  formaquestionAiContext: { host: 'any' },
  formaquestionCompare: { ancestor: 'formaquestionSettings.prompts' },
  settingsCompare: { ancestor: 'settings.prompts' },

  menu: { host: 'mainMenu' },
  intro: { host: 'mainMenu' },
  avatar: { host: 'mainMenu' },
  backup: { host: 'mainMenu' },
  aiSetup: { host: 'mainMenu' },
  community: { host: 'mainMenu' },
  profile: { host: 'mainMenu' },
  auth: { host: 'mainMenu' },
  feedbackHub: { host: 'mainMenu' },
  adminPanel: { host: 'mainMenu' },
  changelog: { ancestor: 'mainMenu' },
  entityEditor: { ancestor: 'mainMenu.entities' },
  dictionaryEditor: { ancestor: 'mainMenu.dictionaries' },
  modelDetails: { ancestor: 'mainMenu.models' },
  enterWorld: { ancestor: 'mainMenu.worlds' },
  worldPrompts: { ancestor: 'mainMenu.worlds' },
  worldUpdate: { ancestor: 'mainMenu.worlds' },
  publish: { ancestor: 'mainMenu' },
  eventAck: { ancestor: 'mainMenu' },
  componentUpdates: { ancestor: 'mainMenu' },
  importComponent: { ancestor: 'mainMenu' },
  likers: { ancestor: 'community' },
  manageAddons: { ancestor: 'community' },
  ageGate: { ancestor: 'community' },
  privacyPolicy: { ancestor: 'auth' },
  deletionCancelled: { ancestor: 'auth' },
  deleteAccount: { ancestor: 'profile.settings' },
  connectReferences: { ancestor: 'worldEditor' },
  replaceSource: { ancestor: 'worldEditorBench.issues' },

  export: { host: 'gameViewer' },
  location: { host: 'gameViewer' },
  aiContext: { host: 'gameViewer' },
  demoAI: { host: 'gameViewer' },
  entity: { ancestor: 'gameViewer.entities' },
  memoryManager: { ancestor: 'gameViewer.memory' },
  persona: { ancestor: 'gameViewer' },
  editText: { ancestor: 'gameViewer' },
  likePrompt: { ancestor: 'gameViewer' },

  // Raised by the app itself, never by the player: a refused build, an error toast, the Android back button.
  updateRequired: { ancestor: null },
  errorDetails: { ancestor: null },
  exitApp: { ancestor: null },
  designSystem: { ancestor: null },
};

const LEDGERS: Record<TabKey, LedgerRoute> = {
  mainMenu: { parent: 'mainMenu' },
  gameViewer: { parent: 'gameViewer' },
  gameViewerLayout: { ancestor: 'gameViewer' },
  gameViewerAttach: { ancestor: 'gameViewer' },
  designSystemGroupPicker: { ancestor: 'mainMenu' },

  settings: { parent: 'settings' },
  settingsEndpoints: { parent: 'settings.endpoints' },
  settingsPrompts: { parent: 'settings.prompts' },
  settingsPromptSurfaces: { parent: 'settings.prompts' },
  settingsPromptPreset: { parent: 'settings.prompts' },
  settingsToolEdit: { ancestor: 'settings.tools' },

  worldEditor: { parent: 'worldEditor' },
  worldEditorBench: { parent: 'worldEditor' },
  worldEditorTour: { ancestor: 'worldEditor' },
  worldEditorLocations: { ancestor: 'worldEditor.locations' },
  worldEditorLocation: { ancestor: 'worldEditor.locations' },
  worldEditorEntity: { ancestor: 'worldEditor.entities' },
  worldEditorStat: { ancestor: 'worldEditor.stats' },
  worldEditorTrait: { ancestor: 'worldEditor.traits' },
  worldEditorEntry: { ancestor: 'worldEditor.dictionary' },
  worldEditorBook: { ancestor: 'worldEditor.dictionary' },
  entityEditor: { ancestor: 'entityEditor' },
  entityEditorEntity: { ancestor: 'entityEditor' },
  dictionaryEditor: { ancestor: 'dictionaryEditor' },

  community: { parent: 'community' },
  publish: { ancestor: 'publish' },
  profile: { parent: 'profile' },
  feedbackHub: { parent: 'feedbackHub' },
  eventAck: { ancestor: 'eventAck' },
  adminPanel: { parent: 'adminPanel' },
  adminPanelEvents: { parent: 'adminPanel.events' },
  adminPanelPolicies: { parent: 'adminPanel.policies' },
  adminPanelFeedback: { parent: 'adminPanel.feedback' },

  formaquestion: { parent: 'formaquestion' },
  formaquestionSettings: { parent: 'formaquestionSettings' },
};

const KNOWN: ReadonlySet<string> = new Set(SURFACE_IDS);
const VIEWS: ReadonlySet<string> = new Set(DEV_VIEWS);

/**
 * The steps that open a surface, or null for an id players cannot open. A target the surface registers rides
 * on the steps; any other target opens the bare surface.
 */
export function resolveSurface(id: string, target?: string): SurfaceSteps | null {
  const steps = surfaceSteps(id);
  return steps && target !== undefined && isSurfaceTarget(id, target) ? { ...steps, target } : steps;
}

/** The route text a set of steps lands on, as its target's row carries it, or undefined with no target. */
export function targetRoute(steps: SurfaceSteps): string | undefined {
  // A registered surface opens as its own last step (the registry test holds that).
  const surface = steps.tabs.at(-1) ?? steps.dialog ?? steps.view;
  return steps.target === undefined || surface === null ? undefined : routeText(surface, steps.target);
}

function surfaceSteps(id: string): SurfaceSteps | null {
  if (!KNOWN.has(id) || SURFACE_EXCLUSIONS[id as SurfaceId]) return null;
  if (VIEWS.has(id)) return { view: id as DevView, dialog: null, tabs: [] };
  const dot = id.indexOf('.');
  if (dot < 0) {
    const route = DIALOGS[id as DevModal];
    if ('ancestor' in route) return route.ancestor === null ? null : surfaceSteps(route.ancestor);
    return { view: route.host === 'any' ? null : route.host, dialog: id as DevModal, tabs: [] };
  }
  const route = LEDGERS[id.slice(0, dot) as TabKey];
  if ('ancestor' in route) return surfaceSteps(route.ancestor);
  const parent = surfaceSteps(route.parent);
  return parent && { ...parent, tabs: [...parent.tabs, id as SurfaceId] };
}

const HELP_WINDOW: ReadonlySet<DevModal> = new Set(['formaquestion', 'formaquestionSettings', 'formaquestionAiContext']);

/** Whether the help window opens these steps itself. The app's screens leave them alone. */
export function opensInHelpWindow(steps: SurfaceSteps): boolean {
  return steps.dialog !== null && HELP_WINDOW.has(steps.dialog);
}

/** The tab of one ledger in a set of steps, as the bare tab value, or undefined when none is asked for. */
export function stepTab<L extends TabKey>(steps: Pick<SurfaceSteps, 'tabs'>, ledger: L): LedgerTab<L> | undefined {
  const prefix = `${ledger}.`;
  // Steps hold surface ids only, so the rest of a matching id is a tab of that ledger.
  return steps.tabs.find((tab) => tab.startsWith(prefix))?.slice(prefix.length) as LedgerTab<L> | undefined;
}
