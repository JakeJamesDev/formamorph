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
import { Meta } from '@/components/ui/typography';
import type {
  AiContextData, ContextBlock, DestinationRow, RosterGroup, RosterEntity,
} from '@/lib/testBench/aiContext';

/** Estimates are always `~`-prefixed: worlds run against arbitrary endpoints, so no count here is exact. */
const tokenLabel = (tokens: number) => `~${tokens.toLocaleString()}`;

const SectionHeading = ({ label, note }: { label: string; note?: string }) => (
  <div className="flex items-baseline gap-2 pt-1">
    <p className="text-meta font-medium">{label}</p>
    {note && <Meta as="p" className="min-w-0 truncate">{note}</Meta>}
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
      <Meta className="shrink-0">
        {block.empty ? 'empty' : `${tokenLabel(block.tokens)} tokens`}
      </Meta>
    </button>
    <Meta as="p" className="mt-0.5 truncate pl-[18px]">{block.token}</Meta>
    {block.note && <Meta as="p" className="pl-[18px]">{block.note}</Meta>}
    {open && !block.empty && (
      <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 text-meta leading-relaxed">
        {block.text}
      </pre>
    )}
  </div>
);

/** One place a player can move to, and what the model is told the trip involves. */
const DestinationLine = ({ destination }: { destination: DestinationRow }) => {
  const tail = destination.route ? destination.route.join(', then ') : destination.hint;
  return (
    <div className="flex items-baseline gap-1.5 rounded-md border p-1.5">
      <Route className="h-3 w-3 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-grow truncate text-label">{destination.name}</span>
      <Meta className="shrink-0">
        {tail ? `via ${tail}` : destination.via === 'connection' ? 'connection' : 'nested'}
      </Meta>
    </div>
  );
};

/** One scope's cast, each row saying which of its descriptions this scope's block carries. */
const RosterSection = ({ group }: { group: RosterGroup }) => (
  <div className="space-y-1">
    <Meta as="p" className="truncate">
      {group.label}
      {group.prefersSummary && ' · sent as summaries'}
    </Meta>
    {group.entities.length === 0 ? (
      <Meta as="p" className="pl-2">No entities</Meta>
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
      <Meta as="p">Pick a location in the “at” list above to see what the AI gets from it</Meta>
    );
  }

  const served = data.blocks.filter((b) => !b.empty).length;
  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 pr-2">
        <div className="rounded-md border bg-muted/30 p-2">
          <p className="text-label font-medium">A turn from here ≈ {tokenLabel(data.totalTokens)} tokens</p>
          <Meta as="p">
            Every block a prompt can use at {data.locationName}. Each prompt uses only some of them.
          </Meta>
        </div>

        <SectionHeading label="Context Blocks" note={`${served} of ${data.blocks.length} have text`} />
        <div className="space-y-1">
          {data.blocks.map((block) => (
            <BlockRow key={block.id} block={block} open={open.has(block.id)} onToggle={() => toggle(block.id)} />
          ))}
        </div>

        <SectionHeading label="Destinations" note={`${data.destinations.length} offered`} />
        {data.destinations.length === 0 ? (
          <Meta as="p">
            No destinations, so a player here can never leave. Give this location a parent location, a
            sub-location or a connection.
          </Meta>
        ) : (
          <div className="space-y-1">
            {data.destinations.map((destination) => (
              <DestinationLine key={destination.id} destination={destination} />
            ))}
          </div>
        )}
        <Meta as="p" className="flex items-start gap-1 leading-snug">
          <Compass className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          A location not listed here can’t be reached from this one in one turn. The AI decides whether an action
          counts as travel.
        </Meta>

        <SectionHeading label="Entities the AI Is Told About" />
        <div className="space-y-2">
          {data.rosters.map((group) => <RosterSection key={group.scope} group={group} />)}
        </div>
      </div>
    </ScrollArea>
  );
}
// scroll-guard: allow migration-candidate: the preview block has a max height only; a definite height is not confirmed
