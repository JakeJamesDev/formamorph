/**
 * The AI Context instrument — the location inspector. Every block the harness serves from the lens location,
 * what each costs, the closed set of places a player can go from here, and which of its descriptions each
 * entity arrives with.
 *
 * Presentational: the assembled view-model arrives as a prop, so the panel renders the same inside the
 * desktop split and the mobile sheet. The only state it owns is which blocks the author has opened.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Compass, Route } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type {
  AiContextData, ContextBlock, DestinationRow, RosterGroup, RosterEntity,
} from '@/lib/testBench/aiContext';

/** Estimates are always `~`-prefixed: worlds run against arbitrary endpoints, so no count here is exact. */
const tokenLabel = (tokens: number) => `~${tokens.toLocaleString()}`;

const SectionHeading = ({ label, note }: { label: string; note?: string }) => (
  <div className="flex items-baseline gap-2 pt-1">
    <p className="text-meta font-medium">{label}</p>
    {note && <p className="min-w-0 truncate text-meta text-muted-foreground">{note}</p>}
  </div>
);

/** What one entity's description arrives as, in the scope it is listed under. */
const DELIVERY_LABEL: Record<RosterEntity['delivery'], string> = {
  full: 'Full',
  summary: 'Summary',
  none: 'Name Only',
};

/**
 * One block: what it costs on the face of the row, its text a click away. The chip that serves it is named
 * beside the label, since a block an author wants to move or drop is found by its token, not its heading.
 */
const BlockRow = ({ block, open, onToggle }: {
  block: ContextBlock;
  open: boolean;
  onToggle: () => void;
}) => (
  <div className={cn('rounded-md border p-1.5', block.empty && 'border-dashed')}>
    <button
      type="button"
      onClick={onToggle}
      disabled={block.empty}
      aria-expanded={open}
      className="flex w-full items-center gap-1.5 text-left disabled:cursor-default"
    >
      {block.empty
        ? <span className="h-3 w-3 shrink-0" aria-hidden />
        : open
          ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />}
      <span className={cn('min-w-0 flex-grow truncate text-label', block.empty && 'text-muted-foreground')}>
        {block.label}
      </span>
      <span className="shrink-0 text-meta text-muted-foreground">
        {block.empty ? 'nothing here' : `${tokenLabel(block.tokens)} tokens`}
      </span>
    </button>
    <p className="mt-0.5 truncate pl-[18px] text-meta text-muted-foreground">{block.token}</p>
    {block.note && <p className="pl-[18px] text-meta text-muted-foreground">{block.note}</p>}
    {open && !block.empty && (
      <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 text-meta leading-relaxed">
        {block.text}
      </pre>
    )}
  </div>
);

/** One place a player can move to, and what the model is told the trip involves. */
const DestinationLine = ({ destination }: { destination: DestinationRow }) => (
  <div className="flex items-baseline gap-1.5 rounded-md border p-1.5">
    <Route className="h-3 w-3 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden />
    <span className="min-w-0 flex-grow truncate text-label">{destination.name}</span>
    <span className="shrink-0 text-meta text-muted-foreground">
      {destination.hint ? `via ${destination.hint}` : destination.via === 'connection' ? 'connection' : 'nested'}
    </span>
  </div>
);

/** One scope's cast, each row saying which of its descriptions this scope's block carries. */
const RosterSection = ({ group }: { group: RosterGroup }) => (
  <div className="space-y-1">
    <p className="truncate text-meta text-muted-foreground">
      {group.label}
      {group.prefersSummary && ' · served as summaries'}
    </p>
    {group.entities.length === 0 ? (
      <p className="pl-2 text-meta text-muted-foreground">Nobody.</p>
    ) : (
      group.entities.map((entity) => (
        <div key={entity.id} className="flex items-center gap-1.5 rounded-md border p-1.5">
          <span className="min-w-0 flex-grow truncate text-label">{entity.name}</span>
          <span
            className={cn(
              'shrink-0 rounded px-1 text-meta',
              entity.delivery === 'none' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground',
            )}
          >
            {DELIVERY_LABEL[entity.delivery]}
          </span>
        </div>
      ))
    )}
  </div>
);

export interface AiContextInstrumentProps {
  data: AiContextData;
}

export function AiContextInstrument({ data }: AiContextInstrumentProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  if (!data.location) {
    return (
      <p className="text-meta text-muted-foreground">
        Pick a location in the lens above to see what the harness serves from it.
      </p>
    );
  }

  const served = data.blocks.filter((b) => !b.empty).length;
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 pr-2">
        <div className="rounded-md border bg-muted/30 p-2">
          <p className="text-label font-medium">A turn from here ≈ {tokenLabel(data.totalTokens)} tokens</p>
          <p className="text-meta text-muted-foreground">
            Every block a prompt can pull from {data.locationName}; any one prompt uses a subset of them.
          </p>
        </div>

        <SectionHeading label="Context Blocks" note={`${served} of ${data.blocks.length} have something to send`} />
        <div className="space-y-1">
          {data.blocks.map((block) => (
            <BlockRow key={block.id} block={block} open={open.has(block.id)} onToggle={() => toggle(block.id)} />
          ))}
        </div>

        <SectionHeading label="Destinations" note={`${data.destinations.length} offered`} />
        {data.destinations.length === 0 ? (
          <p className="text-meta text-muted-foreground">
            Nowhere. A player who walks in here can never leave — give this location a parent, a sub-location
            or a connection.
          </p>
        ) : (
          <div className="space-y-1">
            {data.destinations.map((destination) => (
              <DestinationLine key={destination.id} destination={destination} />
            ))}
          </div>
        )}
        <p className="flex items-start gap-1 text-meta leading-snug text-muted-foreground">
          <Compass className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          This is the whole set — anywhere not listed can never be traveled to from here. Whether a given
          action counts as travel is the model’s judgment.
        </p>

        <SectionHeading label="Entities the AI Is Told About" />
        <div className="space-y-2">
          {data.rosters.map((group) => <RosterSection key={group.scope} group={group} />)}
        </div>
      </div>
    </ScrollArea>
  );
}
