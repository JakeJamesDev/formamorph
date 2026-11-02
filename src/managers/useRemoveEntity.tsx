import { useState, type ReactNode } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { backingStatKind, lostStatIds } from '@/lib/currencyDeletes';
import { labelPlaceholders } from '@/lib/placementLetters';
import { usedByText } from '@/lib/usedByText';
import { customPersonaCounts, deleteLine } from '@/lib/customPersona';

type Pending = { id: string; name: string; line: string };

/** Delete an entity. The Custom Persona entity asks first, naming the links, traits and placeholders that go
 *  with it. Any entity whose own stat backs a Currency asks first, naming the Currency. */
export function useRemoveEntity(): { ask: (id: string) => void; dialog: ReactNode } {
  const { entities, stats, currencies, removeEntity, placeholders } = useGameData();
  const [pending, setPending] = useState<Pending | null>(null);
  const ask = (id: string) => {
    const entity = entities.find((e) => e.id === id);
    const base = entity?.customPersona ? deleteLine(customPersonaCounts(entity)) : null;
    const gone = lostStatIds({ stats, entities }, { stats, entities: entities.filter((e) => e.id !== id) });
    const backed = usedByText([backingStatKind(currencies, gone, (text) => labelPlaceholders(text, placeholders))]);
    const line = [base, backed].filter(Boolean).join(' ');
    if (entity && line) setPending({ id, name: entity.name, line });
    else removeEntity(id);
  };
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(open) => { if (!open) setPending(null); }}
      title={`Delete ${labelPlaceholders(pending?.name ?? '', placeholders)}?`}
      description={pending?.line}
      onConfirm={() => {
        if (pending) removeEntity(pending.id);
        setPending(null);
      }}
    />
  );
  return { ask, dialog };
}
