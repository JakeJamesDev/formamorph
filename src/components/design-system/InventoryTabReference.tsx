import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs } from '@/components/ui/tabs';
import { Meta } from '@/components/ui/typography';
import { InventoryTab } from '@/components/game/InventoryTab';
import { PanelTab, PanelTabList } from '@/components/game/PanelTabList';
import { applyInventoryOps, type InventoryOp } from '@/lib/inventory';
import { ItemIcon, LocationIcon, StatIcon, TraitIcon } from '@/lib/elementIcons';
import { randomUUID } from '@/lib/uuid';
import type { Item, ItemCopy, Slot } from '@/types';

const SLOTS: Slot[] = [{ id: 'hand', name: 'Hand', capacity: 2 }, { id: 'ring', name: 'Ring' }];
const item = (id: string, name: string, over: Partial<Item>): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ITEMS: Item[] = [
  item('tonic', 'Healing Tonic', { consumable: true }),
  item('wand', 'Ash Wand', { charges: 3, stackable: false, bound: true, slotId: 'hand' }),
  item('sword', 'Greatsword', { stackable: false, slotId: 'hand', slotSize: 2 }),
  item('ring', 'Silver Ring', { stackable: false, slotId: 'ring' }),
];
const you = { kind: 'you' } as const;
const START: ItemCopy[] = [
  { id: 's', item: { kind: 'item', itemId: 'sword' }, where: you, quantity: 1, visibility: 'visible', equipped: { slotId: 'hand', order: 1 } },
  { id: 't', item: { kind: 'item', itemId: 'tonic' }, where: you, quantity: 5, visibility: 'visible' },
  { id: 'w', item: { kind: 'item', itemId: 'wand' }, where: you, quantity: 1, visibility: 'visible', state: { charges: 2 } },
  { id: 'r', item: { kind: 'item', itemId: 'ring' }, where: you, quantity: 1, visibility: 'visible' },
  { id: 'l', item: { kind: 'item', itemId: 'tonic' }, where: { kind: 'location', id: 'sample-room' }, quantity: 2, visibility: 'visible' },
];
const PRESENT = [{ id: 'courier', name: 'Courier' }, { id: 'archivist', name: 'Archivist' }];
const HERE = 'sample-room';

/** The side panel's tab strip at one width: labels while all four fit, icons alone below that. */
const Strip = ({ width }: { width: number }) => (
  <div style={{ width }} className="space-y-1">
    <Meta>{width}px</Meta>
    <Tabs value="inventory">
      <PanelTabList>
        <PanelTab value="stats" icon={StatIcon} label="Stats" />
        <PanelTab value="traits" icon={TraitIcon} label="Traits" />
        <PanelTab value="inventory" icon={ItemIcon} label="Inventory" />
        <PanelTab value="location" icon={LocationIcon} label="Location" />
      </PanelTabList>
    </Tabs>
  </div>
);

/** The game panel's Inventory tab on sample Item Copies. Its buttons run the real Inventory module on local
 *  state, and Drop leaves Item Copies in the Here section. */
export function InventoryTabReference() {
  const [copies, setCopies] = useState(START);
  const [busy, setBusy] = useState(false);
  const onOps = (ops: InventoryOp[]) => setCopies((now) => applyInventoryOps(now, ops, {
    world: { items: ITEMS, slots: SLOTS }, source: 'panel', newId: randomUUID,
    presence: { locationId: HERE, entityIds: new Set(PRESENT.map((e) => e.id)) },
  }).copies);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Tab</CardTitle>
        <CardDescription>
          Equip, Unequip, Drop and Give act at once. Drop and Give on a stack ask how many. The Ash Wand is Bound. Here lists the visible items lying at the location.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-6">
        <div className="h-[28rem] w-full max-w-[19rem] space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="inventory-busy" checked={busy} onCheckedChange={(v) => setBusy(v === true)} />
            <Label htmlFor="inventory-busy">Turn Running</Label>
          </div>
          <InventoryTab
            ownerName="Kate"
            copies={copies.filter((c) => c.where.kind === 'you')}
            lying={copies.filter((c) => c.where.kind === 'location')}
            items={ITEMS}
            slots={SLOTS}
            present={PRESENT}
            locationId={HERE}
            disabled={busy}
            resolveText={(text) => text}
            onOps={onOps}
          />
        </div>
        <div className="space-y-4">
          <Strip width={420} />
          <Strip width={300} />
        </div>
      </CardContent>
    </Card>
  );
}
