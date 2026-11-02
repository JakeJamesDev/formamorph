import { useState } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { ItemRowArt } from '@/components/ItemIconArt';
import { Meta } from '@/components/ui/typography';
import { useGameplay } from '@/contexts/GameplayContext';
import { visibleItemImage } from '@/lib/imageVisibility';
import { itemSlotNames, resolveItemIcon } from '@/lib/itemIcons';
import { copyFace, copyFacts, isUnidentified, occupiedSlots } from '@/lib/items';
import { visibleWorn } from '@/lib/inventory';
import { playsAs } from '@/lib/owners';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { useViewedGateInput } from '@/lib/useViewedGateInput';
import type { Entity, ItemCopy } from '@/types';
import { ItemModal } from '../modals/ItemModal';

/**
 * An entity's visible equipped items, each under its slot (Q31, Q116), each opening its popup. Carried and
 * hidden Item Copies stay private. Draws nothing when the entity wears nothing the player can see.
 */
export function EntityEquipped({ entity }: { entity: Entity }) {
  const { itemCopies, personaRef } = useGameplay();
  const data = useGameDataOptional();
  const resolveText = usePlaceholderResolver();
  const gateInput = useViewedGateInput();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const worn = visibleWorn(itemCopies, playsAs(entity, personaRef) ? { kind: 'you' } : { kind: 'entity', id: entity.id });
  if (worn.length === 0) return null;
  const slotName = (slotId: string) => resolveText(data?.slots?.find((s) => s.id === slotId)?.name ?? '');
  const itemOf = ({ item: ref }: ItemCopy) => (ref.kind === 'item' ? data?.items?.find((i) => i.id === ref.itemId) : undefined);
  const nameOf = (copy: ItemCopy) => {
    const item = itemOf(copy);
    return resolveText(item ? copyFace(item, copy).name : '') || 'Unknown Item';
  };
  const imageOf = (copy: ItemCopy) => {
    const item = itemOf(copy);
    return item && visibleItemImage(item, copy, gateInput);
  };
  const iconOf = (copy: ItemCopy) => {
    const item = itemOf(copy);
    return resolveItemIcon({
      icon: item?.icon,
      name: nameOf(copy),
      slotNames: itemSlotNames(item, data?.slots ?? [], resolveText),
      unidentified: isUnidentified(copy),
      image: imageOf(copy),
    });
  };
  // A copy that left the entity closes its popup.
  const viewing = worn.find((copy) => copy.id === viewingId);
  const viewingItem = viewing && itemOf(viewing);
  return (
    <section aria-label="Equipped" className="flex flex-col gap-1">
      <p className="text-meta uppercase tracking-wide text-muted-foreground">Equipped</p>
      <ul>
        {worn.map((copy) => {
          const item = itemOf(copy);
          return (
            <li key={copy.id} className="relative flex items-center gap-2 rounded-md hover:bg-secondary/60">
              <ItemRowArt shown={iconOf(copy)} />
              {/* The name's button covers the row, so the art and the slot open the popup too. */}
              <button
                type="button"
                onClick={() => setViewingId(copy.id)}
                className="rounded-sm text-left after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
              >
                {nameOf(copy)}
              </button>
              <Meta>{occupiedSlots(copy, item).map(slotName).join(' + ')}</Meta>
            </li>
          );
        })}
      </ul>
      {viewing && (
        <ItemModal
          id={viewing.id}
          name={nameOf(viewing)}
          icon={iconOf(viewing)}
          image={imageOf(viewing)}
          description={resolveText(viewingItem ? copyFace(viewingItem, viewing).description ?? '' : '')}
          facts={copyFacts(viewing, viewingItem)}
          isOpen
          onOpenChange={(open) => { if (!open) setViewingId(null); }}
        />
      )}
    </section>
  );
}
