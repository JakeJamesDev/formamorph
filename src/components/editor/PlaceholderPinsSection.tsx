import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { HelpButton } from '@/components/HelpButton';
import { PinConflictNote } from '@/components/editor/PinConflictNote';
import { PinValueField } from '@/components/editor/PinValueField';
import { OnDemandSelect } from '@/components/OnDemandSelect';
import type { SelectOption } from '@/components/SelectOptions';
import { fieldFrame } from '@/lib/historyField';
import {
  addPinAt, commitPinSource, pinKindsFor, pinSourceKey, pinSourcesOfKind, pinsTargeting,
  removePinAt, sameSource, updatePinAt,
  type PinEditorWorld, type PinRow, type PinSourceKind, type PinSourceOption, type PinSourceRef,
} from '@/lib/placeholderPins';
import type { Entity, GameLocation, Placeholder, PlaceholderPin, Stat, Trait } from '@/types';

/** The world the section reads pins from and writes them back to: the four source lists, and the writer
 *  for each. The world editor's data store is one. */
export interface PinsWorld extends PinEditorWorld {
  updateTrait: (trait: Trait) => void;
  updateEntity: (entity: Entity) => void;
  updateLocation: (location: GameLocation) => void;
  updateStat: (stat: Stat) => void;
  updatePlaceholder: (placeholder: Placeholder) => void;
}

/**
 * Every pin aimed at one placeholder, from any source, as one list: strongest kind first, each row naming
 * its source. The pins live on their sources — this section only gathers them — so a value edit, a re-aim
 * or a removal here is written to the trait, location, stat or placeholder that holds the pin. A link's
 * overridden pins list lists too, under its bearer: its source is fixed, and an edit rewrites the override.
 * Add picks the kind of source, then the source, and writes an empty pin there for the row's
 * value field to fill.
 */
export function PlaceholderPinsSection({ world, placeholder }: {
  world: PinsWorld;
  /** The placeholder the section is about: what every row's pin aims at. */
  placeholder: Placeholder;
}) {
  // The add flow in progress: null while closed, then the kind picked so far.
  const [draft, setDraft] = useState<{ kind: PinSourceKind | null } | null>(null);
  const placeholders = world.placeholders;
  const rows = useMemo(() => pinsTargeting(world, placeholder.id), [world, placeholder.id]);
  // Each kind's sources, built on first use: every row of a kind shares one list.
  const choicesOf = useMemo(() => {
    const cache = new Map<PinSourceKind, { sources: PinSourceOption[]; items: SelectOption[] }>();
    return (kind: PinSourceKind) => {
      let choices = cache.get(kind);
      if (!choices) {
        const sources = pinSourcesOfKind(world, kind, placeholder.id);
        choices = { sources, items: sources.map((o) => ({ value: pinSourceKey(o.source), label: o.label })) };
        cache.set(kind, choices);
      }
      return choices;
    };
  }, [world, placeholder.id]);
  const pickFrom = (kind: PinSourceKind, key: string) => choicesOf(kind).sources.find((o) => pinSourceKey(o.source) === key);
  const kinds = pinKindsFor(world, placeholder.id);

  /** Hand each source that `next` rewrote back to its writer. `next` carries every change at once, so a
   *  source written twice lands the same record twice, which is harmless. */
  const commit = (next: PinEditorWorld, ...sources: PinSourceRef[]) => {
    for (const source of sources) commitPinSource(next, source, world);
  };
  const setPin = (row: PinRow, next: PlaceholderPin) => commit(updatePinAt(world, row.source, row.pin, next), row.source);
  const remove = (row: PinRow) => commit(removePinAt(world, row.source, row.pin), row.source);
  const reaim = (row: PinRow, target: PinSourceRef) => {
    if (sameSource(row.source, target)) return;
    commit(addPinAt(removePinAt(world, row.source, row.pin), target, row.pin), row.source, target);
  };
  const add = (source: PinSourceRef) => {
    commit(addPinAt(world, source, { placeholderId: placeholder.id, value: '' }), source);
    setDraft(null);
  };

  const draftOptions = draft?.kind ? choicesOf(draft.kind).items : [];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>Placeholder Pins</Label>
        <HelpButton topicId="worldEditor.pinsOnPlaceholder" className="h-6 w-6" />
      </div>
      {rows.length === 0 && !draft && (
        <p className="text-helper text-muted-foreground">Nothing pins this placeholder</p>
      )}
      {rows.map((row, index) => (
        // A pin has no id, so its source and place in the list name it.
        <div key={`${pinSourceKey(row.source)}:${index}`} className="space-y-1" {...fieldFrame('pins', `${pinSourceKey(row.source)}:${index}`)}>
          <div className="flex space-x-2">
            {/* The row's own label stands in for the picked item: it carries the kind a bare name would not. */}
            <OnDemandSelect
              aria-label="Pin Source"
              value={pinSourceKey(row.source)}
              display={row.label}
              options={() => choicesOf(row.source.kind).items}
              disabled={row.source.kind === 'trait' && !!row.source.link}
              onValueChange={(key) => {
                const picked = pickFrom(row.source.kind, key);
                if (picked) reaim(row, picked.source);
              }}
            />
            <PinValueField pin={row.pin} placeholders={placeholders} onChange={(next) => setPin(row, next)} />
            <Button variant="ghost" size="icon" aria-label="Remove Pin" onClick={() => remove(row)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <PinConflictNote world={world} placeholderId={placeholder.id} source={row.source} />
        </div>
      ))}
      {!draft ? (
        <Button size="sm" onClick={() => setDraft({ kind: null })}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Pin
        </Button>
      ) : (
        <div className="space-y-1">
          <div className="flex space-x-2">
            <OnDemandSelect
              aria-label="Pin Kind"
              value={draft.kind ?? ''}
              placeholder="Kind of source"
              options={() => kinds.map((k) => ({ value: k.kind, label: k.label }))}
              onValueChange={(v) => setDraft({ kind: v as PinSourceKind })}
            />
            {draft.kind && (
              <OnDemandSelect
                aria-label="New Pin Source"
                value=""
                placeholder="Source"
                options={() => draftOptions}
                onValueChange={(key) => {
                  const picked = draft.kind && pickFrom(draft.kind, key);
                  if (picked) add(picked.source);
                }}
              />
            )}
            <Button variant="ghost" size="icon" aria-label="Cancel New Pin" onClick={() => setDraft(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {draft.kind && draftOptions.length === 0 && (
            <p className="text-meta text-muted-foreground pl-1">{kinds.find((k) => k.kind === draft.kind)?.empty}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default PlaceholderPinsSection;
