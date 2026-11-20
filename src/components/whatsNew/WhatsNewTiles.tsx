import type { ReleaseSummary } from '@/lib/whatsNew/releaseSummary';
import { tileCells, type TileCell, type TileSpan } from '@/lib/whatsNew/tileLayout';
import { cn } from '@/lib/utils';
import { majorIconComponent } from './majorIcons';

const SPAN: Record<TileSpan, string> = { 1: '', 2: 'sm:col-span-2', 3: 'sm:col-span-3' };

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]*\))/g;

/** Summary text with its inline code, bold and italic shown; a link shows its text only. */
function Inline({ text }: { text: string }) {
  return text.split(INLINE).map((part, i) => {
    if (i % 2 === 0) return part;
    if (part.startsWith('`')) return <code key={i} className="rounded bg-muted px-1">{part.slice(1, -1)}</code>;
    if (part.startsWith('**')) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith('[')) return part.slice(1, part.indexOf(']'));
    return <em key={i}>{part.slice(1, -1)}</em>;
  });
}

function Tile({ cell }: { cell: TileCell }) {
  if (cell.kind === 'major') {
    const Icon = majorIconComponent(cell.item.icon);
    return (
      <div
        data-tile="major"
        className={cn('flex gap-3 rounded-md border border-l-4 border-primary/30 border-l-dialogue bg-card p-3', SPAN[cell.span])}
      >
        <Icon data-icon={cell.item.icon ?? 'default'} aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-dialogue" />
        <div className="min-w-0">
          <h3 className="text-body font-semibold"><Inline text={cell.item.title} /></h3>
          <p className="mt-1 text-label text-muted-foreground"><Inline text={cell.item.body} /></p>
        </div>
      </div>
    );
  }
  if (cell.kind === 'fixes') {
    return (
      <div data-tile="fixes" className={cn('w-fit max-w-full self-start justify-self-start rounded-md bg-muted/40 px-3 py-2', SPAN[cell.span])}>
        {cell.paragraphs.map((p, i) => (
          <p key={i} className="text-meta text-muted-foreground">
            {i === 0 && <span className="font-semibold text-foreground">Fixes: </span>}
            <Inline text={p} />
          </p>
        ))}
      </div>
    );
  }
  return (
    <div data-tile="new" className="rounded-md border border-primary/30 bg-card p-3">
      <h3 className="text-label font-semibold"><Inline text={cell.item.title} /></h3>
      <p className="mt-1 text-meta text-muted-foreground"><Inline text={cell.item.body} /></p>
    </div>
  );
}

/** The highlights as paired tiles: three columns, one on narrow widths. */
export function WhatsNewTiles({ summary }: { summary: ReleaseSummary }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {tileCells(summary).map((cell, i) => <Tile key={i} cell={cell} />)}
    </div>
  );
}

/** The What's New tab: the lead paragraph, the tiles, then the rest of the intro. */
export function WhatsNewSummary({ summary }: { summary: ReleaseSummary }) {
  const [lead, ...rest] = summary.intro;
  return (
    <div className="space-y-4">
      {lead && <p className="text-body text-muted-foreground"><Inline text={lead} /></p>}
      <WhatsNewTiles summary={summary} />
      {rest.map((p, i) => <p key={i} className="text-meta text-muted-foreground"><Inline text={p} /></p>)}
    </div>
  );
}
