/**
 * The Test Bench panel — the full surface, where an author tests how the harness reads their world. Chrome
 * is fixed: bench header, lens row, instrument tab strip, content.
 *
 * Presentational: findings arrive as props, and navigation is a callback the editor fulfills, so the panel
 * renders identically embedded in the editor's list panel, docked beside it, and inside the mobile sheet.
 */
import { CircleX, FlaskConical, MapPin, PanelLeft, PanelRight, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { describeBrokenPin, type LensOption } from '@/lib/testBench/lens';
import { BENCH_TABS, type BenchTab } from '@/lib/testBench/benchTabs';
import type { BenchPlacement } from '@/lib/testBench/benchPlacement';
import type { LensBarProps, TestBenchProps } from '@/lib/testBench/benchProps';
import { AiContextInstrument } from './AiContextInstrument';
import { IssuesInstrument } from './IssuesInstrument';
import { OpeningInstrument } from './OpeningInstrument';
import { TriggersInstrument } from './TriggersInstrument';
import { Tip } from '@/components/ui/tooltip';

/** The toggle names the placement it would move to, not the one it is in — it is an action, not a label. */
const PLACEMENT_TOGGLE: Record<BenchPlacement, { label: string; icon: typeof PanelLeft }> = {
  embedded: { label: 'Pop Out', icon: PanelRight },
  docked: { label: 'Embed in Editor', icon: PanelLeft },
};

export function TestBench({
  tab, onTabChange, onClose, onFixRule, issues, lens, triggers, aiContext, opening, placementControl,
}: TestBenchProps) {
  const toggle = placementControl && PLACEMENT_TOGGLE[placementControl.placement];
  return (
    // Embedded sits inside the editor's CardContent, which already pads — its own padding would stack, and
    // the Bench's chrome would no longer start where the tab strip it replaced did.
    <div className={cn('flex h-full flex-col gap-2', placementControl?.placement !== 'embedded' && 'p-3')}>
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-label font-medium">Test Bench</span>
        {toggle && placementControl && (
          <Tip tip={toggle.label}>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7"
              onClick={placementControl.onToggle}
            >
              <toggle.icon className="h-4 w-4" />
            </Button>
          </Tip>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7', !toggle && 'ml-auto')}
          onClick={onClose}
          aria-label="Close Test Bench"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
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
        {/* Below the strip, and only on the instruments that read it — the selection itself is Bench-level
            state, so it survives visits to a tab that hides the bar. */}
        {BENCH_TABS.find((t) => t.value === tab)?.usesLens && <LensBar {...lens} />}
        {/* One panel per trigger so every `aria-controls` resolves. */}
        {BENCH_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0 min-h-0 flex-grow">
            {t.value === 'issues' && (
              <ScrollArea className="h-full">
                <IssuesInstrument issues={issues} onFix={onFixRule} />
              </ScrollArea>
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
    // The count belongs in the spoken name and not in the tip, so the aria-label stays as it is.
    <Tip tip="Test Bench" labelsChild={false}>
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
    </Tip>
  );
}
