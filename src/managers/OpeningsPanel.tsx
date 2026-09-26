import { useState, type ReactNode } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MapPinOff, Plus, Trash2 } from 'lucide-react';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import PlaceholderField from '@/components/prompt/PlaceholderField';
import { badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import {
  addOpening, DEFAULT_OPENING, hasAuthoredOpenings, moveOpening, openingsEditorView, openingsEnabled, ownerOpeningRows, removeOpening,
  setOpeningKind, setOpeningText, setOpeningWeight, type EditorOpeningRow, type OpeningOwner,
} from '@/lib/openings';
import { labelPlaceholders } from '@/lib/placementLetters';
import { cn } from '@/lib/utils';
import type { Entity, Opening, OpeningKind, Placeholder } from '@/types';

/**
 * Every opening in the world, grouped by owner: the world's own rows, then each authored entity that has
 * openings. Each edit lands on its owner. The chances describe one starting location, which the author picks
 * when the world has several; the pick is view state and is never stored.
 */
export function OpeningsPanel({ onOpenEntity }: {
  /** Opens that entity's Openings tab. */
  onOpenEntity?: (entityId: string) => void;
}) {
  const {
    worldOverview, updateWorldOverview, entities, updateEntity, locations, placeholders, placementLetters,
    placeholderOwners,
  } = useGameData();
  const [startId, setStartId] = useState<string | null>(null);
  const view = openingsEditorView({ overview: worldOverview, entities, locations }, startId);
  const label = (name: string) => labelPlaceholders(name, placeholders, { letters: placementLetters, owners: placeholderOwners });
  const chancesStart = view.starts.find((l) => l.id === view.chancesStartId);
  const [world, ...entityGroups] = view.groups;
  const anyOpenings = hasAuthoredOpenings(worldOverview) || entities.some(hasAuthoredOpenings);

  return (
    <div className="space-y-4">
      {view.starts.length > 1 && (
        <div className="flex items-center gap-2">
          <Label htmlFor="openings-chances-at" className="shrink-0">Chances At</Label>
          <Select value={view.chancesStartId ?? undefined} onValueChange={setStartId}>
            <SelectTrigger id="openings-chances-at" className="h-8 min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {view.starts.map((l) => <SelectItem key={l.id} value={l.id}>{label(l.name)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <section aria-label="This World" className="space-y-2">
        <h3 className="text-body font-semibold">This World</h3>
        <OpeningsList
          owner={worldOverview}
          rows={world.rows}
          onChange={updateWorldOverview}
          placeholders={placeholders}
          empty={(
            <div className="space-y-1">
              <Hint>No openings yet. This world starts on the text below.</Hint>
              <div
                role="note"
                aria-label="Default Opening"
                className="whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 text-helper text-muted-foreground"
              >
                {DEFAULT_OPENING.text}
              </div>
            </div>
          )}
        />
      </section>

      {entityGroups.map(({ entity, name: rawName, rows, atNoStart, atChancesStart }) => {
        if (!entity) return null;
        const name = label(rawName) || 'Unnamed entity';
        return (
          <section key={entity.id} aria-label={name} className="space-y-2" data-testid="opening-group">
            <div className="flex flex-wrap items-center gap-2">
              <Tip tip="Open this entity's Openings tab" labelsChild={false}>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto min-w-0 p-0 text-body font-semibold"
                  onClick={() => onOpenEntity?.(entity.id)}
                >
                  <span className="truncate">{name}</span>
                </Button>
              </Tip>
              {atNoStart && (
                <Tip tip="Isn't at any starting location, so its openings never come up" labelsChild={false}>
                  {/* A span, not Badge: the tip's trigger needs a ref, and Badge forwards none. */}
                  <span tabIndex={0} className={cn(badgeVariants({ variant: 'outline' }), 'gap-1')}>
                    <MapPinOff className="h-3 w-3" aria-hidden /> No Starting Location
                  </span>
                </Tip>
              )}
            </div>
            {!atNoStart && !atChancesStart && chancesStart && (
              <Hint>{`Not at ${label(chancesStart.name)}, so these openings don't come up there`}</Hint>
            )}
            <OpeningsList
              owner={entity}
              rows={rows}
              onChange={(patch) => updateEntity({ ...entity, ...patch })}
              placeholders={placeholders}
              ownerId={entity.id}
              ownerName={name}
              characterName={entity.name}
              empty={null}
            />
          </section>
        );
      })}

      <Hint>
        {openingsEnabled(worldOverview, entities)
          ? 'Draws one opening by weight when a player starts this world. A Player Action fills their input box for them to edit and send. Narration is page one, shown as written.'
          : anyOpenings
            ? "Switched off, so players start on the default opening. Chances show the odds you'll get once it's on."
            : 'Write an opening here or on an entity to switch this on. Until then players start on the default opening.'}
      </Hint>
    </div>
  );
}

/** One entity's openings, for both entity editors. */
export function EntityOpenings({ entity, onChange, placeholders }: {
  entity: Entity;
  onChange: (patch: OpeningOwner) => void;
  placeholders: Placeholder[];
}) {
  return (
    <div className="space-y-2">
      <OpeningsList
        owner={entity}
        rows={ownerOpeningRows(entity)}
        onChange={onChange}
        placeholders={placeholders}
        ownerId={entity.id}
        characterName={entity.name}
        empty={<Hint>No openings yet</Hint>}
      />
      <Hint>
        {"Drawn with the world's openings when a player starts at one of this entity's locations. The world's switch turns them off too."}
      </Hint>
    </div>
  );
}

/**
 * One owner's openings: a card per row with its kind, text, weight and chance, in draw order, and the Add
 * button. Each edit goes to `onChange` as a patch of the owner's opening fields. A null chance renders as a
 * dash: the row is outside the pool the chances describe.
 */
export function OpeningsList({ owner, rows, onChange, placeholders, ownerId, empty, ownerName, characterName }: {
  owner: OpeningOwner;
  rows: EditorOpeningRow[];
  onChange: (patch: OpeningOwner) => void;
  placeholders: Placeholder[];
  /** The entity whose openings these are. Absent for the world's own. */
  ownerId?: string;
  /** What shows in place of the rows while there are none. */
  empty: ReactNode;
  /** Names the owner in each row's accessible labels, where several owners share one screen. */
  ownerName?: string;
  /** The entity's authored name, which a Character Name chip previews as. */
  characterName?: string;
}) {
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.opening.id === active.id);
    const to = rows.findIndex((r) => r.opening.id === over.id);
    if (from !== -1 && to !== -1) onChange(moveOpening(owner, from, to));
  };

  return (
    <div className="space-y-2">
      {rows.length === 0 ? empty : (
        <EditorDndContext onDragEnd={handleDragEnd}>
          <StableSortableContext items={rows.map((r) => r.opening)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {rows.map(({ opening, weight, chance }, i) => (
                <OpeningCard
                  key={opening.id}
                  opening={opening}
                  label={`Opening ${i + 1}`}
                  a11yLabel={ownerName ? `${ownerName} Opening ${i + 1}` : `Opening ${i + 1}`}
                  weight={weight}
                  chance={chance}
                  placeholders={placeholders}
                  ownerId={ownerId}
                  characterName={characterName}
                  onKind={(kind) => onChange(setOpeningKind(owner, opening.id, kind))}
                  onText={(text) => onChange(setOpeningText(owner, opening.id, text))}
                  onWeight={(w) => onChange(setOpeningWeight(owner, opening.id, w))}
                  onRemove={() => onChange(removeOpening(owner, opening.id))}
                />
              ))}
            </div>
          </StableSortableContext>
        </EditorDndContext>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        aria-label={ownerName ? `Add Opening to ${ownerName}` : undefined}
        onClick={() => onChange(addOpening(owner))}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Add Opening
      </Button>
    </div>
  );
}

const OpeningCard = ({
  opening, label, a11yLabel, weight, chance, placeholders, ownerId, characterName, onKind, onText, onWeight, onRemove,
}: {
  opening: Opening;
  label: string;
  /** The row's accessible name, owner included where several share the screen. */
  a11yLabel: string;
  weight: number;
  chance: number | null;
  placeholders: Placeholder[];
  ownerId?: string;
  characterName?: string;
  onKind: (kind: OpeningKind) => void;
  onText: (text: string) => void;
  onWeight: (weight: number) => void;
  onRemove: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opening.id });
  return (
    <div
      ref={setNodeRef}
      // Translate, not Transform: Transform scales the dragged card to the target slot.
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="rounded-md border bg-card"
      data-testid="opening-row"
    >
      {/* Wraps on a narrow pane: the weight, chance and remove group drops to a second line, right-aligned. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-2 py-1.5">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground"
          aria-label={`Reorder ${a11yLabel}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[4.5rem] flex-1 truncate text-helper font-medium text-muted-foreground">{label}</span>
        <ToggleGroup
          type="single"
          value={opening.kind}
          onValueChange={(v) => { if (v) onKind(v as OpeningKind); }}
          aria-label={`Opens As, ${a11yLabel}`}
          className="h-6"
        >
          <ToggleGroupItem value="action" className="h-6 px-2 text-helper">Player Action</ToggleGroupItem>
          <ToggleGroupItem value="narration" className="h-6 px-2 text-helper">Narration</ToggleGroupItem>
        </ToggleGroup>
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
      <div className="p-2">
        <PlaceholderField
          value={opening.text}
          onChange={onText}
          placeholders={placeholders}
          ownerId={ownerId}
          ownerName={characterName}
          ariaLabel={a11yLabel}
          placeholder={opening.kind === 'narration' ? 'Page one, exactly as the player reads it' : "What the player's first action says"}
          resizable
        />
      </div>
    </div>
  );
};
