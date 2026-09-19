/**
 * The Test Bench panel's prop contract — one bundle per Instrument plus the bench chrome. Lives in the lib
 * layer so `useTestBench` can type the bundle it builds without the lib importing from components.
 */
import type { BenchLens, LensOption, StatOverride } from '@/lib/testBench/lens';
import type { Finding, FindingGroup, FindingSection } from '@/lib/testBench/rules';
import type { TriggerReport } from '@/lib/testBench/triggers';
import type { SemanticStatus } from '@/lib/testBench/useTriggerSemantics';
import type { AiContextData } from '@/lib/testBench/aiContext';
import type { OpeningData } from '@/lib/testBench/opening';
import type { BenchTab } from './benchTabs';
import type { BenchPlacement } from './benchPlacement';
import type { MissingSource, RepairAction } from '@/lib/sourceChecks';

/** Where the author is sent when they click an item a finding names. */
export type OpenFindingItem = (section: FindingSection, itemId: string) => void;

/** How far one of the Bench's on-demand checks has got. Neither runs on its own: the stat-code check costs
 *  a sandbox VM per coded stat, and the source check costs a request per source. */
export type CheckStatus = 'idle' | 'running' | 'done';

/** The missing-source check and the repairs its rows offer. */
export interface SourceCheckProps {
  /** How many copies in the world follow a published source — what a check would ask about. */
  sourceCount: number;
  status: CheckStatus;
  /** The copies the last check could not confirm, each with its answer. */
  missing: MissingSource[];
  /** Ask the server about every source again. Also what Retry Check runs. */
  onCheckSources: () => void;
  /** Repair one copy. Replace opens the library picker; the other two land at once. */
  onRepair: (copyId: string, action: RepairAction) => void;
}

/** The World Doctor's bundle: the marked finding rows and every action a row offers, fixes aside. */
export interface IssuesProps {
  groups: FindingGroup[];
  /** The rows the author muted, kept reachable so a dismissal is never one-way. */
  dismissedGroups: FindingGroup[];
  /** How many rules ran — what makes a clean world read as verified rather than broken. */
  ruleCount: number;
  /** How many rows carry something the author has not been shown. */
  newCount: number;
  /** How many rows Simple mode folded away, so the fold can say what is out of sight. Zero in Advanced. */
  advancedOnlyCount: number;
  /** The editor's mode. Simple shows no stat-code action: its verdicts are among the rows Simple folds. */
  advanced: boolean;
  /** How many stats carry code — what the on-demand check would have to run. */
  codedStatCount: number;
  codeCheckStatus: CheckStatus;
  /** The rule whose repair is running, when one is. Only the async image conversion can be — a pure fix
   *  lands within the click — and the row it belongs to shows the work rather than looking unresponsive. */
  fixingRuleId: string | null;
  /** The world's publish size in bytes, null until the first measure lands. */
  publishBytes: number | null;
  onOpenItem: OpenFindingItem;
  onDismissRule: (ruleId: string) => void;
  onRestoreRule: (ruleId: string) => void;
  onMarkAllSeen: () => void;
  /** Run every stat's code in the real sandbox and fold the failures into the list. */
  onCheckStatCode: () => void;
  /** The missing-source check and the repairs its rows offer. */
  sources: SourceCheckProps;
}

/** The Bench-level `Testing as [PC] · at [location]` selection, resolved against the world. */
export interface LensBarProps {
  lens: BenchLens;
  pcOptions: LensOption[];
  locationOptions: LensOption[];
  /** The stats the lens PC switches away from the world's defaults. */
  statOverrides: StatOverride[];
  onPcChange: (traitId: string | null) => void;
  onLocationChange: (locationId: string | null) => void;
}

/** The Activation Tester's bundle. Its text, history and semantic toggle live above the tab strip so
 *  switching instruments doesn't discard the prose the author is testing with. */
export interface TriggersProps {
  text: string;
  onTextChange: (text: string) => void;
  history: string;
  onHistoryChange: (text: string) => void;
  report: TriggerReport;
  /** The matching-related findings of the same pass Issues lists, shown inline in Triggers. */
  matchingFindings: Finding[];
  /** Fill the Triggers boxes from the world's most recent save; absent when it has none. */
  onPasteLastTurn?: () => void;
  semanticStatus: SemanticStatus;
  semanticOn: boolean;
  onSemanticChange: (on: boolean) => void;
}

/** The Opening instrument's bundle: the fresh-game view-model and its actions. */
export interface OpeningProps {
  data: OpeningData;
  /** Draw fresh values for the unpinned placeholders. */
  onReroll: () => void;
  /** Show the fresh game at another member of the start pool. */
  onStartChange: (startLocationId: string) => void;
  /** Show another row of the opening pool, by its key. */
  onOpeningChange: (openingKey: string) => void;
}

/** The desktop header's placement toggle. Absent on mobile, whose full panel is the sheet either way. */
export interface PlacementControl {
  placement: BenchPlacement;
  onToggle: () => void;
}

/** The Bench Popover's whole contract bar the flask it anchors to, which only the view has. */
export interface BenchPopoverProps {
  open: boolean;
  /** Escape, or a click anywhere but the flask — which owns its own toggle. */
  onClose: () => void;
  issues: IssuesProps;
  onFixRule: (ruleId: string) => void;
  /** The compact way on to the full panel — embedded or docked on desktop, the sheet on mobile. */
  onOpenPanel: () => void;
}

/** One bundle per Instrument plus the bench chrome, so adding an Instrument adds a bundle, not a prop row. */
export interface TestBenchProps {
  tab: BenchTab;
  onTabChange: (tab: BenchTab) => void;
  onClose: () => void;
  /** Apply one rule's fix to the world — shared, because a Triggers warning's Fix is the Issues fix. */
  onFixRule: (ruleId: string) => void;
  /** Where this panel sits and how to move it. Absent in the mobile sheet, which has nowhere else to go. */
  placementControl?: PlacementControl;
  issues: IssuesProps;
  lens: LensBarProps;
  triggers: TriggersProps;
  /** What the harness serves from the lens location — the AI Context instrument's whole view-model. */
  aiContext: AiContextData;
  opening: OpeningProps;
}
