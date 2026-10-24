import { useId, useState, type ReactNode } from 'react';
import { ArrowDownWideNarrow, Check, ImageDown, Layers, ListFilter, Loader2 } from 'lucide-react';
import { OPTIMIZE_IMAGES_TIP } from '@/components/editor/appBarCopy';
import { HintInfo } from '@/components/SettingsRows';
import { BAND_FILL, PUBLISH_SIZE_INFO } from '@/components/editor/IssuesInstrument';
import { MENU_ROW } from '@/components/menuRow';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { MEDIA_FILTERS, type MediaFilter, type MediaGrouping } from '@/lib/mediaIndex';
import { formatPublishBytes, PUBLISH_LIMITS, publishSizeBand } from '@/lib/publishLimits';
import { cn } from '@/lib/utils';

/** The world's worker-measured publish size against the limit, thin enough for the header row. */
export function MediaPublishMeter({ bytes }: { bytes: number | null }) {
  const labelId = useId();
  const limit = PUBLISH_LIMITS.world;
  const { band, ratio } = publishSizeBand(bytes ?? 0, limit);
  const readout = bytes === null ? 'Measuring…' : `${formatPublishBytes(bytes)} / ${formatPublishBytes(limit)}`;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1">
        <span id={labelId} className="truncate text-meta font-medium max-[480px]:sr-only">Publish Size</span>
        <HintInfo>{PUBLISH_SIZE_INFO}</HintInfo>
        <Meta className="ml-auto shrink-0 tabular-nums">{readout}</Meta>
      </div>
      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(bytes ?? 0, limit)}
        aria-valuetext={readout}
        data-band={bytes === null ? undefined : band}
        className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary"
      >
        {bytes !== null && <div className={cn('h-full rounded-full', BAND_FILL[band])} style={{ width: `${ratio * 100}%` }} />}
      </div>
    </div>
  );
}

function IconToggle({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tip tip={label}>
      <Button
        type="button"
        variant={pressed ? 'secondary' : 'ghost'}
        size="icon"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className="h-9 w-9 shrink-0"
      >
        {children}
      </Button>
    </Tip>
  );
}

/** The filter popover's button: it names the active filter in place of its tooltip. */
function FilterMenu({ filter, onChange }: { filter: MediaFilter; onChange: (filter: MediaFilter) => void }) {
  const [open, setOpen] = useState(false);
  const active = filter !== 'all';
  const activeLabel = MEDIA_FILTERS.find((f) => f.value === filter)?.label;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={active ? 'secondary' : 'ghost'}
          size="icon"
          aria-label={active ? `Filter: ${activeLabel}` : 'Filter'}
          className={cn('h-9 shrink-0', active ? 'w-auto max-w-[8.5rem] gap-1 px-2' : 'w-9')}
        >
          <ListFilter className="h-4 w-4 shrink-0" />
          {active && <span className="truncate text-meta">{activeLabel}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        {MEDIA_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={MENU_ROW}
            aria-pressed={filter === f.value}
            onClick={() => { onChange(f.value); setOpen(false); }}
          >
            <Check className={cn('h-4 w-4 shrink-0', filter !== f.value && 'invisible')} />
            {f.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Null = idle; 'scanning' = measuring before the choice dialog; then the live per-image encode progress. */
export interface OptimizeControl {
  progress: { done: number; total: number } | 'scanning' | null;
  onRun: () => void;
}

/** Optimize Images: a spinner on the icon and the count in the tooltip while it runs. */
function OptimizeButton({ progress, onRun }: OptimizeControl) {
  const running = progress !== null;
  const tip = progress === null ? OPTIMIZE_IMAGES_TIP
    : progress === 'scanning' ? 'Scanning…' : `Optimizing ${progress.done}/${progress.total}…`;
  // aria-disabled keeps pointer events, so the tooltip shows the progress.
  return (
    <Tip tip={tip}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 aria-disabled:opacity-50"
        aria-label="Optimize Images"
        aria-disabled={running}
        aria-busy={running}
        onClick={() => { if (!running) onRun(); }}
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
      </Button>
    </Tip>
  );
}

/** The Media tab's header row: the Publish Size meter, then grouping, Largest First, the filter and Optimize Images. */
export function MediaHeader({ publishBytes, grouping, onGroupingChange, largestFirst, onLargestFirstChange, filter, onFilterChange, optimize }: {
  publishBytes: number | null;
  grouping: MediaGrouping;
  onGroupingChange: (grouping: MediaGrouping) => void;
  largestFirst: boolean;
  onLargestFirstChange: (largestFirst: boolean) => void;
  filter: MediaFilter;
  onFilterChange: (filter: MediaFilter) => void;
  optimize: OptimizeControl;
}) {
  const byType = grouping === 'type';
  return (
    <div className="flex flex-shrink-0 items-center gap-1" data-media-header>
      <MediaPublishMeter bytes={publishBytes} />
      <IconToggle
        label="Group by Type"
        pressed={byType}
        onClick={() => onGroupingChange(byType ? 'parent' : 'type')}
      >
        <Layers className="h-4 w-4" />
      </IconToggle>
      <IconToggle label="Largest First" pressed={largestFirst} onClick={() => onLargestFirstChange(!largestFirst)}>
        <ArrowDownWideNarrow className="h-4 w-4" />
      </IconToggle>
      <FilterMenu filter={filter} onChange={onFilterChange} />
      <OptimizeButton {...optimize} />
    </div>
  );
}
