import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpButton } from '@/components/HelpButton';
import { PinConflictNote } from '@/components/editor/PinConflictNote';
import { PinValueField } from '@/components/editor/PinValueField';
import {
  addPinAt, PIN_KINDS, pinSourceKey, pinSourceOwnerId, pinSourcesOfKind, pinsTargeting, removePinAt,
  sameSource, updatePinAt,
  type PinEditorWorld, type PinRow, type PinSourceKind, type PinSourceRef,
} from '@/lib/placeholderPins';
import type { GameLocation, Placeholder, PlaceholderPin, Stat, Trait } from '@/types';

/** The world the section reads pins from and writes them back to: the four source lists, and the writer
 *  for each. The world editor's data store is one. */
export interface PinsWorld extends PinEditorWorld {
  updateTrait: (trait: Trait) => void;
  updateLocation: (location: GameLocation) => void;
  updateStat: (stat: Stat) => void;
  updatePlaceholder: (placeholder: Placeholder) => void;
}

/**
 * Every pin aimed at one placeholder, from any source, as one list: strongest kind first, each row naming
 * its source. The pins live on their sources — this section only gathers them — so a value edit, a re-aim
 * or a removal here is written to the trait, location, stat or placeholder that holds the pin. Add picks
 * the kind of source, then the source, and writes an empty pin there for the row's value field to fill.
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
  const options = (kind: PinSourceKind) => pinSourcesOfKind(world, kind, placeholder.id);

  /** Where a rewritten source of each kind goes back to — one row, so a new source is a row and not a
   *  case. The id is the record the pin sits on, which the source table already names. */
  const writeBack: Record<PinSourceKind, (next: PinEditorWorld, id: string) => void> = {
    trait: (next, id) => { const t = next.traits?.find((x) => x.id === id); if (t) world.updateTrait(t); },
    location: (next, id) => { const l = next.locations?.find((x) => x.id === id); if (l) world.updateLocation(l); },
    descriptor: (next, id) => { const s = next.stats?.find((x) => x.id === id); if (s) world.updateStat(s); },
    value: (next, id) => { const p = next.placeholders.find((x) => x.id === id); if (p) world.updatePlaceholder(p); },
  };
  /** Hand each source that `next` rewrote back to its writer. `next` carries every change at once, so a
   *  source written twice lands the same record twice, which is harmless. */
  const commit = (next: PinEditorWorld, ...sources: PinSourceRef[]) => {
    for (const source of sources) writeBack[source.kind](next, pinSourceOwnerId(source));
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

  const draftOptions = draft?.kind ? options(draft.kind) : [];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>Placeholder Pins</Label>
        <HelpButton topicId="worldEditor.pinsOnPlaceholder" className="h-6 w-6" />
      </div>
      {rows.length === 0 && !draft && (
        <p className="text-helper text-muted-foreground">Nothing pins this placeholder.</p>
      )}
      {rows.map((row, index) => (
        <div key={`${pinSourceKey(row.source)}:${index}`} className="space-y-1">
          <div className="flex space-x-2">
            <Select value={pinSourceKey(row.source)} onValueChange={(key) => {
              const picked = options(row.source.kind).find((o) => pinSourceKey(o.source) === key);
              if (picked) reaim(row, picked.source);
            }}>
              {/* The row's own label stands in for the picked item: it carries the kind a bare name would not. */}
              <SelectTrigger aria-label="Pin Source">
                <SelectValue>{row.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options(row.source.kind).map((o) => (
                  <SelectItem key={pinSourceKey(o.source)} value={pinSourceKey(o.source)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={draft.kind ?? ''} onValueChange={(v) => setDraft({ kind: v as PinSourceKind })}>
              <SelectTrigger aria-label="Pin Kind">
                <SelectValue placeholder="Kind of source" />
              </SelectTrigger>
              <SelectContent>
                {PIN_KINDS.map((k) => <SelectItem key={k.kind} value={k.kind}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {draft.kind && (
              <Select value="" onValueChange={(key) => {
                const picked = draftOptions.find((o) => pinSourceKey(o.source) === key);
                if (picked) add(picked.source);
              }}>
                <SelectTrigger aria-label="New Pin Source">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {draftOptions.map((o) => (
                    <SelectItem key={pinSourceKey(o.source)} value={pinSourceKey(o.source)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="icon" aria-label="Cancel New Pin" onClick={() => setDraft(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {draft.kind && draftOptions.length === 0 && (
            <p className="text-meta text-muted-foreground pl-1">{PIN_KINDS.find((k) => k.kind === draft.kind)?.empty}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default PlaceholderPinsSection;
