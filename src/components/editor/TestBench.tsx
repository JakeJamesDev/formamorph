/**
 * The Test Bench — the World Editor's third panel, where an author tests how the harness reads their
 * world. Chrome is fixed: bench header, lens row, instrument tab strip, content. Only the Issues
 * instrument is built; the rest render as disabled tabs so the shape of the surface is honest.
 *
 * Presentational: findings arrive as props, and navigation is a callback the editor fulfills, so the
 * panel renders identically inside the desktop split and the mobile sheet.
 */
import { AlertTriangle, ChevronDown, CircleX, FlaskConical, Info, MapPin, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { SEVERITIES, type FindingGroup, type FindingSection, type Severity } from '@/lib/testBench/rules';
import { BENCH_TABS, type BenchTab } from './benchTabs';

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

/** One collapsed row: the problem in a line, then every item it names as its own way in. */
const FindingRow = ({ group, onOpen }: { group: FindingGroup; onOpen: OpenFindingItem }) => (
  <div className="flex items-start gap-2 rounded-md border p-2">
    <SeverityIcon severity={group.severity} />
    <div className="min-w-0 flex-grow">
      <p className="text-label leading-snug">{group.headline}</p>
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
  </div>
);

/** World Doctor: everything the rule pass raised, worst first, one row per rule. */
const IssuesInstrument = ({ groups, ruleCount, onOpen }: {
  groups: FindingGroup[];
  ruleCount: number;
  onOpen: OpenFindingItem;
}) => {
  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <p className="text-label font-medium">No Problems Found</p>
        <p className="text-meta text-muted-foreground">{ruleCount} rules checked</p>
      </div>
    );
  }
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 pr-2">
        {SEVERITIES.map((severity) => {
          const inSeverity = groups.filter((g) => g.severity === severity);
          if (inSeverity.length === 0) return null;
          return (
            <div key={severity} className="space-y-2">
              <p className={cn('pt-1 text-meta font-medium', SEVERITY_HEADING_COLOR[severity])}>
                {SEVERITY_HEADING[severity]}
              </p>
              {inSeverity.map((group) => (
                <FindingRow key={group.ruleId} group={group} onOpen={onOpen} />
              ))}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};

export interface TestBenchProps {
  groups: FindingGroup[];
  /** How many rules ran — what makes a clean world read as verified rather than broken. */
  ruleCount: number;
  tab: BenchTab;
  onTabChange: (tab: BenchTab) => void;
  onClose: () => void;
  onOpenItem: OpenFindingItem;
}

export function TestBench({ groups, ruleCount, tab, onTabChange, onClose, onOpenItem }: TestBenchProps) {
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
              <IssuesInstrument groups={groups} ruleCount={ruleCount} onOpen={onOpenItem} />
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

/** The editor header's persistent way in, carrying the finding count. Icon-sized in every state, so the
 *  count appearing or clearing never reflows the header row. */
export function TestBenchButton({ count, open, onClick }: {
  count: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={open ? 'secondary' : 'ghost'}
      size="icon"
      className="relative"
      onClick={onClick}
      aria-pressed={open}
      aria-label={count > 0 ? `Test Bench, ${count} findings` : 'Test Bench'}
      title="Test Bench"
    >
      <FlaskConical className="h-4 w-4" />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute right-0 top-0 rounded-full bg-warning px-1 text-meta font-medium leading-tight text-warning-foreground"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Button>
  );
}
