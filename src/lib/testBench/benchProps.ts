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

/** Where the author is sent when they click an item a finding names. */
export type OpenFindingItem = (section: FindingSection, itemId: string) => void;

/** How far the on-demand stat-code check has got. It never runs on its own — every run costs one sandbox VM
 *  per coded stat, which is why the live pass can't have it. */
export type CodeCheckStatus = 'idle' | 'running' | 'done';

/** The World Doctor's bundle: the marked finding rows and every action a row offers, fixes aside. */
export interface IssuesProps {
  groups: FindingGroup[];
  /** The rows the author muted, kept reachable so a dismissal is never one-way. */
  dismissedGroups: FindingGroup[];
  /** How many rules ran — what makes a clean world read as verified rather than broken. */
  ruleCount: number;
  /** How many rows carry something the author has not been shown. */
  newCount: number;
  /** How many stats carry code — what the on-demand check would have to run. */
  codedStatCount: number;
  codeCheckStatus: CodeCheckStatus;
  onOpenItem: OpenFindingItem;
  onDismissRule: (ruleId: string) => void;
  onRestoreRule: (ruleId: string) => void;
  onMarkAllSeen: () => void;
  /** Run every stat's code in the real sandbox and fold the failures into the list. */
  onCheckStatCode: () => void;
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

/** The Opening instrument's bundle: the fresh-game view-model and its one action. */
export interface OpeningProps {
  data: OpeningData;
  /** Draw fresh values for the unpinned placeholders. */
  onReroll: () => void;
}

/** One bundle per Instrument plus the bench chrome, so adding an Instrument adds a bundle, not a prop row. */
export interface TestBenchProps {
  tab: BenchTab;
  onTabChange: (tab: BenchTab) => void;
  onClose: () => void;
  /** Apply one rule's fix to the world — shared, because a Triggers warning's Fix is the Issues fix. */
  onFixRule: (ruleId: string) => void;
  issues: IssuesProps;
  lens: LensBarProps;
  triggers: TriggersProps;
  /** What the harness serves from the lens location — the AI Context instrument's whole view-model. */
  aiContext: AiContextData;
  opening: OpeningProps;
}
