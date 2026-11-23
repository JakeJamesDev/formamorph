/**
 * The Media List's slot pieces: Choose (a searchable thumbnail grid of the list's images, or a name list of its
 * sounds), the filled slot's name field with Remove and Delete From World, and the delete confirm that lists
 * every use.
 */
import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Contrast, Images, Layers, Music, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchField } from '@/components/ui/search-field';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useGameData } from '@/contexts/GameDataContext';
import { labelPlaceholders } from '@/lib/placementLetters';
import { MEDIA_KIND_WORDS, isMediaRef, mediaEntry, mediaNameFromFile, mediaNameKey, resolveMedia, urlFileName } from '@/lib/mediaList';
import { linkSingle } from '@/lib/mediaImages';
import { renameMediaEntry } from '@/lib/mediaUnlink';
import { useCodeRenameOffer } from '@/lib/useCodeRename';
import { isRemoteImage } from '@/lib/imageBytes';
import { ImageUpload } from '@/lib/UtilityComponents';
import { mediaUsage, mediaUseLabel, unsharedParts, variantUsage, variantUseLabel } from '@/lib/mediaUsage';
import { RemoteImg } from '@/lib/useRemoteImage';
import { cn } from '@/lib/utils';
import type { GalleryLink, LayeredMediaEntry, MediaEntry, MediaFileEntry, MediaList, MediaRef } from '@/types';
import { PictureImg } from '@/components/PictureImg';
import { layeredCanvas, outsidePlayLayered } from '@/lib/layeredImages';
import { fileEntries, type MediaEntryKind, type MediaFileKind } from '@/lib/mediaList';
import { useMediaStep } from './useMediaItemActions';


/** The list's entries of `kind`, sorted by name. */
const entriesOf = (list: MediaList | undefined, kind: MediaFileKind): MediaFileEntry[] =>
  fileEntries(list).filter((entry) => entry.kind === kind && entry.data)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));

/** The entries Choose lists: those of `kind`, plus the drawable Layered Images when `layered`, sorted by name. */
const choosable = (list: MediaList | undefined, kind: MediaFileKind, layered: boolean): (MediaFileEntry | LayeredMediaEntry)[] => {
  const files: (MediaFileEntry | LayeredMediaEntry)[] = entriesOf(list, kind);
  if (!layered) return files;
  const rigs = Object.values(list ?? {}).filter((entry): entry is LayeredMediaEntry => entry.kind === 'layered' && !!layeredCanvas(entry, list));
  return [...files, ...rigs].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
};

/** A Layered Image's Choose tile: its outside-play picture, marked with the Layers icon. */
function LayeredChoice({ entry, list }: { entry: LayeredMediaEntry; list: MediaList | undefined }) {
  const picture = outsidePlayLayered(entry, list);
  return (
    <span className="relative block">
      {picture
        ? <PictureImg src={picture} crop alt="" className="block aspect-[3/4] w-full rounded bg-muted" />
        : <span className="block aspect-[3/4] w-full rounded bg-muted" />}
      <span className="absolute left-1 top-1 rounded bg-background/80 p-0.5" aria-hidden><Layers className="h-3 w-3" /></span>
    </span>
  );
}

/** The icon each kind's Choose shows. */
const CHOOSE_ICON = { image: Images, sound: Music, mask: Contrast } as const;

/** Choose: a popover of the list's entries of `kind`, a thumbnail grid for images and Masks and a name list for
 *  sounds. Entries in `linkedIds` are dimmed, and still pickable. */
