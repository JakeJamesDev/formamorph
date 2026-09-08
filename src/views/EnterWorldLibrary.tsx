import { useState } from 'react';
import { closestCorners, type DragEndEvent } from '@dnd-kit/core';
import { useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, BookOpen, GripVertical, Search, User } from 'lucide-react';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { DictionarySelectionItem } from '@/lib/dictionarySelection';
import type { EntityMetadata } from '@/types';
import { cn } from '@/lib/utils';

interface EnterWorldLibraryProps {
  entities: EntityMetadata[];
  selectedEntityIds: Set<string>;
  dictionaryItems: DictionarySelectionItem[];
  onEntityToggle: (entityId: string, selected: boolean) => void;
  onDictionaryItemsChange: (items: DictionarySelectionItem[]) => void;
}

function Artwork({ src, alt, fallback }: { src?: string; alt: string; fallback: 'portrait' | 'cover' }) {
  return (
    <span className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : (
        <span role="img" aria-label={`${alt.replace(/ (portrait|cover)$/, '')} has no ${fallback}`}>
          {fallback === 'portrait'
            ? <User aria-hidden className="h-6 w-6 text-muted-foreground" />
            : <BookOpen aria-hidden className="h-6 w-6 text-muted-foreground" />}
        </span>
      )}
    </span>
  );
}

