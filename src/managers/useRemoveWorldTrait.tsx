import { useState, type ReactNode } from 'react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { labelPlaceholders } from '@/lib/placementLetters';
import { linksTo } from '@/lib/traitLinks';
import { blueprintItemIds, groupHoldsItems } from '@/lib/traitTree';

/** The line a removal's confirmation adds for the links that go with it. */
const alsoDeletesLinks = (links: number): string =>
  `This also deletes ${links === 1 ? 'its link' : `its ${links} links`}.`;

type Pending = { id: string; name: string; isGroup: boolean; links: number; blueprints: boolean };

/** Delete a world trait or group. Its links go with it, so a linked one asks first, naming the count. A
 *  non-empty Blueprints group asks too, since its traits move to the top level and reach the player, and
 *  the links into it go. */
export function useRemoveWorldTrait(): { ask: (id: string, isGroup: boolean) => void; dialog: ReactNode } {
  const { traits, traitGroups, entities, removeTrait, removeTraitGroup, placeholders } = useTraitStore();
  const [pending, setPending] = useState<Pending | null>(null);
  const remove = (id: string, isGroup: boolean) => (isGroup ? removeTraitGroup(id) : removeTrait(id));
  const ask = (id: string, isGroup: boolean) => {
    const group = isGroup ? traitGroups.find((g) => g.id === id) : undefined;
    const blueprints = group?.system === 'blueprints' && groupHoldsItems({ traits, traitGroups }, id);
    const links = blueprints
      ? [...blueprintItemIds({ traits, traitGroups })].reduce((n, itemId) => n + linksTo(entities, itemId), 0)
      : linksTo(entities, id);
    const name = (group ?? traits.find((t) => t.id === id))?.name ?? '';
    if (links || blueprints) setPending({ id, name, isGroup, links, blueprints });
    else remove(id, isGroup);
  };
  const title = pending?.blueprints
    ? `Remove ${labelPlaceholders(pending.name, placeholders)}?`
    : `Delete ${labelPlaceholders(pending?.name ?? '', placeholders)}?`;
  const description = pending?.blueprints
    ? `Its traits move to the top level, where the player can pick them.${pending.links ? ` ${alsoDeletesLinks(pending.links)}` : ''}`
    : alsoDeletesLinks(pending?.links ?? 0);
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(open) => { if (!open) setPending(null); }}
      title={title}
      description={description}
      onConfirm={() => {
        if (pending) remove(pending.id, pending.isGroup);
        setPending(null);
      }}
    />
  );
  return { ask, dialog };
}
