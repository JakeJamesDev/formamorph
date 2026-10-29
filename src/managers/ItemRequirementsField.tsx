import { HostRuleRows, useItemRuleHost } from '@/components/editor/ImageRuleCog';
import { Hint } from '@/components/ui/typography';
import type { Item } from '@/types';

/** The item's equip Requirement Rows. A Condition with no owner reads the Item Copy's owner (Q67). */
export const ItemRequirementsField = ({ item, apply }: { item: Item; apply: (patch: Partial<Item>) => void }) => {
  const host = useItemRuleHost(item.id);
  return (
    <div className="space-y-2">
      <HostRuleRows host={host} label="Equip Requirements" rows={item.equipRequires} onChange={(equipRequires) => apply({ equipRequires })} />
      <Hint>Lets its owner equip it while any row holds</Hint>
    </div>
  );
};
