/**
 * The World Doctor — the world's Publish Size, then everything the rule pass raised, worst first, one row
 * per rule.
 *
 * Its own module because two chromes show it: the Test Bench panel's Issues tab, and the Bench Popover,
 * which is nothing but this list. Presentational like every Instrument — findings arrive as props and each
 * action is a callback the Bench fulfills.
 */
import { useId, useState } from 'react';
import { AlertTriangle, CircleX, EyeOff, Info, Play, RefreshCw, Undo2 } from 'lucide-react';
import { HintInfo } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { SEVERITIES, SOURCE_UNAVAILABLE, type FindingGroup, type Severity } from '@/lib/testBench/rules';
import { isSourceRule, sourceSection } from '@/lib/testBench/missingSources';
import { REPAIR_CHOICES, type MissingSource, type RepairAction } from '@/lib/sourceChecks';
import type {
  CheckStatus, IssuesProps, OpenFindingItem, SourceCheckProps,
} from '@/lib/testBench/benchProps';
import {
  formatPublishBytes, PUBLISH_LIMITS, publishSizeBand, type PublishSizeBand,
} from '@/lib/publishLimits';

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

const BAND_FILL: Record<PublishSizeBand, string> = {
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-destructive',
};

export const PUBLISH_SIZE_INFO = `**Publish Size** counts the bytes of world content that publishing sends. Publishing stops when it's more than the publish limit.

- Embedded images, Ambient Sound, Background Music, and 3D Model files add to the Publish Size
- A linked image adds only its URL
- The file from **Export World** is larger, because that export indents the file`;