function ChoiceRow({ checked, name, ariaLabel, description, artwork, onCheckedChange }: {
  checked: boolean;
  name: string;
  ariaLabel: string;
  description?: string;
  artwork: React.ReactNode;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className={cn(
      'flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
      checked ? 'border-primary bg-primary/10' : 'bg-background hover:bg-muted/40',
    )}>
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-label={ariaLabel}
        className="shrink-0"
      />
      {artwork}
      <span className="min-w-0 flex-1">
        <strong className="block break-words">{name}</strong>
        {description && <span className="mt-1 block text-helper text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

function EmptySection({ children }: { children: string }) {
  return <p className="text-helper text-muted-foreground">{children}</p>;
}

function reorderVisibleItems(
  items: DictionarySelectionItem[],
  visibleKeys: string[],
  fromKey: string,
  toKey: string,
): DictionarySelectionItem[] {
  const from = visibleKeys.indexOf(fromKey);
  const to = visibleKeys.indexOf(toKey);
  if (from < 0 || to < 0 || from === to) return items;

  const reorderedKeys = [...visibleKeys];
  const [moved] = reorderedKeys.splice(from, 1);
  reorderedKeys.splice(to, 0, moved);
  const visibleSet = new Set(visibleKeys);
  const itemsByKey = new Map(items.map((item) => [item.key, item]));
  let visibleIndex = 0;
  return items.map((item) => (
    visibleSet.has(item.key) ? itemsByKey.get(reorderedKeys[visibleIndex++]) ?? item : item
  ));
}

function DictionaryOrderRow({ item, canMoveUp, canMoveDown, onMove }: {
  item: DictionarySelectionItem;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (offset: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
      className="flex min-h-14 items-center gap-2 rounded-lg border bg-background p-2"
    >
      <button
        type="button"
        aria-label={`Drag ${item.book.name || 'Untitled'} from ${item.source}`}
        className="flex min-h-11 min-w-11 touch-none cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-label">{item.book.name || 'Untitled'}</strong>
        <span className="text-meta uppercase tracking-wide text-muted-foreground">{item.source}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        aria-label={`Move ${item.book.name || 'Untitled'} from ${item.source} up`}
        disabled={!canMoveUp}
        onClick={() => onMove(-1)}
      >
        <ArrowUp aria-hidden className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        aria-label={`Move ${item.book.name || 'Untitled'} from ${item.source} down`}
        disabled={!canMoveDown}
        onClick={() => onMove(1)}
      >
        <ArrowDown aria-hidden className="h-4 w-4" />
      </Button>
    </li>
  );
}

export default function EnterWorldLibrary(props: EnterWorldLibraryProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesQuery = (name: string, description?: string) => (
    !normalizedQuery
    || name.toLocaleLowerCase().includes(normalizedQuery)
    || description?.toLocaleLowerCase().includes(normalizedQuery)
  );
  const updateDictionary = (key: string, enabled: boolean) => props.onDictionaryItemsChange(
    props.dictionaryItems.map((item) => item.key === key ? { ...item, enabled } : item),
  );
  const visibleEntities = props.entities.filter((entity) => matchesQuery(entity.name, entity.description));
  const libraryBooks = props.dictionaryItems.filter((item) => (
    item.source === 'library' && matchesQuery(item.book.name, item.book.description)
  ));
  const worldBooks = props.dictionaryItems.filter((item) => (
    item.source === 'world' && matchesQuery(item.book.name, item.book.description)
  ));
  const visibleDictionaryItems = props.dictionaryItems.filter((item) => (
    matchesQuery(item.book.name, item.book.description)
  ));
  const visibleDictionaryKeys = visibleDictionaryItems.map((item) => item.key);
  const reorder = (fromKey: string, toKey: string) => props.onDictionaryItemsChange(
    reorderVisibleItems(props.dictionaryItems, visibleDictionaryKeys, fromKey, toKey),
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) reorder(String(active.id), String(over.id));
  };
  const move = (key: string, offset: -1 | 1) => {
    const index = visibleDictionaryKeys.indexOf(key);
    const destination = visibleDictionaryKeys[index + offset];
    if (destination) reorder(key, destination);
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search library additions"
          placeholder="Search additions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
        />
      </div>

      <section aria-labelledby="library-entities-heading">
        <h3 id="library-entities-heading" className="mb-3 text-title font-semibold">Entities</h3>
        {visibleEntities.length ? (
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            {visibleEntities.map((entity) => (
              <ChoiceRow
                key={entity.id}
                checked={props.selectedEntityIds.has(entity.id)}
                name={entity.name || 'Untitled'}
                ariaLabel={`Include ${entity.name || 'Untitled'}`}
                description={entity.description}
                artwork={<Artwork src={entity.image} alt={`${entity.name || 'Untitled'} portrait`} fallback="portrait" />}
                onCheckedChange={(selected) => props.onEntityToggle(entity.id, selected)}
              />
            ))}
          </div>
        ) : <EmptySection>{props.entities.length ? 'No entities match your search.' : 'No entities are available.'}</EmptySection>}
      </section>

      <section aria-labelledby="library-dictionaries-heading">
        <h3 id="library-dictionaries-heading" className="mb-3 text-title font-semibold">Library dictionaries</h3>
        {libraryBooks.length ? (
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            {libraryBooks.map((item) => (
              <ChoiceRow
                key={item.key}
                checked={item.enabled}
                name={item.book.name || 'Untitled'}
                ariaLabel={`Enable ${item.book.name || 'Untitled'} from library`}
                description={item.book.description}
                artwork={<Artwork src={item.book.thumbnail ?? undefined} alt={`${item.book.name || 'Untitled'} cover`} fallback="cover" />}
                onCheckedChange={(enabled) => updateDictionary(item.key, enabled)}
              />
            ))}
          </div>
        ) : <EmptySection>{props.dictionaryItems.some((item) => item.source === 'library') ? 'No library dictionaries match your search.' : 'No library dictionaries are available.'}</EmptySection>}
      </section>

      <section aria-labelledby="world-dictionaries-heading">
        <h3 id="world-dictionaries-heading" className="mb-3 text-title font-semibold">Included with this world</h3>
        {worldBooks.length ? (
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            {worldBooks.map((item) => (
              <ChoiceRow
                key={item.key}
                checked={item.enabled}
                name={item.book.name || 'Untitled'}
                ariaLabel={`Enable ${item.book.name || 'Untitled'} from world`}
                description={item.book.description}
                artwork={<Artwork src={item.book.thumbnail ?? undefined} alt={`${item.book.name || 'Untitled'} cover`} fallback="cover" />}
                onCheckedChange={(enabled) => updateDictionary(item.key, enabled)}
              />
            ))}
          </div>
        ) : <EmptySection>{props.dictionaryItems.some((item) => item.source === 'world') ? 'No world dictionaries match your search.' : 'This world includes no dictionaries.'}</EmptySection>}
      </section>

      <section aria-labelledby="dictionary-order-heading">
        <h3 id="dictionary-order-heading" className="mb-3 text-title font-semibold">Dictionary order</h3>
        {visibleDictionaryItems.length ? (
          <EditorDndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <StableSortableContext
              items={visibleDictionaryItems}
              getId={(item) => item.key}
              strategy={verticalListSortingStrategy}
            >
              <ol aria-label="Dictionary order" className="flex flex-col gap-2">
                {visibleDictionaryItems.map((item, index) => (
                  <DictionaryOrderRow
                    key={item.key}
                    item={item}
                    canMoveUp={index > 0}
                    canMoveDown={index < visibleDictionaryItems.length - 1}
                    onMove={(offset) => move(item.key, offset)}
                  />
                ))}
              </ol>
            </StableSortableContext>
          </EditorDndContext>
        ) : <EmptySection>{props.dictionaryItems.length ? 'No dictionaries match your search.' : 'No dictionaries are available.'}</EmptySection>}
      </section>
    </div>
  );
}
