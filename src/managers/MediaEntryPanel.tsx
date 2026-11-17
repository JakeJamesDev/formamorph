import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import { MEDIA_KIND_LABELS, type MediaItem, type MediaParent } from '@/lib/mediaIndex';
import { mediaUseLabel } from '@/lib/mediaUsage';
import { labelPlaceholders } from '@/lib/placementLetters';
import type { Placeholder } from '@/types';
import { MediaActionRow } from './MediaActionRow';
import { MediaFacts, Preview } from './MediaPanels';
import { MediaNameField, useMediaEntryActions } from './MediaPicker';

/**
 * One Media List entry, as Group by Type selects it: its name, preview and size, Download and Delete From World,
 * and Used By, which goes to each place that links it. Visibility rules stay on each link (Q11).
 */
export function MediaEntryPanel({ item, placeholders, onGoTo }: {
  item: MediaItem;
  placeholders: readonly Placeholder[];
  onGoTo: (parent: MediaParent) => void;
}) {
  const { worldOverview } = useGameData();
  const { rename, askDelete, confirm } = useMediaEntryActions();
  const entry = item.mediaId ? worldOverview.mediaList?.[item.mediaId] : undefined;
  if (!entry) return null;
  const uses = item.uses ?? [];
  const label = (name: string) => labelPlaceholders(name, placeholders);
  return (
    <div className="space-y-4" data-media-panel={item.id}>
      {confirm}
      <div>
        <MediaNameField entry={entry} rename={rename} className="text-title font-semibold" />
        <MediaFacts item={item} className="mt-1">
          <span>{MEDIA_KIND_LABELS[item.kind].one}</span>
          <span aria-hidden>·</span>
          {item.unused && <Badge variant="outline" className="px-1.5 py-0 text-meta font-normal">Unused</Badge>}
        </MediaFacts>
      </div>
      <div className="flex justify-center rounded-md bg-muted/40 p-2"><Preview item={item} /></div>
      <div className="flex flex-wrap gap-2">
        <MediaActionRow className="contents" item={item} placeholders={placeholders} />
        <Button variant="outline" size="sm" onClick={() => askDelete(entry.id)}>
          <Trash2 className="mr-1 h-4 w-4" />Delete From World
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label>Used By</Label>
        {uses.length
          ? (
            <div className="flex flex-wrap gap-1.5" data-media-used-by="">
              {uses.map((use) => (
                <Button key={`${use.owner.kind}:${use.owner.id}:${use.field}:${use.index ?? ''}`} variant="secondary" size="sm" onClick={() => onGoTo(use.owner)}>
                  {mediaUseLabel(use, label)}
                </Button>
              ))}
            </div>
          )
          : <Hint>Nothing uses this {MEDIA_KIND_LABELS[item.kind].one.toLowerCase()}</Hint>}
      </div>
    </div>
  );
}
