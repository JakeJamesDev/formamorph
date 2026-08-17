/**
 * The Test Bench — the World Editor's third panel, where an author tests how the harness reads their
 * world. Chrome is fixed: bench header, lens row, instrument tab strip, content. Issues and Triggers are
 * built; the rest render as disabled tabs so the shape of the surface is honest.
 *
 * Presentational: findings arrive as props, and navigation is a callback the editor fulfills, so the
 * panel renders identically inside the desktop split and the mobile sheet.
 */
import { useState } from 'react';
import { AlertTriangle, ChevronDown, CircleX, EyeOff, FlaskConical, Info, MapPin, Play, Undo2, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { SEVERITIES, type Finding, type FindingGroup, type FindingSection, type Severity } from '@/lib/testBench/rules';
import type { TriggerReport } from '@/lib/testBench/triggers';
import { BENCH_TABS, type BenchTab } from './benchTabs';
import { TriggersInstrument } from './TriggersInstrument';

/** Where the author is sent when they click an item a finding names. */
export type OpenFindingItem = (section: FindingSection, itemId: string) => void;

const SEVERITY_HEADING: Record<Severity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Info',
};

const SeverityIcon = ({ severity }: { severity: Severity }) => {
  const className = 'h-4 w-4 shrink-0';
  if (severity === 'error') return <CircleX className={cn(className, 'text-destructive')} aria-hidden />;
  if (severity === 'warning') return <AlertTriangle className={cn(className, 'text-warning')} aria-hidden />;
  return <Info className={cn(className, 'text-muted-foreground')} aria-hidden />;
};

const SEVERITY_HEADING_COLOR: Record<Severity, string> = {
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-muted-foreground',
};

/** The marker on a row carrying something the author hasn't been shown. A row is the unit they act on, so it
 *  is marked or it isn't — a count of the instances inside it isn't anything they can answer separately. */
const NewMarker = () => (
  <span className="shrink-0 rounded-full bg-warning/20 px-1.5 text-meta font-medium text-warning">New</span>
);

/** One collapsed row: the problem in a line, then every item it names as its own way in. A row whose rule
 *  knows the repair also carries it — one button for the row, never a fix-everything across rows. */
const FindingRow = ({ group, onOpen, onFix, onDismiss }: {
  group: FindingGroup;
  onOpen: OpenFindingItem;
  onFix: (ruleId: string) => void;
  onDismiss: (ruleId: string) => void;
}) => (
  <div className="flex items-start gap-2 rounded-md border p-2">
    <SeverityIcon severity={group.severity} />
    <div className="min-w-0 flex-grow">
      <p className="text-label leading-snug">
        {group.newCount > 0 && <><NewMarker />{' '}</>}
        {group.headline}
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {group.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item.section ?? group.section, item.id)}
            className="max-w-full truncate rounded border px-1.5 text-meta text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
    {group.fixable && (
      <Button variant="outline" size="sm" className="h-6 shrink-0 px-2 text-meta" onClick={() => onFix(group.ruleId)}>
        {group.findings.length > 1 ? 'Fix All' : 'Fix'}
      </Button>
    )}
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0 text-muted-foreground"
      onClick={() => onDismiss(group.ruleId)}
      aria-label={`Dismiss: ${group.headline}`}
      title="Dismiss"
    >
      <EyeOff className="h-3.5 w-3.5" />
    </Button>
  </div>
);

