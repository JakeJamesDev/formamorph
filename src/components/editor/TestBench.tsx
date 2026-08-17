/**
 * The Test Bench — the World Editor's third panel, where an author tests how the harness reads their
 * world. Chrome is fixed: bench header, lens row, instrument tab strip, content.
 *
 * Presentational: findings arrive as props, and navigation is a callback the editor fulfills, so the
 * panel renders identically inside the desktop split and the mobile sheet.
 */
import { useState } from 'react';
import { AlertTriangle, CircleX, EyeOff, FlaskConical, Info, MapPin, Play, Undo2, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { describeBrokenPin, type LensOption } from '@/lib/testBench/lens';
import { SEVERITIES, type FindingGroup, type Severity } from '@/lib/testBench/rules';
import { BENCH_TABS, type BenchTab } from '@/lib/testBench/benchTabs';
import type { CodeCheckStatus, LensBarProps, OpenFindingItem, TestBenchProps } from '@/lib/testBench/benchProps';
import { AiContextInstrument } from './AiContextInstrument';
import { OpeningInstrument } from './OpeningInstrument';
import { TriggersInstrument } from './TriggersInstrument';

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

/**
 * What Simple mode folded away — the rows about fields it hides. Counted and named rather than listed: an
 * author who has never seen an alias field can't act on an alias finding, and a Fix here would rewrite one
 * unseen. It says where the way in is instead.
 */
const AdvancedOnlySection = ({ count }: { count: number }) => {
  const [shown, setShown] = useState(false);
  if (count === 0) return null;
  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="text-meta text-muted-foreground hover:text-foreground"
        aria-expanded={shown}
      >
        {count} {count === 1 ? 'finding needs' : 'findings need'} Advanced mode
      </button>
      {shown && (
        <p className="mt-1 text-meta text-muted-foreground">
          These are about fields Simple mode hides. Switch the editor to Advanced, beside the World Editor
          title, to see them.
        </p>
      )}
    </div>
  );
};

/** The Issues tab's one manual action: run every stat's code for real and list what fails. Absent entirely
 *  from a world with no coded stats, since there would be nothing to run — and from Simple mode, which folds
 *  the verdicts away, so running it there would look like a button that does nothing. */
const StatCodeCheck = ({ codedStatCount, advanced, status, onRun }: {
  codedStatCount: number;
  advanced: boolean;
  status: CodeCheckStatus;
  onRun: () => void;
}) => {
  if (codedStatCount === 0 || !advanced) return null;
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
  groups, dismissedGroups, ruleCount, newCount, advancedOnlyCount, advanced, codedStatCount, codeCheckStatus,
  onOpen, onFix, onDismiss, onRestore, onMarkAllSeen, onCheckStatCode,
}: {
  groups: FindingGroup[];
  dismissedGroups: FindingGroup[];
  ruleCount: number;
  newCount: number;
  advancedOnlyCount: number;
  advanced: boolean;
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
        // Only when there is genuinely nothing: a world whose every finding is folded away is not clean, and
        // the fold below is what says so.
        advancedOnlyCount === 0 && (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="text-label font-medium">No Problems Found</p>
            <p className="text-meta text-muted-foreground">{ruleCount} rules checked</p>
          </div>
        )
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
      <StatCodeCheck
        codedStatCount={codedStatCount}
        advanced={advanced}
        status={codeCheckStatus}
        onRun={onCheckStatCode}
      />
      <AdvancedOnlySection count={advancedOnlyCount} />
      <DismissedSection groups={dismissedGroups} onRestore={onRestore} />
    </div>
  </ScrollArea>
);

