import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { closestCorners, type DragEndEvent } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Search, User } from 'lucide-react';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Meta } from '@/components/ui/typography';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DictionarySelectionItem } from '@/lib/dictionarySelection';
import { useElementSize } from '@/lib/useElementSize';
import { THUMB_FRAME, THUMB_INTRINSIC, thumbFit, type ThumbAspect } from '@/lib/thumbAspect';
import { useIsMobile } from '@/lib/useIsMobile';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import type { EntityMetadata } from '@/types';
import { cn } from '@/lib/utils';

interface EnterWorldLibraryProps {
  entities: EntityMetadata[];
  selectedEntityIds: Set<string>;
  dictionaryItems: DictionarySelectionItem[];
  onEntityToggle: (entityId: string, selected: boolean) => void;
  onDictionaryItemsChange: (items: DictionarySelectionItem[]) => void;
}

type InspectedAddition =
  | { kind: 'entity'; entity: EntityMetadata }
  | { kind: 'dictionary'; item: DictionarySelectionItem; position: number };

const entityInspectionKey = (id: string) => `entity:${id}`;
const dictionaryInspectionKey = (key: string) => `dictionary:${key}`;
const displayName = (name: string) => name || 'Untitled';
// The dictionaries list is its own drag boundary: the ghost stays inside that list rather than the
// shared scroller, so it never travels up into Entities.
const DICTIONARY_LIST_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement];

const sourceLabel = (source: DictionarySelectionItem['source']) => source === 'world' ? 'World' : 'Library';

// Entities frame as portraits and dictionaries as landscapes, the same ratios the library cards use,
// so the detail pane keeps one box whether or not the item has art.
const ARTWORK_ASPECT: Record<'portrait' | 'cover', ThumbAspect> = { portrait: 'portrait', cover: 'landscape' };

function Artwork({ src, name, fallback, large = false }: {
  src?: string;
  name: string;
  fallback: 'portrait' | 'cover';
  large?: boolean;
}) {
  const aspect = ARTWORK_ASPECT[fallback];
  return (
    <span className={cn(
      'flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted',
      large ? cn('w-full self-start', THUMB_FRAME[aspect], aspect === 'portrait' ? 'max-w-40' : 'max-w-64') : 'h-10 w-10',
    )}>
      {src ? (
        <img
          src={src}
          alt={`${name} ${fallback}`}
          {...(large ? THUMB_INTRINSIC[aspect] : {})}
          className={cn('h-full w-full', thumbFit(aspect))}
        />
      ) : (
        <span role="img" aria-label={`${name} has no ${fallback}`}>
          {fallback === 'portrait'
            ? <User aria-hidden className={cn('text-muted-foreground', large ? 'h-12 w-12' : 'h-5 w-5')} />
            : <BookOpen aria-hidden className={cn('text-muted-foreground', large ? 'h-12 w-12' : 'h-5 w-5')} />}
        </span>
      )}
    </span>
  );
}

function AdditionLabel({ name, ariaLabel, buttonRef, onInspect }: {
  name: string;
  ariaLabel: string;
  buttonRef: (node: HTMLButtonElement | null) => void;
  onInspect: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={ariaLabel}
      className="block w-full truncate rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={(event) => { event.stopPropagation(); onInspect(); }}
    >
      {name}
    </button>
  );
}

