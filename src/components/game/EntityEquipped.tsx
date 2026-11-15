import { useState } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { ItemRowArt } from '@/components/ItemIconArt';
import { Meta } from '@/components/ui/typography';
import { useGameplay } from '@/contexts/GameplayContext';
import { visibleItemImage } from '@/lib/imageVisibility';
import { instanceWorthFacts } from '@/lib/currency';
import { instanceItemIcon } from '@/lib/itemIcons';
import { instanceFace, instanceFacts, instanceName, occupiedSlots } from '@/lib/items';
import { visibleWorn } from '@/lib/inventory';
import { playsAs } from '@/lib/owners';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { useViewedGateInput } from '@/lib/useViewedGateInput';
import type { Entity, ItemInstance } from '@/types';
import { ItemModal } from '../modals/ItemModal';

/**
 * An entity's visible equipped items, each under its slot (Q31, Q116), each opening its popup. Carried and
 * hidden Item Instances stay private. Draws nothing when the entity wears nothing the player can see.
 */
export function EntityEquipped({ entity }: { entity: Entity }) {
  const { itemInstances, personaRef } = useGameplay();
  const data = useGameDataOptional();
  const resolveText = usePlaceholderResolver();
  const gateInput = useViewedGateInput();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const worn = visibleWorn(itemInstances, playsAs(entity, personaRef) ? { kind: 'you' } : { kind: 'entity', id: entity.id });
  if (worn.length === 0) return null;
  const slotName = (slotId: string) => resolveText(data?.slots?.find((s) => s.id === slotId)?.name ?? '');
  const itemOf = ({ item: ref }: ItemInstance) => (ref.kind === 'item' ? data?.items?.find((i) => i.id === ref.itemId) : undefined);
  const nameOf = (instance: ItemInstance) => instanceName(instance, data?.items ?? [], [], resolveText);
  const imageOf = (instance: ItemInstance) => {
    const item = itemOf(instance);
    return item && visibleItemImage(item, instance, gateInput);
  };
  const shownIconOf = (instance: ItemInstance) =>
    instanceItemIcon(instance, itemOf(instance), { name: nameOf(instance), slots: data?.slots ?? [], readText: resolveText, image: imageOf(instance) });
  // An instance that left the entity closes its popup.
  const viewing = worn.find((instance) => instance.id === viewingId);
  const viewingItem = viewing && itemOf(viewing);
  return (
    <section aria-label="Equipped" className="flex flex-col gap-1">
      <p className="text-meta uppercase tracking-wide text-muted-foreground">Equipped</p>
      <ul>
        {worn.map((instance) => {
          const item = itemOf(instance);
          return (
            <li key={instance.id} className="relative flex items-center gap-2 rounded-md hover:bg-secondary/60">
              <ItemRowArt shown={shownIconOf(instance)} />
              {/* The name's button covers the row, so the art and the slot open the popup too. */}
              <button
                type="button"
                onClick={() => setViewingId(instance.id)}
                className="rounded-sm text-left after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
              >
                {nameOf(instance)}
              </button>
              <Meta>{occupiedSlots(instance, item).map(slotName).join(' + ')}</Meta>
            </li>
          );
        })}
      </ul>
      {viewing && (
        <ItemModal
          id={viewing.id}
          name={nameOf(viewing)}
          icon={shownIconOf(viewing)}
          image={imageOf(viewing)}
          description={resolveText(viewingItem ? instanceFace(viewingItem, viewing).description ?? '' : '')}
          facts={[...instanceFacts(viewing, viewingItem), ...instanceWorthFacts(viewing, viewingItem, data?.currencies ?? [], resolveText, data?.items ?? [])]}
          isOpen
          onOpenChange={(open) => { if (!open) setViewingId(null); }}
        />
      )}
    </section>
  );
}
