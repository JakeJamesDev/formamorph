import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useGameData } from '@/contexts/GameDataContext';
import { backingStatKind, lostStatIds } from '@/lib/currencyDeletes';
import { labelPlaceholders } from '@/lib/placementLetters';
import { usedByText } from '@/lib/usedByText';
import type { Entity } from '@/types';

type Removal = (entity: Entity) => Entity;
type Pending = { entityId: string; remove: Removal; name: string; text: string };

/**
 * An entity's own stat or stat group delete. One that leaves a Currency without its stat asks first, naming the
 * Currency it makes name only; any other goes at once. The cleanup rides the entity edit.
 */
export function useOwnedStatDelete(): { ask: (entityId: string, remove: Removal, name?: string) => void; dialog: ReactNode } {
  const { stats, entities, currencies, placeholders, editEntity } = useGameData();
  const [pending, setPending] = useState<Pending | null>(null);
  const ask = (entityId: string, remove: Removal, name = '') => {
    const before = entities.find((entity) => entity.id === entityId);
    if (!before) return;
    const next = entities.map((entity) => (entity === before ? remove(before) : entity));
    const gone = lostStatIds({ stats, entities }, { stats, entities: next });
    const text = usedByText([backingStatKind(currencies, gone, (label) => labelPlaceholders(label, placeholders))]);
    if (text) setPending({ entityId, remove, name, text });
    else editEntity(entityId, remove);
  };
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(open) => { if (!open) setPending(null); }}
      title={`Delete ${labelPlaceholders(pending?.name ?? '', placeholders) || 'Stat'}?`}
      description={pending?.text ?? ''}
      confirmLabel="Delete"
      destructive
      onConfirm={() => {
        if (pending) editEntity(pending.entityId, pending.remove);
        setPending(null);
      }}
    />
  );
  return { ask, dialog };
}