function EmptySection({ children }: { children: string }) {
  return <p className="rounded-md border border-dashed p-3 text-helper text-muted-foreground">{children}</p>;
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

function DictionaryRow({ item, selected, buttonRef, onInspect, onToggle }: {
  item: DictionarySelectionItem;
  selected: boolean;
  buttonRef: (node: HTMLButtonElement | null) => void;
  onInspect: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const name = displayName(item.book.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  return (
    <div
      role="listitem"
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : undefined,
        position: 'relative',
      }}
    >
      <EditorRow
        gripProps={{ ...attributes, ...listeners }}
        gripTitle={`Drag ${name} from ${sourceLabel(item.source)}`}
        selected={selected}
        onSelect={onInspect}
        checkbox={{ checked: item.enabled, onChange: onToggle, ariaLabel: `Enable ${name} from ${sourceLabel(item.source)}` }}
        icon={<Artwork src={item.book.thumbnail ?? undefined} name={name} fallback="cover" />}
        label={(
          <AdditionLabel
            name={name}
            ariaLabel={`Inspect ${name} from ${sourceLabel(item.source)}`}
            buttonRef={buttonRef}
            onInspect={onInspect}
          />
        )}
        meta={sourceLabel(item.source)}
        metaTitle={item.source === 'world' ? 'Bundled with this world' : 'From your library'}
      />
    </div>
  );
}

function DetailChoice({ id, checked, ariaLabel, label, onChange }: {
  id: string;
  checked: boolean;
  ariaLabel: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex w-fit cursor-pointer items-center gap-2 text-label">
      <Checkbox
        id={id}
        checked={checked}
        aria-label={ariaLabel}
        className="shrink-0"
        onCheckedChange={(value) => onChange(value === true)}
      />
      {label}
    </label>
  );
}

function AdditionDetails({ addition, entitySelected, dictionaryTotal, headingRef, showBack, onEntityToggle, onDictionaryToggle, onMove, onBack }: {
  addition: InspectedAddition | null;
  entitySelected: boolean;
  dictionaryTotal: number;
  headingRef: RefObject<HTMLHeadingElement>;
  showBack: boolean;
  onEntityToggle: (entityId: string, selected: boolean) => void;
  onDictionaryToggle: (key: string, enabled: boolean) => void;
  onMove: (key: string, offset: -1 | 1) => void;
  onBack: () => void;
}) {
  if (!addition) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center rounded-md border border-dashed p-6 text-center text-helper text-muted-foreground">
        Select an entity or dictionary to inspect it.
      </div>
    );
  }

  const name = displayName(addition.kind === 'entity' ? addition.entity.name : addition.item.book.name);
  const description = addition.kind === 'entity' ? addition.entity.description : addition.item.book.description;
  const artwork = addition.kind === 'entity' ? addition.entity.image : addition.item.book.thumbnail;
  return (
    <div className={cn('space-y-5', showBack ? 'p-4' : 'pb-4')}>
      {showBack && (
        <Button type="button" variant="ghost" className="-ml-2 min-h-11 gap-2" onClick={onBack}>
          <ArrowLeft aria-hidden className="h-4 w-4" />
          <span>Back to Additions</span>
        </Button>
      )}
      <div className="flex flex-col gap-4 lg:flex-row">
        <Artwork
          src={artwork ?? undefined}
          name={name}
          fallback={addition.kind === 'entity' ? 'portrait' : 'cover'}
          large
        />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-meta uppercase tracking-wide text-muted-foreground">
            {addition.kind === 'entity' ? 'Entity' : `${sourceLabel(addition.item.source)} Dictionary`}
          </p>
          <h3 ref={headingRef} tabIndex={-1} className="break-words text-heading font-semibold outline-none">
            {name}
          </h3>
          <p className="mt-3 whitespace-pre-wrap text-body text-muted-foreground">
            {description?.trim() || 'No description is available.'}
          </p>
        </div>
      </div>

      {addition.kind === 'entity' ? (
        <DetailChoice
          id="addition-detail-entity-toggle"
          checked={entitySelected}
          ariaLabel={`Include ${name} in This Game`}
          label="Included in This Game"
          onChange={(selected) => onEntityToggle(addition.entity.id, selected)}
        />
      ) : (
        <>
          <DetailChoice
            id="addition-detail-dictionary-toggle"
            checked={addition.item.enabled}
            ariaLabel={`Enable ${name} from ${sourceLabel(addition.item.source)} in This Game`}
            label="Enabled in This Game"
            onChange={(enabled) => onDictionaryToggle(addition.item.key, enabled)}
          />
          <div>
            <p className="text-label font-medium">Dictionary Order</p>
            <Meta className="mt-1 block text-muted-foreground">
              Position {addition.position + 1} of {dictionaryTotal}, {addition.item.entryCount} {addition.item.entryCount === 1 ? 'entry' : 'entries'}
            </Meta>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 gap-2 sm:min-h-9"
                aria-label={`Move ${name} from ${sourceLabel(addition.item.source)} Up`}
                disabled={addition.position === 0}
                onClick={() => onMove(addition.item.key, -1)}
              >
                <ArrowUp aria-hidden className="h-4 w-4" /> Move Up
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 gap-2 sm:min-h-9"
                aria-label={`Move ${name} from ${sourceLabel(addition.item.source)} Down`}
                disabled={addition.position === dictionaryTotal - 1}
                onClick={() => onMove(addition.item.key, 1)}
              >
                <ArrowDown aria-hidden className="h-4 w-4" /> Move Down
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function EnterWorldLibrary(props: EnterWorldLibraryProps) {
  const viewportMobile = useIsMobile();
  const [containerRef, containerSize] = useElementSize();
  const singlePane = containerSize.width > 0 ? containerSize.width < 44 * 16 : viewportMobile;
  const prefersReducedMotion = usePrefersReducedMotion();
  const [query, setQuery] = useState('');
  const [inspectedKey, setInspectedKey] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const openerRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoreFocus = useRef(false);
  const entryFrame = useRef<number | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesQuery = (name: string, description?: string) => (
    !normalizedQuery
    || name.toLocaleLowerCase().includes(normalizedQuery)
    || description?.toLocaleLowerCase().includes(normalizedQuery)
  );
  const visibleEntities = props.entities.filter((entity) => matchesQuery(entity.name, entity.description));
  const visibleDictionaryItems = props.dictionaryItems.filter((item) => (
    matchesQuery(item.book.name, item.book.description)
  ));
  const visibleDictionaryKeys = visibleDictionaryItems.map((item) => item.key);
  const inspected = useMemo<InspectedAddition | null>(() => {
    if (!inspectedKey) return null;
    if (inspectedKey.startsWith('entity:')) {
      const entity = props.entities.find((candidate) => entityInspectionKey(candidate.id) === inspectedKey);
      return entity ? { kind: 'entity', entity } : null;
    }
    const position = props.dictionaryItems.findIndex(
      (candidate) => dictionaryInspectionKey(candidate.key) === inspectedKey,
    );
    return position >= 0 ? { kind: 'dictionary', item: props.dictionaryItems[position], position } : null;
  }, [inspectedKey, props.dictionaryItems, props.entities]);

  useEffect(() => {
    if (detailsOpen) headingRef.current?.focus({ preventScroll: true });
  }, [detailsOpen, inspectedKey]);
  useEffect(() => {
    if (!singlePane || detailsOpen || !restoreFocus.current || !inspectedKey) return;
    restoreFocus.current = false;
    (openerRefs.current.get(inspectedKey) ?? searchRef.current)?.focus({ preventScroll: true });
  }, [detailsOpen, inspectedKey, singlePane]);
  useEffect(() => () => {
    if (entryFrame.current !== null) cancelAnimationFrame(entryFrame.current);
  }, []);
  useEffect(() => {
    if (singlePane && !prefersReducedMotion) return;
    if (entryFrame.current === null) return;
    cancelAnimationFrame(entryFrame.current);
    entryFrame.current = null;
    setDetailsOpen(true);
  }, [prefersReducedMotion, singlePane]);

  const inspect = (key: string) => {
    if (entryFrame.current !== null) cancelAnimationFrame(entryFrame.current);
    setInspectedKey(key);
    if (!singlePane || prefersReducedMotion) {
      entryFrame.current = null;
      setDetailsOpen(true);
      return;
    }
    setDetailsOpen(false);
    entryFrame.current = requestAnimationFrame(() => {
      entryFrame.current = requestAnimationFrame(() => {
        entryFrame.current = null;
        setDetailsOpen(true);
      });
    });
  };
  const closeDetails = () => {
    if (entryFrame.current !== null) {
      cancelAnimationFrame(entryFrame.current);
      entryFrame.current = null;
    }
    restoreFocus.current = true;
    setDetailsOpen(false);
  };
  const setOpenerRef = (key: string) => (node: HTMLButtonElement | null) => {
    if (node) openerRefs.current.set(key, node);
    else openerRefs.current.delete(key);
  };
  const updateDictionary = (key: string, enabled: boolean) => props.onDictionaryItemsChange(
    props.dictionaryItems.map((item) => item.key === key ? { ...item, enabled } : item),
  );
  const reorder = (fromKey: string, toKey: string) => props.onDictionaryItemsChange(
    reorderVisibleItems(props.dictionaryItems, visibleDictionaryKeys, fromKey, toKey),
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) reorder(String(active.id), String(over.id));
  };
  const move = (key: string, offset: -1 | 1) => {
    const index = props.dictionaryItems.findIndex((item) => item.key === key);
    const destination = index + offset;
    if (index < 0 || destination < 0 || destination >= props.dictionaryItems.length) return;
    const next = [...props.dictionaryItems];
    [next[index], next[destination]] = [next[destination], next[index]];
    props.onDictionaryItemsChange(next);
  };
  const entityCount = props.entities.filter((entity) => props.selectedEntityIds.has(entity.id)).length;
  const dictionaryCount = props.dictionaryItems.filter((item) => item.enabled).length;
  const listVisible = !singlePane || !detailsOpen;
  const detailsVisible = !singlePane || detailsOpen;

  return (
    <div
      ref={containerRef}
      data-enter-world-container="library"
      data-pane-mode={singlePane ? 'single' : 'split'}
      data-testid="enter-world-library-layout"
      className={cn(
        'relative grid min-h-0 flex-1 grid-cols-1 overflow-hidden',
        !singlePane && 'grid-cols-[minmax(18rem,0.95fr)_minmax(20rem,1.05fr)] gap-4',
      )}
    >
      <section
        role="region"
        aria-label="Library Additions List"
        aria-hidden={!listVisible}
        {...(!listVisible ? { inert: '' } : {})}
        className={cn(
          'flex min-h-0 flex-col overflow-hidden',
          singlePane && 'col-start-1 row-start-1 transition-transform duration-200 ease-out motion-reduce:transition-none',
          singlePane && detailsOpen && '-translate-x-1/4 pointer-events-none',
        )}
      >
        <div className="shrink-0 pb-3">
          <div className="relative">
            <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              type="search"
              aria-label="Search Library Additions"
              placeholder="Search additions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea type="always" className="min-h-0 flex-1">
          <div className="space-y-6">
            <section aria-labelledby="library-entities-heading">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 id="library-entities-heading" className="text-title font-semibold">Entities</h3>
                <p className="text-meta text-muted-foreground">
                  {entityCount} of {props.entities.length} entities included
                </p>
              </div>
              {visibleEntities.length ? (
                <EditorRowList role="list" aria-label="Entities">
                  {visibleEntities.map((entity) => {
                    const key = entityInspectionKey(entity.id);
                    const name = displayName(entity.name);
                    return (
                      <div key={key} role="listitem">
                        <EditorRow
                          grip={false}
                          selected={inspectedKey === key}
                          onSelect={() => inspect(key)}
                          checkbox={{
                            checked: props.selectedEntityIds.has(entity.id),
                            onChange: (selected) => props.onEntityToggle(entity.id, selected),
                            ariaLabel: `Include ${name}`,
                          }}
                          icon={<Artwork src={entity.image} name={name} fallback="portrait" />}
                          label={(
                            <AdditionLabel
                              name={name}
                              ariaLabel={`Inspect ${name}`}
                              buttonRef={setOpenerRef(key)}
                              onInspect={() => inspect(key)}
                            />
                          )}
                          meta={props.selectedEntityIds.has(entity.id) ? 'Included' : 'Excluded'}
                        />
                      </div>
                    );
                  })}
                </EditorRowList>
              ) : (
                <EmptySection>{props.entities.length ? 'No entities match your search.' : 'No entities are available.'}</EmptySection>
              )}
            </section>

            <section aria-labelledby="library-dictionaries-heading">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 id="library-dictionaries-heading" className="text-title font-semibold">Dictionaries</h3>
                <p className="text-meta text-muted-foreground">
                  {dictionaryCount} of {props.dictionaryItems.length} dictionaries enabled
                </p>
              </div>
              {visibleDictionaryItems.length ? (
                <EditorDndContext collisionDetection={closestCorners} modifiers={DICTIONARY_LIST_MODIFIERS} onDragEnd={handleDragEnd}>
                  <StableSortableContext
                    items={visibleDictionaryItems}
                    getId={(item) => item.key}
                    strategy={verticalListSortingStrategy}
                  >
                    <EditorRowList role="list" aria-label="Dictionary Order">
                      {visibleDictionaryItems.map((item) => {
                        const key = dictionaryInspectionKey(item.key);
                        return (
                          <DictionaryRow
                            key={item.key}
                            item={item}
                            selected={inspectedKey === key}
                            buttonRef={setOpenerRef(key)}
                            onInspect={() => inspect(key)}
                            onToggle={(enabled) => updateDictionary(item.key, enabled)}
                          />
                        );
                      })}
                    </EditorRowList>
                  </StableSortableContext>
                </EditorDndContext>
              ) : (
                <EmptySection>{props.dictionaryItems.length ? 'No dictionaries match your search.' : 'No dictionaries are available.'}</EmptySection>
              )}
            </section>
          </div>
        </ScrollArea>
      </section>

      <section
        role="region"
        aria-label="Addition Details"
        aria-hidden={!detailsVisible}
        {...(!detailsVisible ? { inert: '' } : {})}
        className={cn(
          'z-10 min-h-0 overflow-hidden',
          singlePane && 'col-start-1 row-start-1 bg-background transition-transform duration-200 ease-out motion-reduce:transition-none',
          singlePane && (detailsOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'),
        )}
      >
        <ScrollArea type="always" className="h-full min-h-0">
          <AdditionDetails
            addition={inspected}
            entitySelected={inspected?.kind === 'entity' && props.selectedEntityIds.has(inspected.entity.id)}
            dictionaryTotal={props.dictionaryItems.length}
            headingRef={headingRef}
            showBack={singlePane}
            onEntityToggle={props.onEntityToggle}
            onDictionaryToggle={updateDictionary}
            onMove={move}
            onBack={closeDetails}
          />
        </ScrollArea>
      </section>
    </div>
  );
}
