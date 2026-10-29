import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { byEquipOrder } from '@/lib/items';
import { copiesAt } from '@/lib/inventory';
import { playsAs } from '@/lib/owners';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import type { Entity } from '@/types';

/**
 * An entity's visible equipped items, each under its slot (Q31, Q116). Carried and hidden Item Copies stay
 * private. Draws nothing when the entity wears nothing the player can see.
 */
export function EntityEquipped({ entity }: { entity: Entity }) {
  const { itemCopies, personaRef } = useGameplay();
  const data = useGameDataOptional();
  const resolveText = usePlaceholderResolver();
  const worn = copiesAt(itemCopies, playsAs(entity, personaRef) ? { kind: 'you' } : { kind: 'entity', id: entity.id })
    .filter((c) => c.equipped && c.visibility === 'visible')
    .sort(byEquipOrder)
    .map((copy) => ({ copy, slotId: copy.equipped?.slotId ?? '' }));
  if (worn.length === 0) return null;
  const slotName = (slotId: string) => resolveText(data?.slots?.find((s) => s.id === slotId)?.name ?? '');
  return (
    <section aria-label="Equipped" className="flex flex-col gap-1">
      <p className="text-meta uppercase tracking-wide text-muted-foreground">Equipped</p>
      <ul>
        {worn.map(({ copy, slotId }) => {
          const ref = copy.item;
          const item = ref.kind === 'item' ? data?.items?.find((i) => i.id === ref.itemId) : undefined;
          return (
            <li key={copy.id} className="flex items-baseline gap-2">
              <span>{resolveText(item?.name ?? '') || 'Unknown Item'}</span>
              <span className="text-meta text-muted-foreground">{slotName(slotId)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