/** The world's publish size against the world limit. The fill stops at full; the readout does not. */
const PublishSizeBar = ({ bytes }: { bytes: number }) => {
  const labelId = useId();
  const limit = PUBLISH_LIMITS.world;
  const { band, ratio } = publishSizeBand(bytes, limit);
  const readout = `${formatPublishBytes(bytes)} of ${formatPublishBytes(limit)}`;
  return (
    <div className="mb-2 space-y-1">
      <div className="flex items-center gap-1.5">
        <span id={labelId} className="text-meta font-medium">Publish Size</span>
        <HintInfo>{PUBLISH_SIZE_INFO}</HintInfo>
        <Meta className="ml-auto tabular-nums">{readout}</Meta>
      </div>
      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(bytes, limit)}
        aria-valuetext={readout}
        data-band={band}
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div className={cn('h-full rounded-full', BAND_FILL[band])} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
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

/** One copy whose source is gone, with the repair the author picks for it. Nothing is selected to begin
 *  with, and Apply is what commits: a repair rewrites or removes content, so no dropdown does it by itself. */
const SourceRepairRow = ({ row, disabled, onOpen, onRepair }: {
  row: MissingSource;
  disabled: boolean;
  onOpen: OpenFindingItem;
  onRepair: (copyId: string, action: RepairAction) => void;
}) => {
  const [action, setAction] = useState<RepairAction | ''>('');
  const section = sourceSection(row.kind);
  return (
    <div className="space-y-1">
      {/* The copy's own way in, on its own line: a name is as long as the author made it, and the repair
          controls below must not be pushed off the row by one. */}
      <Tip tip={row.name} labelsChild={false}>
        <button
          type="button"
          onClick={() => onOpen(section, row.id)}
          className="block max-w-full truncate rounded border px-1.5 text-meta text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {row.name}
        </button>
      </Tip>
      <div className="flex items-center gap-1.5">
        <Select value={action} onValueChange={(next) => setAction(next as RepairAction)} disabled={disabled}>
          <SelectTrigger className="h-6 min-w-0 flex-grow px-2 text-meta" aria-label={`Repair for ${row.name}`}>
            <SelectValue placeholder="Select a repair" />
          </SelectTrigger>
          <SelectContent>
            {REPAIR_CHOICES.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-6 shrink-0 px-2 text-meta"
          disabled={disabled || !action}
          onClick={() => { if (action) onRepair(row.id, action); }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
};

/**
 * A missing-source row: the rule's own headline, then one repair per copy it names.
 *
 * It replaces the ordinary row for these two rules because the repair is not the rule's, it is each copy's:
 * one copy may be replaced from the library while another is removed outright. An unreachable source also
 * carries Retry Check, since asking again is the answer there far more often than a repair is.
 *
 * It is the one row with no Dismiss. A removed required source blocks a new game and a publish from the main
 * menu, and muting the row would take away the only repair while leaving the block on. The row goes when the
 * copy it names is repaired, which is the way out of it.
 */
const SourceFindingRow = ({ group, sources, onOpen }: {
  group: FindingGroup;
  sources: SourceCheckProps;
  onOpen: OpenFindingItem;
}) => {
  const running = sources.status === 'running';
  const named = new Set(group.findings.flatMap((f) => f.items).map((item) => item.id));
  const rows = sources.missing.filter((row) => named.has(row.id));
  return (
    <div className="flex items-start gap-2 rounded-md border p-2">
      <SeverityIcon severity={group.severity} />
      <div className="min-w-0 flex-grow space-y-1.5">
        <p className="text-label leading-snug">
          {group.newCount > 0 && <><NewMarker />{' '}</>}
          {group.headline}
        </p>
        {rows.map((row) => (
          <SourceRepairRow
            key={row.id}
            row={row}
            disabled={running}
            onOpen={onOpen}
            onRepair={sources.onRepair}
          />
        ))}
      </div>
      {group.findings.some((f) => f.ruleId === SOURCE_UNAVAILABLE.id) && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 shrink-0 px-2 text-meta"
          disabled={running}
          onClick={sources.onCheckSources}
        >
          <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
          {running ? 'Checking…' : 'Retry Check'}
        </Button>
      )}
    </div>
  );
};

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
              <Meta as="p" className="min-w-0 flex-grow truncate">{group.headline}</Meta>
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
  status: CheckStatus;
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

/**
 * The list's other manual action: ask the server whether each source this world's copies follow is still
 * there. Absent from a world whose copies follow nothing published, where there would be nothing to ask
 * about. It never runs on its own: a world stays playable offline, and only a definite answer to a question
 * the author asked is worth reporting a source as gone over.
 */
const SourceCheck = ({ sources }: { sources: SourceCheckProps }) => {
  if (sources.sourceCount === 0) return null;
  const running = sources.status === 'running';
  const count = sources.sourceCount;
  return (
    <div className="mt-2 flex items-center gap-2 border-t pt-2">
      <p className="min-w-0 flex-grow text-meta text-muted-foreground">
        {sources.status === 'done'
          ? `Checked ${count} linked ${count === 1 ? 'copy' : 'copies'}`
          : `${count} linked ${count === 1 ? 'copy follows' : 'copies follow'} a source, checked separately`}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="h-6 shrink-0 px-2 text-meta"
        onClick={sources.onCheckSources}
        disabled={running}
      >
        <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
        {running ? 'Checking…' : sources.status === 'done' ? 'Check Again' : 'Check Sources'}
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
      {issues.publishBytes !== null && <PublishSizeBar bytes={issues.publishBytes} />}
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
                {inSeverity.map((group) => (isSourceRule(group.ruleId) ? (
                  <SourceFindingRow
                    key={group.ruleId}
                    group={group}
                    sources={issues.sources}
                    onOpen={issues.onOpenItem}
                  />
                ) : (
                  <FindingRow
                    key={group.ruleId}
                    group={group}
                    fixing={issues.fixingRuleId === group.ruleId}
                    onOpen={issues.onOpenItem}
                    onFix={onFix}
                    onDismiss={issues.onDismissRule}
                  />
                )))}
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
      <SourceCheck sources={issues.sources} />
      <AdvancedOnlySection count={issues.advancedOnlyCount} />
      <DismissedSection groups={issues.dismissedGroups} onRestore={issues.onRestoreRule} />
    </div>
  );
}
