import { useGameData } from '@/contexts/GameDataContext';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fieldFrame } from '@/lib/historyField';
import { bodyLabel } from '@/lib/bodies';
import type { Body, BodyPick, Entity } from '@/types';

const DEFAULT = 'default';
const NONE = 'none';

// A pick naming a Body the world lacks shows as Default, which is what it resolves to (Q33).
const pickValue = (pick: BodyPick | undefined, bodies: readonly Body[]) =>
  pick?.kind === 'none' ? NONE : pick && bodies.some((b) => b.id === pick.id) ? pick.id : DEFAULT;

/** An entity's Body pick, above its starting items: Default (the first Body), None, then each Body (Q28). */
const EntityBodyField = ({ entity }: { entity: Entity }) => {
  const { bodies, editEntity } = useGameData();
  const write = (value: string) => editEntity(entity.id, (e) => {
    const { body: _drop, ...rest } = e;
    return value === DEFAULT ? rest : { ...rest, body: value === NONE ? { kind: 'none' } : { kind: 'body', id: value } };
  });

  return (
    <div className="space-y-2" {...fieldFrame('entities', entity.id, 'body')}>
      <Label id="entity-body-label">Body</Label>
      {bodies[0] ? (
        <>
          <Select value={pickValue(entity.body, bodies)} onValueChange={write}>
            <SelectTrigger aria-labelledby="entity-body-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Default ({bodyLabel(bodies[0])})</SelectItem>
              <SelectItem value={NONE}>None</SelectItem>
              {bodies.map((b) => <SelectItem key={b.id} value={b.id}>{bodyLabel(b)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Hint>
            {entity.customPersona ? "Also sets the player's Body when they pick None or a library persona" : 'Sets which slots this entity can equip items into'}
          </Hint>
        </>
      ) : (
        <Hint>Add a Body in <b>Equipment Settings</b> to give this entity slots</Hint>
      )}
    </div>
  );
};

export default EntityBodyField;
