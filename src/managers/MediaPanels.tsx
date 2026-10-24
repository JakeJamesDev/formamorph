import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint, Meta } from '@/components/ui/typography';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import AudioPlayer from '@/components/game/AudioPlayer';
import ModelViewer from '@/views/ModelViewer';
import VRMViewer from '@/views/VRMViewer';
import { resolveModelType } from '@/lib/UtilityComponents';
import { RemoteImg } from '@/lib/useRemoteImage';
import { useHeldModelBlob } from '@/lib/useHeldModelBlob';
import {
  MEDIA_KIND_LABELS, formatMediaBytes, kindBreakdown, largestItems, namedBySlot, totalBytes,
  type MediaItem, type MediaParent,
} from '@/lib/mediaIndex';
import type { MediaAsset, Placeholder } from '@/types';
import { MediaName, MediaSize, MediaThumb } from './MediaGallery';
import { MediaActionRow } from './MediaActionRow';
import { actsInItemPanel, useMediaItemActions } from './useMediaItemActions';

/** How many items a summary lists as the largest. */
const LARGEST_COUNT = 5;

/** The jump to the place that holds an item: its entity, location or dictionary, or the Overview for world media. */
function GoToButton({ parent, placeholders, onGoTo }: {
  parent: MediaParent;
  placeholders: readonly Placeholder[];
  onGoTo: (parent: MediaParent) => void;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={() => onGoTo(parent)}>
      {parent.kind === 'world' ? 'Go to Overview' : <>Go to{' '}<PlaceholderText text={parent.name} placeholders={placeholders} /></>}
    </Button>
  );
}

/** An Avatar in the viewer. The bytes are held only while the panel shows it. */
function AvatarPreview({ value }: { value: string }) {
  const load = useMemo(() => async () => ({ blob: await (await fetch(value)).blob() }), [value]);
  const { url, failed } = useHeldModelBlob(load);
  if (failed) return <Hint className="m-auto">This Avatar couldn&apos;t be loaded</Hint>;
  return url ? <VRMViewer key={url} modelUrl={url} /> : <Hint className="m-auto">Loading Avatar…</Hint>;
}

function Preview({ item }: { item: MediaItem }) {
  switch (item.kind) {
    case 'image':
      return <RemoteImg src={item.value} alt="" className="mx-auto max-h-[50vh] max-w-full rounded object-contain" />;
    case 'sound':
      return <AudioPlayer src={item.value} className="w-full" />;
    case 'model': {
      const model = { data: item.value, name: item.fileName };
      return <div className="h-72 w-full"><ModelViewer model={model} modelType={resolveModelType(model)} className="h-full w-full" /></div>;
    }
    case 'avatar':
      return <div className="flex h-72 w-full"><AvatarPreview value={item.value} /></div>;
  }
}

/** One item: a large preview by kind, its size and budget, its actions, and Go to the place that holds it. */
export function MediaItemPanel({ item, placeholders, onGoTo }: {
  item: MediaItem;
  placeholders: readonly Placeholder[];
  onGoTo: (parent: MediaParent) => void;
}) {
  const titled = !namedBySlot(item);
  const { replace, remove } = useMediaItemActions();
  return (
    <div className="space-y-4" data-media-panel={item.id}>
      <div>
        <h2 className="flex min-w-0 items-center gap-1 text-title font-semibold">
          {titled && (
            <>
              <span className="truncate text-muted-foreground"><PlaceholderText text={item.parent.name} placeholders={placeholders} /></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </>
          )}
          <span className="truncate">{item.slot}</span>
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-meta text-muted-foreground">
          <span>{MEDIA_KIND_LABELS[item.kind].one}</span>
          <span aria-hidden>·</span>
          <MediaSize item={item} />
          {item.budget && !item.linked && <span>· Budget {formatMediaBytes(item.budget.maxBytes)}</span>}
          {item.overBudget && <Badge variant="outline" className="border-warning text-warning">Over Budget</Badge>}
        </div>
      </div>
      <div className="flex justify-center rounded-md bg-muted/40 p-2"><Preview item={item} /></div>
      <div className="flex flex-wrap gap-2">
        <MediaActionRow
          className="contents"
          item={item}
          placeholders={placeholders}
          {...(actsInItemPanel(item) ? { onReplace: (media: MediaAsset) => void replace(item, media), onRemove: () => void remove(item) } : {})}
        />
        <GoToButton parent={item.parent} placeholders={placeholders} onGoTo={onGoTo} />
      </div>
      {item.kind === 'avatar' && (
        <div className="space-y-1.5">
          <Label>Used By</Label>
          {item.users?.length
            ? (
              <div className="flex flex-wrap gap-1.5">
                {item.users.map((user) => (
                  <Button key={user.id} variant="secondary" size="sm" onClick={() => onGoTo(user)}>
                    <PlaceholderText text={user.name} placeholders={placeholders} />
                  </Button>
                ))}
              </div>
            )
            : <Hint>No entity uses this Avatar</Hint>}
        </div>
      )}
    </div>
  );
}

/** A section's or the world's summary: counts and sizes by kind, then the largest items. */
export function MediaSummaryPanel({ title, items, placeholders, onSelect }: {
  title: string;
  items: MediaItem[];
  placeholders: readonly Placeholder[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-title font-semibold">{title}</h2>
        <Meta className="tabular-nums">{items.length} {items.length === 1 ? 'item' : 'items'} · {formatMediaBytes(totalBytes(items))}</Meta>
      </div>
      <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1 text-label">
        {kindBreakdown(items).map((row) => (
          <div key={row.kind} className="contents">
            <span>{MEDIA_KIND_LABELS[row.kind][row.count === 1 ? 'one' : 'many']}</span>
            <span className="tabular-nums text-muted-foreground">{row.count}</span>
            <span className="text-right tabular-nums">{formatMediaBytes(row.bytes)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label>Largest</Label>
        <ol className="space-y-1">
          {largestItems(items, LARGEST_COUNT).map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item.id)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-muted/50">
                <MediaThumb item={item} className="h-7 w-7 shrink-0 rounded-sm" />
                <span className="min-w-0 truncate">
                  <MediaName item={item} placeholders={placeholders} />
                  {!namedBySlot(item) && <span className="text-muted-foreground"> › {item.slot}</span>}
                </span>
                <span className="ml-auto shrink-0 text-meta text-muted-foreground"><MediaSize item={item} /></span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
