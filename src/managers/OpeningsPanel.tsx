import { useState, type ReactNode } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, GripVertical, MapPinOff, Plus, Trash2 } from 'lucide-react';
import { CollapseAllButton } from '@/components/CollapseAllButton';
import { useCardCollapse } from '@/lib/cardCollapse';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { placeholderChipLine } from '@/lib/placeholders';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import PlaceholderField from '@/components/prompt/PlaceholderField';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { ListSearchToolbar } from '@/components/ListToolbar';
import { useListSearch } from '@/components/listToolbarHooks';
import { useGameData } from '@/contexts/GameDataContext';
import {
  addOpening, DEFAULT_OPENING, hasAuthoredOpenings, moveOpening, openingsEditorView, openingsEnabled, ownerOpeningRows, removeOpening,
  setOpeningKind, setOpeningSelf, setOpeningText, setOpeningWeight, canOwnSelfOpenings, type EditorOpeningRow, type OpeningOwner,
} from '@/lib/openings';
import { matchesListSearch, type ListSearchNames } from '@/lib/listSearch';
import { labelPlaceholders } from '@/lib/placementLetters';
import { cn } from '@/lib/utils';
import type { Entity, GameLocation, Opening, OpeningKind, Placeholder } from '@/types';

/** The Starting Location filter's value for every start at once. */
const ALL_LOCATIONS = 'all-locations';

const OR = new Intl.ListFormat('en', { type: 'disjunction' });

/**
 * Every opening in the world, grouped by owner: the world's own rows, then each location with openings, then
 * each authored entity that has openings. Each edit lands on its owner. A world with several starts filters
 * the list to one of them, or shows them all; the pick is view state and is never stored.
 */
