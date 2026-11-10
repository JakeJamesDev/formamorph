import type { ReactElement } from 'react';
import { ChevronDown, ChevronUp, Flag, Megaphone } from 'lucide-react';
import { Panel } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import type { KeyEntryId } from '@/lib/canvasKey';
import type { RoutineSpan } from '@/lib/canvasRoutine';
import { ELEMENT_ICONS } from '@/lib/elementIcons';
import { boolCodec, usePersistentState } from '@/lib/usePersistentState';
import { cn } from '@/lib/utils';

const KEY_OPEN = 'FORMAMORPH_canvasKeyOpen';

const SWATCH: Record<RoutineSpan['tone'], string> = {
  stay: 'bg-routine-stay', wander: 'bg-routine-wander', patrol: 'bg-routine-patrol', free: 'bg-muted-foreground/60',
};

const Swatch = ({ className }: { className: string }) => <span aria-hidden className={cn('h-3 w-3 shrink-0 rounded-sm', className)} />;
const Box = ({ className }: { className: string }) => <span aria-hidden className={cn('h-3 w-4 shrink-0 rounded-sm border bg-card', className)} />;
const Chip = ({ text }: { text: string }) => (
  <span aria-hidden className="shrink-0 rounded px-1 text-meta font-medium ring-1 ring-muted-foreground">{text}</span>
);
const LocationIcon = ELEMENT_ICONS.location;

const ENTRIES: Record<KeyEntryId, { label: string; sample: ReactElement }> = {
  stay: { label: 'Stay', sample: <Swatch className={SWATCH.stay} /> },
  wander: { label: 'Wander', sample: <Swatch className={SWATCH.wander} /> },
  patrol: { label: 'Patrol', sample: <Swatch className={SWATCH.patrol} /> },
  free: { label: 'Free Time', sample: <Swatch className={SWATCH.free} /> },
  mixed: { label: 'Several Actions', sample: <Box className="ring-2 ring-muted-foreground" /> },
  dayBar: {
    label: 'Time of Day',
    sample: (
      <span aria-hidden className="relative h-1.5 w-6 shrink-0 overflow-hidden rounded-full bg-muted-foreground/20">
        <span className="absolute inset-y-0 left-1/4 w-1/3 bg-foreground/70" />
      </span>
    ),
  },
  start: { label: 'Starts Here', sample: <Flag aria-hidden className="h-3.5 w-3.5 shrink-0" /> },
  chance: { label: 'Chance', sample: <Chip text="%" /> },
  stop: { label: 'Stop Number', sample: <Chip text="1" /> },
  reach: { label: 'Can Also Go', sample: <Box className="outline-dashed outline-1 outline-offset-1 outline-muted-foreground" /> },
  here: { label: 'Is Here', sample: <Box className="ring-2 ring-muted-foreground" /> },
  entityLocation: { label: 'Entity Location', sample: <LocationIcon aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary" /> },
  knownIn: { label: 'Known In', sample: <Megaphone aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary" /> },
};

/** A small key at the foot of the canvas for the colors and marks the view on show uses. It folds to its title. */
export function CanvasKey({ entries }: { entries: readonly KeyEntryId[] }) {
  const [open, setOpen] = usePersistentState(KEY_OPEN, true, boolCodec);
  if (entries.length === 0) return null;
  const Chevron = open ? ChevronDown : ChevronUp;
  return (
    <Panel position="bottom-center" className="!m-2 max-w-[calc(100%-1rem)]">
      <section aria-label="Key" data-testid="canvas-key" className="rounded-md border bg-card text-meta text-card-foreground shadow-md">
        <Button
          variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}
          className="h-6 w-full justify-between gap-2 px-2 text-meta font-medium"
        >
          Key
          <Chevron className="h-3.5 w-3.5" aria-hidden />
        </Button>
        {open && (
          <ul className="flex max-w-md flex-wrap gap-x-3 gap-y-1 border-t px-2 py-1.5">
            {entries.map((id) => (
              <li key={id} data-key-entry={id} className="flex items-center gap-1.5">
                {ENTRIES[id].sample}
                <span>{ENTRIES[id].label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  );
}