export function MediaChooseButton({ list, linkedIds, onPick, onPickLayered, kind = 'image', disabled, anchor, open: openProp, onOpenChange }: {
  list: MediaList | undefined;
  linkedIds: ReadonlySet<string>;
  onPick: (entry: MediaFileEntry) => void;
  /** Set, the images' grid also lists the Layered Images that can draw, each as its composed picture. */
  onPickLayered?: (entry: LayeredMediaEntry) => void;
  kind?: MediaFileKind;
  disabled?: boolean;
  /** Drawn in place of the Choose button, for a host that opens the grid itself through `open`. */
  anchor?: ReactNode;
  /** Set, the host owns whether the grid is open. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = (next: boolean) => { setOwnOpen(next); onOpenChange?.(next); };
  const [query, setQuery] = useState('');
  useEffect(() => { if (!open) setQuery(''); }, [open]);
  const withLayered = kind === 'image' && !!onPickLayered;
  const entries = useMemo(() => choosable(list, kind, withLayered), [list, kind, withLayered]);
  const words = MEDIA_KIND_WORDS[kind];
  const Icon = CHOOSE_ICON[kind];
  const pictures = kind !== 'sound';
  const key = mediaNameKey(query);
  const shown = key ? entries.filter((entry) => mediaNameKey(entry.name).includes(key)) : entries;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {anchor
        ? <PopoverAnchor asChild>{anchor}</PopoverAnchor>
        : (
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" disabled={disabled}>
              <Icon className="mr-2 h-4 w-4" />Choose
            </Button>
          </PopoverTrigger>
        )}
      {/* Inline, not portaled: the slot sits in the entity editor's dialog, whose scroll lock eats a portal's wheel. */}
      <PopoverContent portal={false} className="w-[360px] space-y-2 p-3" data-media-choose="">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={`Search ${words.many}`}
          aria-label={`Search ${words.many}`}
          autoFocus
        />
        <ScrollArea className="max-h-80">
          <div className={cn('grid gap-2 pr-2', pictures ? 'grid-cols-3' : 'grid-cols-1')}>
            {shown.map((entry) => {
              const here = linkedIds.has(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    if (entry.kind === 'layered') { if (onPickLayered) onPickLayered(entry); } else onPick(entry);
                    setOpen(false);
                  }}
                  aria-label={here ? `${entry.name}, already used here` : entry.name}
                  data-media-entry={entry.id}
                  className={cn(
                    'rounded-md p-1 text-left hover:bg-muted',
                    pictures ? 'space-y-1' : 'flex items-center gap-2',
                    here && 'opacity-50',
                  )}
                >
                  {entry.kind === 'layered'
                    ? <LayeredChoice entry={entry} list={list} />
                    : pictures
                    ? <RemoteImg src={entry.data} alt="" loading="lazy" className={cn('w-full rounded bg-muted object-cover', kind === 'mask' ? 'aspect-video' : 'aspect-[3/4]')} />
                    : <Music className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <span className="line-clamp-2 break-words text-meta">{entry.name}</span>
                </button>
              );
            })}
            {!shown.length && (
              <Meta className="col-span-full py-4 text-center">
                {entries.length ? 'No matches' : `No ${words.many.toLowerCase()} yet`}
              </Meta>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/** The confirm Delete From World raises, naming every place that loses the entry. */
export function DeleteMediaConfirm({ open, name, kind = 'image', uses, parts = [], onConfirm, onOpenChange }: {
  open: boolean;
  name: string;
  kind?: MediaEntryKind;
  /** Each use as copy names it. */
  uses: string[];
  /** The names of the images the delete takes with it. */
  parts?: string[];
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const usesBlock = uses.length ? (
    <>
      <span className="block">This takes it out of:</span>
      <ul className="mt-1 list-disc pl-5" data-media-uses="">
        {uses.map((use) => <li key={use}>{use}</li>)}
      </ul>
    </>
  ) : <span className="block">Nothing uses this {MEDIA_KIND_WORDS[kind].one.toLowerCase()}.</span>;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${name || 'Unnamed'} From World?`}
      description={parts.length ? (
        <>
          {usesBlock}
          <span className="mt-2 block">It also deletes these images, which only it uses:</span>
          <ul className="mt-1 list-disc pl-5" data-media-parts="">
            {parts.map((part, i) => <li key={`${i}-${part}`}>{part}</li>)}
          </ul>
        </>
      ) : usesBlock}
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
  const offerCodeRename = useCodeRenameOffer();
  const rename = (id: string, name: string) => {
    if (!list?.[id] || !name.trim() || name.trim() === list[id].name) return;
    // The name the list keeps, made unique, is the one scripts follow.
    const kept = renameMediaEntry(list, id, name)?.[id]?.name ?? name.trim();
    void step(`Rename ${MEDIA_KIND_WORDS[list[id].kind].one}: ${name.trim()}`, () => renameMedia({ mediaId: id, name }));
    // No script reads a Mask by name.
    if (list[id].kind !== 'mask') offerCodeRename({ root: 'media', oldName: list[id].name, newName: kept, otherNames: [], noun: list[id].kind === 'layered' ? 'Layered Image' : list[id].kind });
  };
  const world = { worldOverview, entities, locations, items, bodies, dictionaries };
  const uses = deleting
    ? [
      ...(mediaUsage(world).get(deleting) ?? [])
        .map((use) => mediaUseLabel(use, (name) => labelPlaceholders(name, placeholders))),
      ...(variantUsage(list).get(deleting) ?? []).map(variantUseLabel),
    ]
    : [];
  // A Layered Image takes the images only it uses with it (Q8).
  const parts = deleting ? unsharedParts(world, deleting) : [];
  const confirm = (
    <DeleteMediaConfirm
      open={!!deleting}
      name={(deleting && list?.[deleting]?.name) || ''}
      kind={(deleting && list?.[deleting]?.kind) || 'image'}
      uses={uses}
      parts={parts.map((part) => list?.[part]?.name || 'Unnamed')}
      onConfirm={() => {
        const id = deleting;
        setDeleting(null);
        if (id) void step(`Delete ${MEDIA_KIND_WORDS[list?.[id]?.kind ?? 'image'].one}: ${list?.[id]?.name ?? ''}`, () => {
          for (const each of [id, ...parts]) removeMedia(each);
        });
      }}
      onOpenChange={(open) => { if (!open) setDeleting(null); }}
    />
  );
  return { rename, askDelete: setDeleting, confirm };
}

/** An entry's name, which renames it on blur or Enter (Q38). */
export function MediaNameField({ entry, rename, className }: {
  entry: MediaEntry;
  rename: (id: string, name: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(entry.name);
  useEffect(() => { setDraft(entry.name); }, [entry.name]);
  const commit = () => {
    // A blank name reverts; a taken one comes back suffixed from the list.
    rename(entry.id, draft);
    setDraft(entry.name);
  };
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') setDraft(entry.name);
      }}
      aria-label={`${MEDIA_KIND_WORDS[entry.kind].one} Name`}
      className={className}
    />
  );
}

/**
 * Under a slot: the entry's name, then Remove (an unlink) and Delete From World. With no entry, the same controls
 * show disabled, so a gallery's row keeps its place as the author steps between filled and empty slots.
 */
export function MediaEntryBar({ entry, onUnlink }: { entry?: MediaEntry; onUnlink: () => void }) {
  const { rename, askDelete, confirm } = useMediaEntryActions();
  return (
    <div className="flex items-center gap-1" data-media-entry-bar={entry?.id ?? ''}>
      {confirm}
      {entry
        ? <MediaNameField entry={entry} rename={rename} className="h-8 flex-1" />
        : <Input disabled placeholder="Empty Slot" aria-label="Image Name" className="h-8 flex-1" />}
      <Tip tip={entry ? `Removes the ${MEDIA_KIND_WORDS[entry.kind].one.toLowerCase()} here and keeps it in the world` : 'Remove From Slot'}>
        <Button type="button" variant="ghost" size="icon" aria-label="Remove From Slot" disabled={!entry} onClick={onUnlink}>
          <X className="h-4 w-4" />
        </Button>
      </Tip>
      <Tip tip="Delete From World">
        <Button type="button" variant="ghost" size="icon" aria-label="Delete From World" disabled={!entry} onClick={() => entry && askDelete(entry.id)}>
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
  const stored = value && typeof value === 'object' ? ('data' in value ? value.data : 'mediaId' in value ? value : undefined) : value;
  const data = resolveMedia(stored, list, 'image')?.data ?? '';
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