/** The muted rows, folded away until asked for — a dismissal the author can't take back is a trap. */
const DismissedSection = ({ groups, onRestore }: {
  groups: FindingGroup[];
  onRestore: (ruleId: string) => void;
}) => {
  const [shown, setShown] = useState(false);
  if (groups.length === 0) return null;
  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="text-meta text-muted-foreground hover:text-foreground"
        aria-expanded={shown}
      >
        {groups.length} dismissed
      </button>
      {shown && (
        <div className="mt-1 space-y-1">
          {groups.map((group) => (
            <div key={group.ruleId} className="flex items-start gap-2 rounded-md border border-dashed p-1.5">
              <p className="min-w-0 flex-grow truncate text-meta text-muted-foreground">{group.headline}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 text-muted-foreground"
                onClick={() => onRestore(group.ruleId)}
                aria-label={`Restore: ${group.headline}`}
                title="Restore"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** How far the on-demand stat-code check has got. It never runs on its own — every run costs one sandbox VM
 *  per coded stat, which is why the live pass can't have it. */
export type CodeCheckStatus = 'idle' | 'running' | 'done';

/** The Issues tab's one manual action: run every stat's code for real and list what fails. Absent entirely
 *  from a world with no coded stats, since there would be nothing to run. */
const StatCodeCheck = ({ codedStatCount, status, onRun }: {
  codedStatCount: number;
  status: CodeCheckStatus;
  onRun: () => void;
}) => {
  if (codedStatCount === 0) return null;
  const running = status === 'running';
  return (
    <div className="mt-2 flex items-center gap-2 border-t pt-2">
      <p className="min-w-0 flex-grow text-meta text-muted-foreground">
        {status === 'done'
          ? `Checked ${codedStatCount} coded ${codedStatCount === 1 ? 'stat' : 'stats'}`
          : `${codedStatCount} ${codedStatCount === 1 ? 'stat has' : 'stats have'} code, run separately`}
      </p>
      <Button variant="outline" size="sm" className="h-6 shrink-0 px-2 text-meta" onClick={onRun} disabled={running}>
        <Play className="mr-1 h-3 w-3" aria-hidden />
        {running ? 'Running…' : status === 'done' ? 'Check Again' : 'Check Stat Code'}
      </Button>
    </div>
  );
};

/** World Doctor: everything the rule pass raised, worst first, one row per rule. */
const IssuesInstrument = ({
  groups, dismissedGroups, ruleCount, newCount, codedStatCount, codeCheckStatus,
  onOpen, onFix, onDismiss, onRestore, onMarkAllSeen, onCheckStatCode,
}: {
  groups: FindingGroup[];
  dismissedGroups: FindingGroup[];
  ruleCount: number;
  newCount: number;
  codedStatCount: number;
  codeCheckStatus: CodeCheckStatus;
  onOpen: OpenFindingItem;
  onFix: (ruleId: string) => void;
  onDismiss: (ruleId: string) => void;
  onRestore: (ruleId: string) => void;
  onMarkAllSeen: () => void;
  onCheckStatCode: () => void;
}) => (
  <ScrollArea className="h-full">
    <div className="pr-2">
      {newCount > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-meta font-medium text-warning">{newCount} new</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-meta" onClick={onMarkAllSeen}>
            Mark All Seen
          </Button>
        </div>
      )}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-8 text-center">
          <p className="text-label font-medium">No Problems Found</p>
          <p className="text-meta text-muted-foreground">{ruleCount} rules checked</p>
        </div>
      ) : (
        <div className="space-y-2">
          {SEVERITIES.map((severity) => {
            const inSeverity = groups.filter((g) => g.severity === severity);
            if (inSeverity.length === 0) return null;
            return (
              <div key={severity} className="space-y-2">
                <p className={cn('pt-1 text-meta font-medium', SEVERITY_HEADING_COLOR[severity])}>
                  {SEVERITY_HEADING[severity]}
                </p>
                {inSeverity.map((group) => (
                  <FindingRow key={group.ruleId} group={group} onOpen={onOpen} onFix={onFix} onDismiss={onDismiss} />
                ))}
              </div>
            );
          })}
        </div>
      )}
      <StatCodeCheck codedStatCount={codedStatCount} status={codeCheckStatus} onRun={onCheckStatCode} />
      <DismissedSection groups={dismissedGroups} onRestore={onRestore} />
    </div>
  </ScrollArea>
);

export interface TestBenchProps {
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
  tab: BenchTab;
  onTabChange: (tab: BenchTab) => void;
  onClose: () => void;
  onOpenItem: OpenFindingItem;
  /** Apply one rule's fix to the world — the editor's write-through, so it lands as a hand edit would. */
  onFixRule: (ruleId: string) => void;
  onDismissRule: (ruleId: string) => void;
  onRestoreRule: (ruleId: string) => void;
  onMarkAllSeen: () => void;
  /** Run every stat's code in the real sandbox and fold the failures into the list. */
  onCheckStatCode: () => void;
  /** The Triggers scene text, held above the tab strip so switching instruments doesn't discard it. */
  triggerText: string;
  onTriggerTextChange: (text: string) => void;
  /** The Triggers history box, held for the same reason. */
  triggerHistory: string;
  onTriggerHistoryChange: (text: string) => void;
  triggerReport: TriggerReport;
  /** The matching-related findings of the same pass Issues lists, shown inline in Triggers. */
  matchingFindings: Finding[];
  /** Fill the Triggers boxes from the world's most recent save; absent when it has none. */
  onPasteLastTurn?: () => void;
}

export function TestBench({
  groups, dismissedGroups, ruleCount, newCount, codedStatCount, codeCheckStatus, tab, onTabChange, onClose,
  onOpenItem, onFixRule, onDismissRule, onRestoreRule, onMarkAllSeen, onCheckStatCode,
  triggerText, onTriggerTextChange, triggerHistory, onTriggerHistoryChange, triggerReport,
  matchingFindings, onPasteLastTurn,
}: TestBenchProps) {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-label font-medium">Test Bench</span>
        <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={onClose} aria-label="Close Test Bench">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {/* Lens row: the shared `Testing as [PC] · at [location]` selectors, inert until the lens is wired. */}
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-meta text-muted-foreground">Testing as</span>
        <LensSlot icon={User} label="Test as character" />
        <span className="shrink-0 text-meta text-muted-foreground">at</span>
        <LensSlot icon={MapPin} label="Test at location" />
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => onTabChange(v as BenchTab)}
        className="flex min-h-0 flex-grow flex-col gap-2"
      >
        <TabsList className="grid h-auto w-full grid-cols-4">
          {BENCH_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} disabled={'unbuilt' in t && t.unbuilt} className="px-1">
              {t.label}
              {t.value === 'issues' && groups.length > 0 && (
                <span className="ml-1 rounded-full bg-warning/20 px-1 text-meta text-warning">{groups.length}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* One panel per trigger so every `aria-controls` resolves; only the built instrument has a body. */}
        {BENCH_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0 min-h-0 flex-grow">
            {t.value === 'issues' && (
              <IssuesInstrument
                groups={groups}
                dismissedGroups={dismissedGroups}
                ruleCount={ruleCount}
                newCount={newCount}
                codedStatCount={codedStatCount}
                codeCheckStatus={codeCheckStatus}
                onOpen={onOpenItem}
                onFix={onFixRule}
                onDismiss={onDismissRule}
                onRestore={onRestoreRule}
                onMarkAllSeen={onMarkAllSeen}
                onCheckStatCode={onCheckStatCode}
              />
            )}
            {t.value === 'triggers' && (
              <TriggersInstrument
                text={triggerText}
                onTextChange={onTriggerTextChange}
                history={triggerHistory}
                onHistoryChange={onTriggerHistoryChange}
                report={triggerReport}
                warnings={matchingFindings}
                onFixRule={onFixRule}
                onPasteLastTurn={onPasteLastTurn}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

const LensSlot = ({ icon: Icon, label }: { icon: typeof User; label: string }) => (
  <button
    type="button"
    disabled
    aria-label={label}
    className="flex min-w-0 flex-grow items-center gap-1 rounded-md border px-2 py-1 text-label disabled:opacity-50"
  >
    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
    <span className="truncate text-muted-foreground">—</span>
    <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
  </button>
);

/**
 * The editor header's persistent way in, carrying the finding count. Icon-sized in every state, so the count
 * appearing or clearing never reflows the header row.
 *
 * The badge reports what is new, prominently; once the author has seen the list it drops to a muted total,
 * so a still badge means "nothing has changed since you looked" rather than "nothing is wrong".
 */
export function TestBenchButton({ count, newCount, open, onClick }: {
  count: number;
  newCount: number;
  open: boolean;
  onClick: () => void;
}) {
  const fresh = newCount > 0;
  const shown = fresh ? newCount : count;
  const noun = shown === 1 ? 'finding' : 'findings';
  return (
    <Button
      variant={open ? 'secondary' : 'ghost'}
      size="icon"
      className="relative"
      onClick={onClick}
      aria-pressed={open}
      aria-label={
        fresh ? `Test Bench, ${shown} new ${noun}`
          : count > 0 ? `Test Bench, ${shown} ${noun}`
            : 'Test Bench'
      }
      title="Test Bench"
    >
      <FlaskConical className="h-4 w-4" />
      {count > 0 && (
        <span
          aria-hidden
          className={cn(
            'absolute right-0 top-0 rounded-full px-1 text-meta font-medium leading-tight',
            fresh ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {shown > 99 ? '99+' : shown}
        </span>
      )}
    </Button>
  );
}
