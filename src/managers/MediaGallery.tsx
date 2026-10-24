import { Box, FileAudio, Image as ImageIcon, Link2, UserSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Meta } from '@/components/ui/typography';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { RemoteImg } from '@/lib/useRemoteImage';
import { formatMediaBytes, namedBySlot, sectionCards, sectionSelection, sectionTitle, totalBytes, type MediaItem, type MediaKind, type MediaSection } from '@/lib/mediaIndex';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';

const KIND_ICON: Record<MediaKind, typeof ImageIcon> = { image: ImageIcon, sound: FileAudio, model: Box, avatar: UserSquare };

/** An image's own pixels, loaded lazily; every other kind shows its icon. */
export function MediaThumb({ item, className }: { item: MediaItem; className?: string }) {
  if (item.kind === 'image' && !item.blank) {
    return <RemoteImg src={item.value} loading="lazy" decoding="async" alt="" className={cn('bg-muted object-cover', className)} />;
  }
  const Icon = KIND_ICON[item.kind];
  return <span className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}><Icon className="h-1/3 w-1/3" /></span>;
}

/** The stored size, in the warning color over budget, or the Linked badge for a linked image. */
export function MediaSize({ item }: { item: MediaItem }) {
  if (item.linked) {
    return <Badge variant="outline" className="gap-1 px-1.5 py-0 text-meta font-normal"><Link2 className="h-3 w-3" />Linked</Badge>;
  }
  return <span className={cn('tabular-nums', item.overBudget && 'text-warning')}>{formatMediaBytes(item.bytes)}</span>;
}

/** The parent's name as a card or row names an item; world media goes by its slot. */
export function MediaName({ item, placeholders }: { item: MediaItem; placeholders: readonly Placeholder[] }) {
  if (namedBySlot(item)) return <>{item.slot}</>;
  return <PlaceholderText text={item.parent.name} placeholders={placeholders} />;
}

const rulesLabel = (count: number) => `${count} ${count === 1 ? 'rule' : 'rules'}`;

/** One card. A stack shows its primary image, a count, two offset sheets behind it, and its images' total, in
 *  the warning color when any of them is over budget. Its rules badge counts every image's rules. */
function MediaCard({ item, images, selected, onSelect, placeholders }: {
  item: MediaItem;
  /** The parent's images when they stack. */
  images?: MediaItem[];
  selected: boolean;
  onSelect: () => void;
  placeholders: readonly Placeholder[];
}) {
  const stacked = !!images && images.length > 1;
  const members = stacked ? images : [item];
  const rules = members.reduce((n, i) => n + (i.rules?.length ?? 0), 0);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-media-card={stacked ? 'stack' : item.blank ? 'blank' : item.kind}
      className={cn(
        'relative min-w-0 rounded-md border bg-card text-left',
        stacked && 'mr-2 mt-2 shadow-[4px_-4px_0_-1px_hsl(var(--card)),4px_-4px_0_0_hsl(var(--muted-foreground)/0.6),8px_-8px_0_-1px_hsl(var(--card)),8px_-8px_0_0_hsl(var(--muted-foreground)/0.35)]',
        selected ? 'ring-2 ring-primary' : 'hover:border-foreground/40',
      )}
    >
      <span className="block overflow-hidden rounded-t-md"><MediaThumb item={item} className="aspect-square w-full" /></span>
      {rules > 0 && (
        <Badge variant="secondary" className="absolute left-1 top-1 px-1.5 py-0 text-meta font-normal">{rulesLabel(rules)}</Badge>
      )}
      {stacked && <Badge className="absolute right-1 top-1 px-1.5 py-0 text-meta" aria-label={`${images.length} images`}>{images.length}</Badge>}
      <span className="flex items-center justify-between gap-1 rounded-b-md px-1.5 py-1 text-meta">
        <span className="truncate"><MediaName item={item} placeholders={placeholders} /></span>
        {item.blank
          ? null
          : stacked
          ? <span className={cn('shrink-0 tabular-nums', images.some((i) => i.overBudget) && 'text-warning')}>{formatMediaBytes(totalBytes(images))}</span> : <span className="shrink-0"><MediaSize item={item} /></span>}
      </span>
    </button>
  );
}

/** The Media tab's list: one section per folder, each with its path and total, over a grid of cards. */
export function MediaGallery({ sections, selectedId, onSelect, placeholders }: {
  sections: MediaSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeholders: readonly Placeholder[];
}) {
  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const headerId = sectionSelection(section.id);
        return (
          <section key={section.id} className="space-y-1.5" aria-label={sectionTitle(section)}>
            <button
              type="button"
              onClick={() => onSelect(headerId)}
              aria-pressed={selectedId === headerId}
              className={cn('flex w-full items-baseline gap-2 rounded px-1 text-left hover:bg-muted/50', selectedId === headerId && 'bg-accent')}
            >
              <span className="truncate text-label font-medium">{sectionTitle(section)}</span>
              <Meta className="ml-auto shrink-0 tabular-nums">{formatMediaBytes(totalBytes(section.items))}</Meta>
            </button>
            {!section.items.length && <Meta className="px-1">No Avatars yet</Meta>}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] items-start gap-2 pt-1.5">
              {sectionCards(section.items).map(({ item, images }) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  images={images}
                  selected={selectedId !== null && (images ?? [item]).some((i) => i.id === selectedId)}
                  onSelect={() => onSelect(item.id)}
                  placeholders={placeholders}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
