import { useState, type ReactNode } from 'react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { labelPlaceholders } from '@/lib/placementLetters';
import { linksTo, removeBlueprints, type BlueprintsRemoval } from '@/lib/traitLinks';
import { groupHoldsItems } from '@/lib/traitTree';
import type { Placeholder } from '@/types';

/** The line a removal's confirmation adds for the links that go with it. */
const alsoDeletesLinks = (links: number): string =>
  `This also deletes ${links === 1 ? 'its link' : `its ${links} links`}.`;

/** `A`, `A and B`, `A, B and C`. */
const joined = (names: readonly string[]): string =>
  (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** What removing Blueprints does: the detached links, the stats their copies lose, and the items that move up. */
function blueprintsLine(removal: BlueprintsRemoval, placeholders: Placeholder[]): string {
  const { detached, strippedOn, movedUp } = removal;
  const lines = [
    detached ? `${detached === 1 ? "Its link becomes that entity's own trait" : `Its ${detached} links become each entity's own trait`}, and the linked originals are deleted.` : '',
    strippedOn.length ? `The copies on ${joined(strippedOn.map((n) => labelPlaceholders(n, placeholders)))} lose their stat changes and stat toggles.` : '',
    movedUp ? `${detached ? 'The other traits move' : 'Its traits move'} to the top level, where the player can pick them.` : '',
  ];
  return lines.filter(Boolean).join(' ');
}

type Pending = { id: string; name: string; isGroup: boolean; links: number; blueprints: BlueprintsRemoval | null };

/** Delete a world trait or group. Its links go with it, so a linked one asks first, naming the count. A
 *  non-empty Blueprints group asks too, saying which links it detaches and which traits reach the player. */
export function useRemoveWorldTrait(): { ask: (id: string, isGroup: boolean) => void; dialog: ReactNode } {
  const { traits, traitGroups, entities, removeTrait, removeTraitGroup, placeholders } = useTraitStore();
  const [pending, setPending] = useState<Pending | null>(null);
  const remove = (id: string, isGroup: boolean) => (isGroup ? removeTraitGroup(id) : removeTrait(id));
  const ask = (id: string, isGroup: boolean) => {
    const group = isGroup ? traitGroups.find((g) => g.id === id) : undefined;
    const blueprints = group?.system === 'blueprints' && groupHoldsItems({ traits, traitGroups }, id)
      ? removeBlueprints({ traits, traitGroups }, entities)
      : null;
    const links = blueprints ? 0 : linksTo(entities, id);
    const name = (group ?? traits.find((t) => t.id === id))?.name ?? '';
    if (links || blueprints) setPending({ id, name, isGroup, links, blueprints });
    else remove(id, isGroup);
  };
  const title = pending?.blueprints
    ? `Remove ${labelPlaceholders(pending.name, placeholders)}?`
    : `Delete ${labelPlaceholders(pending?.name ?? '', placeholders)}?`;
  const description = pending?.blueprints
    ? blueprintsLine(pending.blueprints, placeholders)
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
