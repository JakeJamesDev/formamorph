import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SelectOptions } from '@/components/SelectOptions';
import { Tip } from '@/components/ui/tooltip';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';
import { YOU_TARGET, playsOnlyWhenPicked } from '@/lib/entityRelationships';
import type { Entity, EntityRelationship } from '@/types';

const PERSONA_ROW = { value: YOU_TARGET, label: 'Persona', role: 'Persona’s Role' };
const UNKNOWN_ROW = { value: '', label: 'Unknown Entity', role: 'Unknown Entity’s Role' };

/** The Relationships list of an entity's Profile tab: one row per target with its role label and **Remove**,
 *  and a select that adds a target the entity doesn't use yet, Persona first. The Persona row isn't offered to
 *  an entity that plays only when picked. A row whose target the world lacks shows as an unknown entity, so it
 *  can be removed. */
export default function EntityRelationshipsField({ entity, entities, labelOf, onChange }: {
  entity: Entity;
  /** The world's entities, in the order the select lists them. */
  entities: Entity[];
  labelOf: (entity: Entity) => string;
  onChange: (relationships: EntityRelationship[]) => void;
}) {
  const relationships = useMemo(() => entity.relationships ?? [], [entity.relationships]);
  // Every target the owner can hold, Persona first, each with its row's input name.
  const targets = useMemo(() => [
    ...(playsOnlyWhenPicked(entity) ? [] : [PERSONA_ROW]),
    ...entities.filter((e) => e.id !== entity.id).map((e) => ({ value: e.id, label: labelOf(e), role: `${labelOf(e)}’s Role` })),
  ], [entities, entity, labelOf]);
  const targetOf = useMemo(() => new Map(targets.map((t) => [t.value, t])), [targets]);
  // A stored row the select can't offer still shows, so the author can remove it.
  const rowOf = (targetId: string) => targetOf.get(targetId) ?? (targetId === YOU_TARGET ? PERSONA_ROW : UNKNOWN_ROW);
  const addable = useMemo(() => {
    const used = new Set(relationships.map((r) => r.targetId));
    return targets.filter((t) => !used.has(t.value));
  }, [targets, relationships]);
  // The row just added takes focus, so the author types its label next.
  const [added, setAdded] = useState<string | null>(null);
  const addedRef = useRef<HTMLInputElement>(null);
  const focusNewRow = useRef(false);

  const setLabel = (targetId: string, label: string) =>
    onChange(relationships.map((r) => (r.targetId === targetId ? { ...r, label } : r)));

  return (
    <div className="space-y-2" {...fieldFrame('relationships')}>
      <Label className="block">Relationships</Label>
      <Hint>Type each entity’s role to this one, such as mother or rival</Hint>
      {relationships.map(({ targetId, label }) => {
        const target = rowOf(targetId);
        return (
          <div key={targetId} className="flex items-center gap-2" {...fieldFrame('relationships', targetId, 'label')}>
            <span className="w-1/3 min-w-0 shrink-0 truncate font-medium">{target.label}</span>
            <WorldInput
              ref={targetId === added ? addedRef : undefined}
              aria-label={target.role}
              value={label}
              onChange={(e) => setLabel(targetId, e.target.value)}
              placeholder="mother, friend, rival"
              className="min-w-0 flex-1"
            />
            <Tip tip="Remove this relationship">
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onChange(relationships.filter((r) => r.targetId !== targetId))}>
                Remove
              </Button>
            </Tip>
          </div>
        );
      })}
      <Select
        value=""
        onValueChange={(targetId) => {
          if (!targetOf.has(targetId)) return;
          onChange([...relationships, { targetId, label: '' }]);
          setAdded(targetId);
          focusNewRow.current = true;
        }}
        disabled={addable.length === 0}
      >
        <SelectTrigger aria-label="Add a Relationship">
          <SelectValue placeholder="Add a relationship" />
        </SelectTrigger>
        {/* A pick hands focus to the new row's label, so the select doesn't take it back on close. */}
        <SelectContent onCloseAutoFocus={(e) => { if (focusNewRow.current) { e.preventDefault(); focusNewRow.current = false; addedRef.current?.focus(); } }}>
          <SelectOptions options={addable} />
        </SelectContent>
      </Select>
    </div>
  );
}
