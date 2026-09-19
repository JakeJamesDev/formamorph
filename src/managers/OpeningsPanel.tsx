import type { ReactNode } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import PlaceholderField from '@/components/prompt/PlaceholderField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import {
  addOpening, DEFAULT_OPENING, moveOpening, openingChances, openingsEnabled, openingWeight, removeOpening,
  setOpeningKind, setOpeningText, setOpeningWeight, type OpeningOwner,
} from '@/lib/openings';
import type { Entity, Opening, OpeningKind, Placeholder } from '@/types';

/** The world's openings, with the default opening shown while the list is empty and the switch's effect. */
export function OpeningsPanel() {
  const { worldOverview, updateWorldOverview, placeholders } = useGameData();
  return (
    <div className="space-y-2">
      <OpeningsList
        owner={worldOverview}
        onChange={updateWorldOverview}
        placeholders={placeholders}
        empty={(
          <div className="space-y-1">
            <Hint>No openings yet. Players start on the default opening.</Hint>
            <div
              role="note"
              aria-label="Default opening"
              className="whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 text-helper text-muted-foreground"
            >
              {DEFAULT_OPENING.text}
            </div>
          </div>
        )}
      />
      <Hint>
        {openingsEnabled(worldOverview)
          ? 'Draws one opening by weight when a player starts this world. A Player Action fills their input box for them to edit and send. Narration is page one, shown as written.'
          : 'Not applied until you switch the list on. Players start on the default opening.'}
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
      <OpeningsList owner={entity} onChange={onChange} placeholders={placeholders} empty={<Hint>No openings yet</Hint>} />
      <Hint>
        {"Drawn with the world's openings when a player starts at a location this entity is at. The world's switch turns them off too."}
      </Hint>
    </div>
  );
}

/**
 * One owner's openings: a card per row with its kind, text, weight and chance, in draw order, and the Add
 * button. The world panel and both entity editors render this, and each edit goes to `onChange` as a patch
 * of the owner's opening fields.
 */
export function OpeningsList({ owner, onChange, placeholders, empty }: {
  owner: OpeningOwner;
  onChange: (patch: OpeningOwner) => void;
  placeholders: Placeholder[];
  /** What shows in place of the rows while there are none. */
  empty: ReactNode;
}) {
  const openings = owner.openings ?? [];
  const chances = openingChances(owner);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = openings.findIndex((o) => o.id === active.id);
    const to = openings.findIndex((o) => o.id === over.id);
    if (from !== -1 && to !== -1) onChange(moveOpening(owner, from, to));
  };

  return (
    <div className="space-y-2">
      {openings.length === 0 ? empty : (
        <EditorDndContext onDragEnd={handleDragEnd}>
          <StableSortableContext items={openings} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {openings.map((opening, i) => (
                <OpeningCard
                  key={opening.id}
                  opening={opening}
                  index={i}
                  weight={openingWeight(owner.openingWeights, opening.id)}
                  chance={chances[opening.id] ?? 0}
                  placeholders={placeholders}
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
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onChange(addOpening(owner))}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add Opening
      </Button>
    </div>
  );
}

const OpeningCard = ({
  opening, index, weight, chance, placeholders, onKind, onText, onWeight, onRemove,
}: {
  opening: Opening;
  index: number;
  weight: number;
  chance: number;
  placeholders: Placeholder[];
  onKind: (kind: OpeningKind) => void;
  onText: (text: string) => void;
  onWeight: (weight: number) => void;
  onRemove: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opening.id });
  const label = `Opening ${index + 1}`;
  return (
    <div
      ref={setNodeRef}
      // Translate, not Transform: Transform scales the dragged card to the target slot.
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="rounded-md border bg-card"
      data-testid="opening-row"
    >
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground"
          aria-label={`Reorder ${label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-helper font-medium text-muted-foreground">{label}</span>
        <ToggleGroup
          type="single"
          value={opening.kind}
          onValueChange={(v) => { if (v) onKind(v as OpeningKind); }}
          aria-label={`Opens as, ${label}`}
          className="h-6"
        >
          <ToggleGroupItem value="action" className="h-6 px-2 text-helper">Player Action</ToggleGroupItem>
          <ToggleGroupItem value="narration" className="h-6 px-2 text-helper">Narration</ToggleGroupItem>
        </ToggleGroup>
        <Input
          type="number"
          min={0}
          step={1}
          value={weight}
          onChange={(e) => onWeight(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          className="h-6 w-14 px-1.5 text-helper"
          aria-label={`Draw weight for ${label}`}
          title="Draw weight"
        />
        <span className="w-10 text-right text-meta text-muted-foreground" aria-label={`Chance for ${label}`}>
          {Math.round(chance)}%
        </span>
        <Tip tip="Remove opening" labelsChild={false}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={`Remove ${label}`}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Tip>
      </div>
      <div className="p-2">
        <PlaceholderField
          value={opening.text}
          onChange={onText}
          placeholders={placeholders}
          ariaLabel={label}
          placeholder={opening.kind === 'narration' ? 'Page one, exactly as the player reads it' : "What the player's first action says"}
          resizable
        />
      </div>
    </div>
  );
};
