import { useMemo, useRef, type KeyboardEvent } from 'react';
import { Route, Trash2, X } from 'lucide-react';
import { DESTRUCTIVE_ROW_ACTION_HOVER } from '@/components/EditorRow';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { Hint, Meta } from '@/components/ui/typography';
import { SelectOptions } from '@/components/SelectOptions';
import { canRemoveGenericStartsAt, isGeneric, isUnique, withoutGenericStartsAt, startsOf } from '@/lib/entityKind';
import { startsAt, withStartHere } from '@/lib/entityPresence';
import { fieldFrame } from '@/lib/historyField';
import { presenceLines } from '@/lib/locationPresenceReasons';
import { showRoutineStart, showStartFor } from '@/lib/routineSelection';
import { cn } from '@/lib/utils';
import { EntityPickBody, type PickState } from '@/managers/EntityPickCard';
import type { Connection, Entity, GameLocation } from '@/types';

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const ROW_KEYS: Record<string, (at: number, count: number) => number> = {
  ArrowDown: (at, count) => Math.min(at + 1, count - 1),
  ArrowUp: (at) => Math.max(at - 1, 0),
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * The Entities Here list on a location's Presence tab: every entity that can be at this location, one row each
 * with its reasons, and one editor region under the list for the selected entity. The selection is the World
 * Editor's entity pick, so the canvas beside the panel draws it.
 */
export default function LocationEntitiesHere({ locationId, entities, locations, connections, labelOf, onOpenRoutine, pick, onPickChange, onEditFullScreen, onChange }: {
  locationId: string;
  /** The cast, in the order the tab lists it. */
  entities: Entity[];
  locations: GameLocation[];
  connections: Connection[];
  labelOf: (entity: Entity) => string;
  onOpenRoutine?: (entityId: string) => void;
  /** The pick a selected row holds. */
  pick: PickState | null;
  /** Without it the rows do not select. */
  onPickChange?: (next: PickState | null) => void;
  /** Opens the Locations Canvas in full screen with the pick kept. */
  onEditFullScreen?: () => void;
  onChange: (next: Entity) => void;
}) {
  const lines = useMemo(
    () => presenceLines(locationId, entities, { locations, connections }),
    [locationId, entities, locations, connections],
  );
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = pick ? lines.find((line) => line.entity.id === pick.entityId)?.entity : undefined;
  const selectedAt = selected ? lines.findIndex((line) => line.entity === selected) : -1;

  // Only a Generic entity that begins here has a remove button; the other rows keep its column so the icons line up.
  const removable = (entity: Entity) => isGeneric(entity) && startsAt(entity, locationId);
  const anyRemovable = lines.some((line) => removable(line.entity));

  // The cast with no row here, in the order given. The persona has no kind, so it is never listed.
  const addable = useMemo(() => {
    const listed = new Set(lines.map((line) => line.entity.id));
    return entities.filter((e) => (isGeneric(e) || isUnique(e)) && !listed.has(e.id));
  }, [lines, entities]);

  const add = (id: string) => {
    const entity = addable.find((e) => e.id === id);
    if (!entity) return;
    const next = withStartHere(entity, locationId);
    onChange(next);
    // The editor opens in Routine mode on the Start this added.
    showRoutineStart(entity.id, startsOf(next).at(-1)?.id ?? null);
    onPickChange?.({ entityId: entity.id, mode: 'locations' });
  };

  const toggle = (entity: Entity) => {
    if (selected !== entity) showStartFor(entity, locationId);
    onPickChange?.(selected === entity ? null : { entityId: entity.id, mode: pick?.mode ?? 'locations' });
  };

  const moveFocus = (event: KeyboardEvent, at: number) => {
    const to = ROW_KEYS[event.key]?.(at, lines.length);
    if (to === undefined) return;
    event.preventDefault();
    rowRefs.current[to]?.focus();
  };

  return (
    <div className="space-y-2" data-testid="entities-here">
      <Label className="block">Entities Here</Label>
      <Hint>Lists each entity that can be here, and why</Hint>
      {lines.length === 0 && <Hint>No entity can be here</Hint>}
      {lines.length > 0 && (
        <ul aria-label="Entities Here" className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {lines.map(({ entity, reasons }, at) => {
            const label = labelOf(entity);
            const isSelected = entity === selected;
            const reasonText = capitalized(reasons.join(', '));
            return (
              <li
                key={entity.id}
                data-testid="presence-row"
                className={cn('flex items-center gap-1 pr-1', isSelected ? 'bg-accent' : 'hover:bg-accent/60')}
              >
                <button
                  ref={(el) => { rowRefs.current[at] = el; }}
                  type="button"
                  aria-current={isSelected ? 'true' : undefined}
                  aria-label={`${label}, ${reasonText}`}
                  disabled={!onPickChange}
                  tabIndex={at === Math.max(selectedAt, 0) ? 0 : -1}
                  onClick={() => toggle(entity)}
                  onKeyDown={(event) => moveFocus(event, at)}
                  className={cn(
                    'flex min-w-0 flex-1 items-baseline gap-2 py-2 pl-3 text-left outline-none disabled:cursor-default',
                    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  )}
                >
                  <span className={cn('max-w-[60%] shrink-0 truncate text-label', isSelected && 'font-medium')}>{label}</span>
                  <Meta className="min-w-0 flex-1 truncate">{reasonText}</Meta>
                </button>
                {onOpenRoutine && (
                  <Tip tip={`Open ${label}’s Routine`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Open ${label}’s Routine`} onClick={() => onOpenRoutine(entity.id)}>
                      <Route className="h-4 w-4" />
                    </Button>
                  </Tip>
                )}
                {!removable(entity) && anyRemovable && <span aria-hidden className="h-8 w-8 shrink-0" />}
                {removable(entity) && (
                  canRemoveGenericStartsAt(entity, locationId)
                    ? (
                      <Tip tip={`Remove ${label} from this location`}>
                        <Button variant="ghost" size="icon" className={cn('h-8 w-8 shrink-0', DESTRUCTIVE_ROW_ACTION_HOVER)} onClick={() => onChange(withoutGenericStartsAt(entity, locationId))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tip>
                    )
                    : (
                      // A disabled button takes no pointer events, so the span carries the reason.
                      <Tip tip={`${label} begins at no other location, so it stays here`}>
                        <span tabIndex={0} className="inline-flex shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled aria-label={`Remove ${label} from this location`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </span>
                      </Tip>
                    )
                )}
              </li>
            );
          })}
        </ul>
      )}
      {selected && onPickChange
        ? (
          <section aria-label={labelOf(selected)} data-testid="presence-editor" className="space-y-3 rounded-md border bg-card p-3">
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate font-medium">{labelOf(selected)}</span>
              <Tip tip="Close Entity">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onPickChange(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </Tip>
            </div>
            <EntityPickBody entity={selected} picking={pick} onPickingChange={onPickChange} onChange={onChange} hereMark={locationId} onEditFullScreen={onEditFullScreen} />
          </section>
        )
        : lines.length > 0 && onPickChange && <Hint>Select an entity to edit its Routine and Known In</Hint>}
      {addable.length > 0 && (
        <div {...fieldFrame('entities')}>
          <Select value="" onValueChange={add}>
            <SelectTrigger aria-label="Add an entity here">
              <SelectValue placeholder="Add an entity here" />
            </SelectTrigger>
            <SelectContent>
              <SelectOptions options={addable.map((e) => ({ value: e.id, label: labelOf(e) }))} />
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
