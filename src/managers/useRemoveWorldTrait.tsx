import { useState, type ReactNode } from 'react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { labelPlaceholders } from '@/lib/placementLetters';
import { linksTo } from '@/lib/traitLinks';

/** Delete a world trait or group. Its links go with it, so a linked one asks first, naming the count. */
export function useRemoveWorldTrait(): { ask: (id: string, isGroup: boolean) => void; dialog: ReactNode } {
  const { traits, traitGroups, entities, removeTrait, removeTraitGroup, placeholders } = useTraitStore();
  const [pending, setPending] = useState<{ id: string; name: string; isGroup: boolean; links: number } | null>(null);
  const remove = (id: string, isGroup: boolean) => (isGroup ? removeTraitGroup(id) : removeTrait(id));
  const ask = (id: string, isGroup: boolean) => {
    const links = linksTo(entities, id);
    const name = (isGroup ? traitGroups.find((g) => g.id === id)?.name : traits.find((t) => t.id === id)?.name) ?? '';
    if (links) setPending({ id, name, isGroup, links });
    else remove(id, isGroup);
  };
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(open) => { if (!open) setPending(null); }}
      title={`Delete ${labelPlaceholders(pending?.name ?? '', placeholders)}?`}
      description={`This also deletes ${pending?.links === 1 ? 'its link' : `its ${pending?.links ?? 0} links`}.`}
      onConfirm={() => {
        if (pending) remove(pending.id, pending.isGroup);
        setPending(null);
      }}
    />
  );
  return { ask, dialog };
}
