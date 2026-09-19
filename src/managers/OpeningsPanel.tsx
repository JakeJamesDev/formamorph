import { type DragEndEvent } from '@dnd-kit/core';
import { useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import PlaceholderField from '@/components/prompt/PlaceholderField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import {
  addOpening, DEFAULT_OPENING, moveOpening, openingChances, openingsEnabled, openingWeight, removeOpening,
  setOpeningText, setOpeningWeight,
} from '@/lib/openings';
import type { Opening, Placeholder } from '@/types';

/** The world's openings: one card per row with its text, weight and chance, in draw order. */
export function OpeningsPanel() {
  const { worldOverview, updateWorldOverview, placeholders } = useGameData();
  const openings = worldOverview.openings ?? [];
  const chances = openingChances(worldOverview);
  const enabled = openingsEnabled(worldOverview);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = openings.findIndex((o) => o.id === active.id);
    const to = openings.findIndex((o) => o.id === over.id);
    if (from !== -1 && to !== -1) updateWorldOverview(moveOpening(worldOverview, from, to));
  };

  return (
    <div className="space-y-2">
      {openings.length === 0 ? (
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
      ) : (
        <EditorDndContext onDragEnd={handleDragEnd}>
          <StableSortableContext items={openings} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {openings.map((opening, i) => (
                <OpeningCard
                  key={opening.id}
                  opening={opening}
                  index={i}
                  weight={openingWeight(worldOverview.openingWeights, opening.id)}
                  chance={chances[opening.id] ?? 0}
                  placeholders={placeholders}
                  onText={(text) => updateWorldOverview(setOpeningText(worldOverview, opening.id, text))}
                  onWeight={(w) => updateWorldOverview(setOpeningWeight(worldOverview, opening.id, w))}
                  onRemove={() => updateWorldOverview(removeOpening(worldOverview, opening.id))}
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
        onClick={() => updateWorldOverview(addOpening(worldOverview))}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Add Opening
      </Button>
      <Hint>
        {enabled
          ? 'Draws one opening by weight when a player starts this world and fills their input box with it. They can edit it before they send it.'
          : 'Not applied until you switch the list on. Players start on the default opening.'}
      </Hint>
    </div>
  );
}

const OpeningCard = ({
  opening, index, weight, chance, placeholders, onText, onWeight, onRemove,
}: {
  opening: Opening;
  index: number;
  weight: number;
  chance: number;
  placeholders: Placeholder[];
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
          placeholder="What the player's first action says"
          resizable
        />
      </div>
    </div>
  );
};