export function OpeningsPanel({ onOpenEntity, onOpenLocation }: {
  /** Opens that entity's Openings tab. */
  onOpenEntity?: (entityId: string) => void;
  /** Opens that location's Openings tab. */
  onOpenLocation?: (locationId: string) => void;
}) {
  const {
    worldOverview, updateWorldOverview, entities, updateEntity, locations, updateLocation, placeholders,
    placementLetters, placeholderOwners,
  } = useGameData();
  const [filter, setFilter] = useState<string | null>(null);
  const view = openingsEditorView({ overview: worldOverview, entities, locations }, filter);
  const label = (name: string) => labelPlaceholders(name, placeholders, { letters: placementLetters, owners: placeholderOwners });
  const [world, ...ownedGroups] = view.groups;
  const owners = [...entities, ...locations];
  const anyOpenings = hasAuthoredOpenings(worldOverview) || owners.some(hasAuthoredOpenings);
  const search = useListSearch();
  const names: ListSearchNames = { placeholders, letters: placementLetters, owners: placeholderOwners };
  const hasMatch = (rows: EditorOpeningRow[]) => !search.typed || matchingRows(rows, search.typed, names).length > 0;
  const noMatch = !!search.typed && !view.groups.some((g) => hasMatch(g.rows));

  return (
    <div className="space-y-4">
      <ListSearchToolbar
        search={search}
        add={{ label: 'Add Opening', onAdd: () => updateWorldOverview(addOpening(worldOverview)) }}
        placeholder="Search openings"
      />
      {view.starts.length > 1 && (
        <div className="flex items-center gap-2">
          <Label htmlFor="openings-starting-location" className="shrink-0">Starting Location</Label>
          <Select
            value={view.startId ?? ALL_LOCATIONS}
            onValueChange={(v) => setFilter(v === ALL_LOCATIONS ? null : v)}
          >
            <SelectTrigger id="openings-starting-location" className="h-8 min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LOCATIONS}>All Locations</SelectItem>
              {view.starts.map((l) => <SelectItem key={l.id} value={l.id}>{label(l.name)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {noMatch && <NoMatch typed={search.typed} />}

      {hasMatch(world.rows) && (
        <section aria-label="This World" className="space-y-2">
          <h3 className="text-body font-semibold">This World</h3>
          {view.defaultOpening && !search.typed && (
            <div className="space-y-1">
              <Hint>
                {view.defaultStarts.length
                  ? `No opening can come up at ${OR.format(view.defaultStarts.map((l) => label(l.name)))}, so a game there starts on the text below`
                  : 'No opening can come up, so every game starts on the text below'}
              </Hint>
              <div
                role="note"
                aria-label="Default Opening"
                className="whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 text-helper text-muted-foreground"
              >
                {DEFAULT_OPENING.text}
              </div>
            </div>
          )}
          <OpeningsList
            owner={worldOverview}
            rows={world.rows}
            onChange={updateWorldOverview}
            placeholders={placeholders}
            search={search.typed}
            names={names}
            addButton={false}
            empty={view.defaultOpening ? null : <Hint>No openings yet</Hint>}
          />
        </section>
      )}

      {ownedGroups.map(({ entity, location, name: rawName, rows, showSelf, atNoStart }) => {
        if (!hasMatch(rows)) return null;
        const owner = location ?? entity;
        if (!owner) return null;
        const name = label(rawName) || (location ? 'Unnamed location' : 'Unnamed entity');
        return (
          <section key={`${location ? 'location' : 'entity'}:${owner.id}`} aria-label={name} className="space-y-2" data-testid="opening-group">
            <div className="flex flex-wrap items-center gap-2">
              <Tip tip={location ? "Open this location's Openings tab" : "Open this entity's Openings tab"} labelsChild={false}>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto min-w-0 p-0 text-body font-semibold"
                  onClick={() => (location ? onOpenLocation?.(location.id) : onOpenEntity?.(owner.id))}
                >
                  <span className="truncate">{name}</span>
                </Button>
              </Tip>
              {atNoStart && (
                <Tip
                  tip={location
                    ? "Isn't a starting location, so its openings never come up"
                    : "Isn't at any starting location, so its openings never come up"}
                  labelsChild={false}
                >
                  {/* A span, not Badge: the tip's trigger needs a ref, and Badge forwards none. */}
                  <span tabIndex={0} className={cn(badgeVariants({ variant: 'outline' }), 'gap-1')}>
                    <MapPinOff className="h-3 w-3" aria-hidden /> No Starting Location
                  </span>
                </Tip>
              )}
            </div>
            {location ? (
              <OpeningsList
                owner={location}
                rows={rows}
                onChange={(patch) => updateLocation({ ...location, ...patch })}
                placeholders={placeholders}
                ownerLabel={name}
                search={search.typed}
                names={names}
                empty={null}
              />
            ) : entity && (
              <OpeningsList
                owner={entity}
                rows={rows}
                onChange={(patch) => updateEntity({ ...entity, ...patch })}
                placeholders={placeholders}
                ownerId={entity.id}
                ownerLabel={name}
                ownerName={entity.name}
                search={search.typed}
                names={names}
                selfSwitch={showSelf}
                selfBadge
                empty={null}
              />
            )}
          </section>
        );
      })}

      <Hint>
        {openingsEnabled(worldOverview, owners)
          ? 'Draws one opening by weight when a player starts this world. A Player Action fills their input box for them to edit and send. Narration is page one, shown as written.'
          : anyOpenings
            ? "Switched off, so players start on the default opening. Chances show the odds you'll get once it's on."
            : 'Write an opening here, on a location or on an entity to switch this on. Until then players start on the default opening.'}
      </Hint>
    </div>
  );
}

/** One entity's openings, for both entity editors. */
export function EntityOpenings({ entity, library = false, onChange, placeholders, names = { placeholders } }: {
  entity: Entity;
  /** A library entity, whose Self rows show only with the Persona mark: no player picks a library Custom Persona. */
  library?: boolean;
  onChange: (patch: OpeningOwner) => void;
  placeholders: Placeholder[];
  /** How the search reads chips; defaults to the placeholders alone. */
  names?: ListSearchNames;
}) {
  const search = useListSearch();
  const showSelf = library ? !!entity.persona : canOwnSelfOpenings(entity);
  return (
    <div className="space-y-2">
      <ListSearchToolbar
        search={search}
        add={{ label: 'Add Opening', onAdd: () => onChange(addOpening(entity)) }}
        placeholder="Search openings"
      />
      <OpeningsList
        owner={entity}
        rows={ownerOpeningRows(entity, showSelf)}
        onChange={onChange}
        placeholders={placeholders}
        ownerId={entity.id}
        ownerName={entity.name}
        search={search.typed}
        names={names}
        addButton={false}
        selfSwitch={showSelf}
        empty={<Hint>No openings yet</Hint>}
      />
      <Hint>
        {"Drawn with the world's openings when a player starts at one of this entity's locations. The world's switch turns them off too."}
        {showSelf && ' Mark one Self to make it the only start for a player who plays this entity.'}
      </Hint>
    </div>
  );
}

/** One location's openings, for the location editor. A location has no Self rows. */
export function LocationOpenings({ location, onChange, placeholders, names = { placeholders } }: {
  location: GameLocation;
  onChange: (patch: OpeningOwner) => void;
  placeholders: Placeholder[];
  /** How the search reads chips; defaults to the placeholders alone. */
  names?: ListSearchNames;
}) {
  const search = useListSearch();
  return (
    <div className="space-y-2">
      <ListSearchToolbar
        search={search}
        add={{ label: 'Add Opening', onAdd: () => onChange(addOpening(location)) }}
        placeholder="Search openings"
      />
      <OpeningsList
        owner={location}
        rows={ownerOpeningRows(location, false)}
        onChange={onChange}
        placeholders={placeholders}
        search={search.typed}
        names={names}
        addButton={false}
        empty={<Hint>No openings yet</Hint>}
      />
      <Hint>
        {"Joins the world's openings when a game starts at this location, not at a location inside it. The world's Openings checkbox turns them off too."}
      </Hint>
    </div>
  );
}

/** The rows whose text matches a search. */
function matchingRows(rows: EditorOpeningRow[], typed: string, names: ListSearchNames) {
  return rows.filter((row) => matchesListSearch(row.opening.text, typed, names));
}

function NoMatch({ typed }: { typed: string }) {
  return <p className="p-2 text-helper text-muted-foreground">No openings match &ldquo;{typed}&rdquo;.</p>;
}

/**
 * One owner's openings: a card per row with its kind, text, weight and chance, in draw order, and an optional
 * Add button. Each edit goes to `onChange` as a patch of the owner's opening fields. A null chance renders as a
 * dash: the row is outside the pool the chances describe.
 */
export function OpeningsList({
  owner, rows, onChange, placeholders, ownerId, empty, ownerLabel, ownerName, search = '', names, addButton = true,
  selfSwitch = false, selfBadge = false,
}: {
  owner: OpeningOwner;
  rows: EditorOpeningRow[];
  onChange: (patch: OpeningOwner) => void;
  placeholders: Placeholder[];
  /** The entity whose openings these are. Absent for the world's own. */
  ownerId?: string;
  /** What shows in place of the rows while there are none. */
  empty: ReactNode;
  /** Names the owner in each row's accessible labels, where several owners share one screen. */
  ownerLabel?: string;
  /** The entity's authored name, which a Character Name chip previews as. */
  ownerName?: string;
  /** The trimmed search text; only cards whose text matches draw. */
  search?: string;
  names?: ListSearchNames;
  /** False where a toolbar's + adds to this owner. */
  addButton?: boolean;
  /** Each card sets whether its row is Others or Self. */
  selfSwitch?: boolean;
  /** A Self row names itself with a badge, where several owners share one screen. */
  selfBadge?: boolean;
}) {
  const shown = search ? matchingRows(rows, search, names ?? { placeholders }) : rows;
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    // The owner's own indexes: the rows may leave out its hidden Self rows.
    const ids = (owner.openings ?? []).map((o) => o.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from !== -1 && to !== -1) onChange(moveOpening(owner, from, to));
  };
  const collapse = useCardCollapse(shown.map((row) => row.opening.id));

  return (
    <div className="space-y-2">
      {shown.length > 1 && (
        <div className="flex justify-end">
          <CollapseAllButton anyOpen={collapse.anyOpen} noun="openings" onClick={collapse.toggleAll} />
        </div>
      )}
      {shown.length === 0 ? (search ? <NoMatch typed={search} /> : empty) : (
        <EditorDndContext onDragEnd={handleDragEnd}>
          <StableSortableContext items={shown.map((row) => row.opening)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {shown.map(({ opening, index: i, weight, chance }) => (
                <OpeningCard
                  key={opening.id}
                  opening={opening}
                  label={`Opening ${i + 1}`}
                  a11yLabel={ownerLabel ? `${ownerLabel} Opening ${i + 1}` : `Opening ${i + 1}`}
                  open={collapse.isOpen(opening.id)}
                  onToggle={() => collapse.toggle(opening.id)}
                  weight={weight}
                  chance={chance}
                  placeholders={placeholders}
                  ownerId={ownerId}
                  ownerName={ownerName}
                  onKind={(kind) => onChange(setOpeningKind(owner, opening.id, kind))}
                  onSelf={selfSwitch ? (self) => onChange(setOpeningSelf(owner, opening.id, self)) : undefined}
                  selfBadge={selfBadge && !!opening.self}
                  onText={(text) => onChange(setOpeningText(owner, opening.id, text))}
                  onWeight={(w) => onChange(setOpeningWeight(owner, opening.id, w))}
                  onRemove={() => onChange(removeOpening(owner, opening.id))}
                />
              ))}
            </div>
          </StableSortableContext>
        </EditorDndContext>
      )}
      {addButton && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange(addOpening(owner))}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> {ownerLabel ? `Add Opening to ${ownerLabel}` : 'Add Opening'}
        </Button>
      )}
    </div>
  );
}

const OpeningCard = ({
  opening, label, a11yLabel, open, onToggle, weight, chance, placeholders, ownerId, ownerName, onKind, onSelf, selfBadge,
  onText, onWeight, onRemove,
}: {
  opening: Opening;
  label: string;
  /** The row's accessible name, owner included where several share the screen. */
  a11yLabel: string;
  /** Collapsed, the card shows its header and the first line of its text. */
  open: boolean;
  onToggle: () => void;
  weight: number;
  chance: number | null;
  placeholders: Placeholder[];
  ownerId?: string;
  ownerName?: string;
  onKind: (kind: OpeningKind) => void;
  /** Sets Others or Self. Absent, the card has no switch. */
  onSelf?: (self: boolean) => void;
  selfBadge: boolean;
  onText: (text: string) => void;
  onWeight: (weight: number) => void;
  onRemove: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opening.id });
  const vocab = usePlaceholderChipVocabulary(placeholders, ownerId);
  // A chip reads as its name, and a paragraph as its first line plus an ellipsis.
  const firstLine = placeholderChipLine(opening.text, vocab.label);
  return (
    <div
      ref={setNodeRef}
      // Translate, not Transform: Transform scales the dragged card to the target slot.
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="rounded-md border bg-card"
      data-testid="opening-row"
    >
      {/* Wraps on a narrow pane: the weight, chance and remove group drops to a second line, right-aligned. */}
      <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5', open && 'border-b')}>
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground"
          aria-label={`Reorder ${a11yLabel}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="flex min-w-[4.5rem] flex-1 items-center gap-1.5 text-left"
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${a11yLabel}`}
          onClick={onToggle}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} />
          <span className="shrink-0 text-helper font-medium text-muted-foreground">{label}</span>
          {!open && (
            <span className="min-w-0 truncate text-helper text-muted-foreground/70">{firstLine || 'Empty opening'}</span>
          )}
        </button>
        {selfBadge && <Badge variant="outline">Self</Badge>}
        <ToggleGroup
          type="single"
          value={opening.kind}
          onValueChange={(v) => { if (v) onKind(v as OpeningKind); }}
          aria-label={`Opens As, ${a11yLabel}`}
          className="h-6"
        >
          <ToggleGroupItem value="action" className="px-2 py-0 text-helper">Player Action</ToggleGroupItem>
          <ToggleGroupItem value="narration" className="px-2 py-0 text-helper">Narration</ToggleGroupItem>
        </ToggleGroup>
        {onSelf && (
          <ToggleGroup
            type="single"
            value={opening.self ? 'self' : 'others'}
            onValueChange={(v) => { if (v) onSelf(v === 'self'); }}
            aria-label={`Drawn For, ${a11yLabel}`}
            className="h-6"
          >
            <ToggleGroupItem value="others" className="px-2 py-0 text-helper">Others</ToggleGroupItem>
            <ToggleGroupItem value="self" className="px-2 py-0 text-helper">Self</ToggleGroupItem>
          </ToggleGroup>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step={1}
            value={weight}
            onChange={(e) => onWeight(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            className="h-6 w-14 px-1.5 text-helper"
            aria-label={`Draw weight for ${a11yLabel}`}
            title="Draw weight"
          />
          <span className="w-10 text-right text-meta text-muted-foreground" aria-label={`Chance for ${a11yLabel}`}>
            {chance === null ? '—' : `${Math.round(chance)}%`}
          </span>
          <Tip tip="Remove opening" labelsChild={false}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label={`Remove ${a11yLabel}`}
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Tip>
        </div>
      </div>
      {open && (
        <div className="p-2">
          <PlaceholderField
            value={opening.text}
            onChange={onText}
            placeholders={placeholders}
            ownerId={ownerId}
            ownerName={ownerName}
            ariaLabel={a11yLabel}
            placeholder={opening.kind === 'narration' ? 'Page one, exactly as the player reads it' : "What the player's first action says"}
            resizable
          />
        </div>
      )}
    </div>
  );
};