export function TestBench({ tab, onTabChange, onClose, onFixRule, issues, lens, triggers, aiContext, opening }: TestBenchProps) {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-label font-medium">Test Bench</span>
        <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={onClose} aria-label="Close Test Bench">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <LensBar {...lens} />
      <Tabs
        value={tab}
        onValueChange={(v) => onTabChange(v as BenchTab)}
        className="flex min-h-0 flex-grow flex-col gap-2"
      >
        <TabsList className="grid h-auto w-full grid-cols-4">
          {BENCH_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="px-1">
              {t.label}
              {t.value === 'issues' && issues.groups.length > 0 && (
                <span className="ml-1 rounded-full bg-warning/20 px-1 text-meta text-warning">{issues.groups.length}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* One panel per trigger so every `aria-controls` resolves. */}
        {BENCH_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0 min-h-0 flex-grow">
            {t.value === 'issues' && (
              <IssuesInstrument
                groups={issues.groups}
                dismissedGroups={issues.dismissedGroups}
                ruleCount={issues.ruleCount}
                newCount={issues.newCount}
                advancedOnlyCount={issues.advancedOnlyCount}
                advanced={issues.advanced}
                codedStatCount={issues.codedStatCount}
                codeCheckStatus={issues.codeCheckStatus}
                onOpen={issues.onOpenItem}
                onFix={onFixRule}
                onDismiss={issues.onDismissRule}
                onRestore={issues.onRestoreRule}
                onMarkAllSeen={issues.onMarkAllSeen}
                onCheckStatCode={issues.onCheckStatCode}
              />
            )}
            {t.value === 'triggers' && (
              <TriggersInstrument
                text={triggers.text}
                onTextChange={triggers.onTextChange}
                history={triggers.history}
                onHistoryChange={triggers.onHistoryChange}
                report={triggers.report}
                warnings={triggers.matchingFindings}
                onFixRule={onFixRule}
                onPasteLastTurn={triggers.onPasteLastTurn}
                semanticStatus={triggers.semanticStatus}
                semanticOn={triggers.semanticOn}
                onSemanticChange={triggers.onSemanticChange}
              />
            )}
            {t.value === 'aiContext' && <AiContextInstrument data={aiContext} />}
            {t.value === 'opening' && <OpeningInstrument data={opening.data} onReroll={opening.onReroll} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/** Radix has no value for "nothing selected", and an empty string is not a legal item value — so the
 *  no-selection row carries a token of its own. */
const NO_SELECTION = '__none__';

/** One half of the lens. Empty of options means the world has nothing of that kind to pick, so the selector
 *  says so on its face rather than opening onto an empty list. */
const LensSelect = ({ icon: Icon, label, none, value, options, onChange }: {
  icon: typeof User;
  label: string;
  /** What the no-selection row reads as — also what the trigger shows while nothing is picked. */
  none: string;
  value: string | null;
  options: LensOption[];
  onChange: (id: string | null) => void;
}) => {
  // Consecutive options sharing a heading become one labeled group; ungrouped options (locations) stay flat.
  const groups: Array<{ name?: string; options: LensOption[] }> = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.name === option.groupName) last.options.push(option);
    else groups.push({ name: option.groupName, options: [option] });
  }
  return (
    <Select
      value={value ?? NO_SELECTION}
      onValueChange={(next) => onChange(next === NO_SELECTION ? null : next)}
      disabled={options.length === 0}
    >
      <SelectTrigger size="sm" aria-label={label} className="min-w-0 flex-grow gap-1">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <SelectValue placeholder={none} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_SELECTION}>{none}</SelectItem>
        {groups.map((group, index) => (
          <SelectGroup key={group.name ?? index}>
            {group.name && <SelectLabel>{group.name}</SelectLabel>}
            {group.options.map((option) => (
              <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};

/** The Bench-level lens every instrument reads: who is being played, and where they are standing. Its notes
 *  sit under it because both are consequences of the PC on the selector directly above them. */
const LensBar = ({ lens, pcOptions, locationOptions, statOverrides, onPcChange, onLocationChange }: LensBarProps) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-meta text-muted-foreground">Testing as</span>
      <LensSelect
        icon={User}
        label="Test as character"
        none="Anyone"
        value={lens.state.pcTraitId}
        options={pcOptions}
        onChange={onPcChange}
      />
      <span className="shrink-0 text-meta text-muted-foreground">at</span>
      <LensSelect
        icon={MapPin}
        label="Test at location"
        none="Nowhere"
        value={lens.state.locationId}
        options={locationOptions}
        onChange={onLocationChange}
      />
    </div>
    {lens.brokenPins.map((pin) => (
      <p key={`${pin.placeholderId}:${pin.value}`} className="flex items-start gap-1 text-meta text-destructive">
        <CircleX className="mt-px h-3 w-3 shrink-0" aria-hidden />
        {describeBrokenPin(pin)}
      </p>
    ))}
    {statOverrides.length > 0 && (
      <p className="text-meta text-muted-foreground">
        {statOverrides.map((o) => `${o.enabled ? 'Adds' : 'Removes'} ${o.stat}`).join(' · ')}
      </p>
    )}
  </div>
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
