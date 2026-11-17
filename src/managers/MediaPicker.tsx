/**
 * The Media List's image slot pieces: Choose (a searchable thumbnail grid of the list), the filled slot's name
 * field with Remove and Delete From World, and the delete confirm that lists every use.
 */
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Images, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useGameData } from '@/contexts/GameDataContext';
import { labelPlaceholders } from '@/lib/placementLetters';
import { isMediaRef, mediaEntry, mediaNameFromFile, mediaNameKey, resolveMedia, urlFileName } from '@/lib/mediaList';
import { linkSingle } from '@/lib/mediaImages';
import { isRemoteImage } from '@/lib/imageBytes';
import { ImageUpload } from '@/lib/UtilityComponents';
import { mediaUsage, mediaUseLabel } from '@/lib/mediaUsage';
import { RemoteImg } from '@/lib/useRemoteImage';
import { cn } from '@/lib/utils';
import type { GalleryLink, MediaEntry, MediaList, MediaRef } from '@/types';
import { useMediaStep } from './useMediaItemActions';

/** The list's images, sorted by name. */
const imageEntries = (list: MediaList | undefined): MediaEntry[] =>
  Object.values(list ?? {}).filter((entry) => entry.kind === 'image' && entry.data)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));

/** Choose: a popover grid of the list's images. Entries in `linkedIds` are dimmed, and still pickable. */
export function MediaChooseButton({ list, linkedIds, onPick }: {
  list: MediaList | undefined;
  linkedIds: ReadonlySet<string>;
  onPick: (entry: MediaEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => { if (!open) setQuery(''); }, [open]);
  const entries = useMemo(() => imageEntries(list), [list]);
  const key = mediaNameKey(query);
  const shown = key ? entries.filter((entry) => mediaNameKey(entry.name).includes(key)) : entries;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline"><Images className="mr-2 h-4 w-4" />Choose</Button>
      </PopoverTrigger>
      {/* Inline, not portaled: the slot sits in the entity editor's dialog, whose scroll lock eats a portal's wheel. */}
      <PopoverContent portal={false} className="w-[360px] space-y-2 p-3" data-media-choose="">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Images"
            aria-label="Search Images"
            className="pl-8"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-80">
          <div className="grid grid-cols-3 gap-2 pr-2">
            {shown.map((entry) => {
              const here = linkedIds.has(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => { onPick(entry); setOpen(false); }}
                  aria-label={here ? `${entry.name}, already used here` : entry.name}
                  data-media-entry={entry.id}
                  className={cn('space-y-1 rounded-md p-1 text-left hover:bg-muted', here && 'opacity-50')}
                >
                  <RemoteImg src={entry.data} alt="" loading="lazy" className="aspect-[3/4] w-full rounded bg-muted object-cover" />
                  <span className="line-clamp-2 break-words text-meta">{entry.name}</span>
                </button>
              );
            })}
            {!shown.length && (
              <Meta className="col-span-full py-4 text-center">
                {entries.length ? 'No images match' : 'No images yet'}
              </Meta>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/** The confirm Delete From World raises, naming every place that loses the entry. */
export function DeleteMediaConfirm({ open, name, uses, onConfirm, onOpenChange }: {
  open: boolean;
  name: string;
  /** Each use as copy names it. */
  uses: string[];
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${name || 'Unnamed'} From the World?`}
      description={uses.length ? (
        <>
          <span className="block">This takes it out of:</span>
          <ul className="mt-1 list-disc pl-5" data-media-uses="">
            {uses.map((use) => <li key={use}>{use}</li>)}
          </ul>
        </>
      ) : 'Nothing uses this image.'}
      confirmLabel="Delete"
      destructive
      surface="deleteMediaEntry"
      onConfirm={onConfirm}
    />
  );
}

/** Rename, Delete From World and the confirm for one entry, each one History Step. */
export function useMediaEntryActions() {
  const { worldOverview, entities, locations, items, bodies, dictionaries, placeholders, renameMedia, removeMedia } = useGameData();
  const step = useMediaStep();
  const [deleting, setDeleting] = useState<string | null>(null);
  const list = worldOverview.mediaList;
  const rename = (id: string, name: string) => {
    if (!list?.[id] || !name.trim() || name.trim() === list[id].name) return;
    void step(`Rename Image: ${name.trim()}`, () => renameMedia({ mediaId: id, name }));
  };
  const uses = deleting
    ? (mediaUsage({ worldOverview, entities, locations, items, bodies, dictionaries }).get(deleting) ?? [])
      .map((use) => mediaUseLabel(use, (name) => labelPlaceholders(name, placeholders)))
    : [];
  const confirm = (
    <DeleteMediaConfirm
      open={!!deleting}
      name={(deleting && list?.[deleting]?.name) || ''}
      uses={uses}
      onConfirm={() => {
        const id = deleting;
        setDeleting(null);
        if (id) void step(`Delete Image: ${list?.[id]?.name ?? ''}`, () => removeMedia(id));
      }}
      onOpenChange={(open) => { if (!open) setDeleting(null); }}
    />
  );
  return { rename, askDelete: setDeleting, confirm };
}

/** Under a filled slot: the entry's name, which renames it on blur or Enter, then Remove (an unlink) and Delete From World. */
export function MediaEntryBar({ entry, onUnlink }: { entry: MediaEntry; onUnlink: () => void }) {
  const { rename, askDelete, confirm } = useMediaEntryActions();
  const [draft, setDraft] = useState(entry.name);
  useEffect(() => { setDraft(entry.name); }, [entry.name]);
  const commit = () => {
    // A blank name reverts; a taken one comes back suffixed from the list.
    rename(entry.id, draft);
    setDraft(entry.name);
  };
  return (
    <div className="flex items-center gap-1" data-media-entry-bar={entry.id}>
      {confirm}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === 'Escape') setDraft(entry.name);
        }}
        aria-label="Image Name"
        className="h-8 flex-1"
      />
      <Tip tip="Removes the image here and keeps it in the world">
        <Button type="button" variant="ghost" size="icon" aria-label="Remove From Slot" onClick={onUnlink}>
          <X className="h-4 w-4" />
        </Button>
      </Tip>
      <Tip tip="Delete From World">
        <Button type="button" variant="ghost" size="icon" aria-label="Delete From World" onClick={() => askDelete(entry.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </Tip>
    </div>
  );
}

/** A stored single-image value: embedded data or a link to an entry. */
type SingleImage = GalleryLink | MediaRef | string | null | undefined;

/**
 * Places one picture for a single-image field: `write` gets the link to store, then the new entries join the
 * list. A pasted link is named by its last path segment (Q36).
 */
export function useSinglePlacement(subject: string | undefined) {
  const { worldOverview, addMedia } = useGameData();
  const list = worldOverview.mediaList;
  return useCallback((data: string, fileName: string | undefined, write: (link: GalleryLink, data: string) => void) => {
    const name = mediaNameFromFile(fileName) || (isRemoteImage(data) ? mediaNameFromFile(urlFileName(data)) : '');
    const placed = linkSingle(list, { data, ...(name ? { name } : {}) }, subject);
    write(placed.link, data);
    if (Object.keys(placed.added).length) addMedia(placed.added);
  }, [list, addMedia, subject]);
}

/**
 * The picker slot for a field that holds one picture (the world cover, a Body's Custom Image): Import and
 * Choose when empty, the entry's name with Remove From Slot and Delete From World when filled. `onChange`
 * gets the link to store and its picture's data (the entry may not be in the list yet), or null once the slot is freed.
 */
export function LinkedImageUpload({ value, onChange, subject, ...upload }: {
  value: SingleImage;
  onChange: (link: GalleryLink | null, data?: string) => void;
  subject: string | undefined;
} & Omit<ComponentProps<typeof ImageUpload>, 'value' | 'onChange' | 'choose'>) {
  const { worldOverview } = useGameData();
  const list = worldOverview.mediaList;
  const place = useSinglePlacement(subject);
  const data = resolveMedia(value && typeof value === 'object' && 'data' in value ? value.data : value, list, 'image')?.data ?? '';
  const entry = isMediaRef(value) ? mediaEntry(list, value.mediaId, 'image') : undefined;
  const linkedIds = new Set(entry ? [entry.id] : []);
  return (
    <div className="space-y-1">
      <ImageUpload
        {...upload}
        value={data}
        onChange={(next, fileName) => (next ? place(next, fileName, onChange) : onChange(null))}
        choose={list && (!data || entry) && (
          <MediaChooseButton list={list} linkedIds={linkedIds} onPick={(picked) => onChange({ mediaId: picked.id }, picked.data)} />
        )}
      />
      {entry && <MediaEntryBar entry={entry} onUnlink={() => onChange(null)} />}
    </div>
  );
}
