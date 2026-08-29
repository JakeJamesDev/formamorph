/**
 * The World Doctor — everything the rule pass raised, worst first, one row per rule.
 *
 * Its own module because two chromes show it: the Test Bench panel's Issues tab, and the Bench Popover,
 * which is nothing but this list. Presentational like every Instrument — findings arrive as props and each
 * action is a callback the Bench fulfills.
 */
import { useState } from 'react';
import { AlertTriangle, CircleX, EyeOff, Info, Play, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SEVERITIES, type FindingGroup, type Severity } from '@/lib/testBench/rules';
import type { CodeCheckStatus, IssuesProps, OpenFindingItem } from '@/lib/testBench/benchProps';

const SEVERITY_HEADING: Record<Severity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Info',
};

const SEVERITY_HEADING_COLOR: Record<Severity, string> = {
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-muted-foreground',
};

const SeverityIcon = ({ severity }: { severity: Severity }) => {
  const className = 'h-4 w-4 shrink-0';
  if (severity === 'error') return <CircleX className={cn(className, 'text-destructive')} aria-hidden />;
  if (severity === 'warning') return <AlertTriangle className={cn(className, 'text-warning')} aria-hidden />;
  return <Info className={cn(className, 'text-muted-foreground')} aria-hidden />;
};

/** The marker on a row carrying something the author hasn't been shown. A row is the unit they act on, so it
 *  is marked or it isn't — a count of the instances inside it isn't anything they can answer separately. */
const NewMarker = () => (
  <span className="shrink-0 rounded-full bg-warning/20 px-1.5 text-meta font-medium text-warning">New</span>
);

/** One collapsed row: the problem in a line, then every item it names as its own way in. A row whose rule
 *  knows the repair also carries it — one button for the row, never a fix-everything across rows. */
const FindingRow = ({ group, fixing, onOpen, onFix, onDismiss }: {
  group: FindingGroup;
  /** This row's repair is in flight — the one that re-encodes images, which takes long enough to show. */
  fixing: boolean;
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
          // The tip is the clipped name spelled out, so the button keeps naming itself by what it shows.
          <Tip key={item.id} tip={item.name} labelsChild={false}>
            <button
              type="button"
              onClick={() => onOpen(item.section ?? group.section, item.id)}
              className="max-w-full truncate rounded border px-1.5 text-meta text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {item.name}
            </button>
          </Tip>
        ))}
      </div>
    </div>
    {group.fixable && (
      <Button
        variant="outline"
        size="sm"
        className="h-6 shrink-0 px-2 text-meta"
        disabled={fixing}
        onClick={() => onFix(group.ruleId)}
      >
        {fixing ? 'Fixing…' : group.findings.length > 1 ? 'Fix All' : 'Fix'}
      </Button>
    )}
    <Tip tip="Dismiss" labelsChild={false}>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground"
        onClick={() => onDismiss(group.ruleId)}
        aria-label={`Dismiss: ${group.headline}`}
      >
        <EyeOff className="h-3.5 w-3.5" />
      </Button>
    </Tip>
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
              <Tip tip="Restore" labelsChild={false}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 text-muted-foreground"
                  onClick={() => onRestore(group.ruleId)}
                  aria-label={`Restore: ${group.headline}`}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              </Tip>
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

/** The list's one manual action: run every stat's code for real and list what fails. Absent entirely from a
 *  world with no coded stats, since there would be nothing to run — and from Simple mode, which folds the
 *  verdicts away, so running it there would look like a button that does nothing. */
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

export interface IssuesInstrumentProps {
  issues: IssuesProps;
  onFix: (ruleId: string) => void;
}

/**
 * The findings list itself, sized by whatever wraps it — the panel's tab gives it a scroll area, the popover
 * a max-height box. Takes the Issues bundle whole, so both chromes hand it the same thing.
 */
export function IssuesInstrument({ issues, onFix }: IssuesInstrumentProps) {
  return (
    <div className="pr-2">
      {issues.newCount > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-meta font-medium text-warning">{issues.newCount} new</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-meta" onClick={issues.onMarkAllSeen}>
            Mark All Seen
          </Button>
        </div>
      )}
      {issues.groups.length === 0 ? (
        // Only when there is genuinely nothing: a world whose every finding is folded away is not clean, and
        // the fold below is what says so.
        issues.advancedOnlyCount === 0 && (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="text-label font-medium">No Problems Found</p>
            <p className="text-meta text-muted-foreground">{issues.ruleCount} rules checked</p>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {SEVERITIES.map((severity) => {
            const inSeverity = issues.groups.filter((g) => g.severity === severity);
            if (inSeverity.length === 0) return null;
            return (
              <div key={severity} className="space-y-2">
                <p className={cn('pt-1 text-meta font-medium', SEVERITY_HEADING_COLOR[severity])}>
                  {SEVERITY_HEADING[severity]}
                </p>
                {inSeverity.map((group) => (
                  <FindingRow
                    key={group.ruleId}
                    group={group}
                    fixing={issues.fixingRuleId === group.ruleId}
                    onOpen={issues.onOpenItem}
                    onFix={onFix}
                    onDismiss={issues.onDismissRule}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
      <StatCodeCheck
        codedStatCount={issues.codedStatCount}
        advanced={issues.advanced}
        status={issues.codeCheckStatus}
        onRun={issues.onCheckStatCode}
      />
      <AdvancedOnlySection count={issues.advancedOnlyCount} />
      <DismissedSection groups={issues.dismissedGroups} onRestore={issues.onRestoreRule} />
    </div>
  );
}
