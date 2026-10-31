import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs } from '@/components/ui/tabs';
import { Meta } from '@/components/ui/typography';
import { InventoryTab } from '@/components/game/InventoryTab';
import { CollapsingTabsList } from '@/components/ui/collapsing-tabs-list';
import { applyInventoryOps, type InventoryOp, type TimedEffectView } from '@/lib/inventory';
import { ItemIcon, LocationIcon, StatIcon, TraitIcon } from '@/lib/elementIcons';
import { randomUUID } from '@/lib/uuid';
import { bodySlots } from '@/lib/bodies';
import type { Body, Item, ItemCopy, Slot } from '@/types';

const SLOTS: Slot[] = [{ id: 'hand', name: 'Hand' }, { id: 'ring', name: 'Ring' }];
const BODIES: Body[] = [{ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'hand', capacity: 2 }, { slotId: 'ring' }] }];
const BODY_SLOTS = bodySlots(BODIES[0], SLOTS);
const item = (id: string, name: string, over: Partial<Item>): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ITEMS: Item[] = [
  item('tonic', 'Healing Tonic', { uses: 1 }),
  item('wand', 'Ash Wand', { uses: 3, whenEmpty: { kind: 'stays' }, stackable: false, bound: true, slotId: 'hand' }),
  item('sword', 'Greatsword', { stackable: false, slotId: 'hand', slotSize: 2 }),
  item('ring', 'Silver Ring', { stackable: false, slotId: 'ring' }),
];
const you = { kind: 'you' } as const;
const START: ItemCopy[] = [
  { id: 's', item: { kind: 'item', itemId: 'sword' }, where: you, quantity: 1, visibility: 'visible', equipped: { slotId: 'hand', order: 1 } },
  { id: 't', item: { kind: 'item', itemId: 'tonic' }, where: you, quantity: 5, visibility: 'visible' },
  { id: 'w', item: { kind: 'item', itemId: 'wand' }, where: you, quantity: 1, visibility: 'visible', state: { uses: 2 } },
  { id: 'r', item: { kind: 'item', itemId: 'ring' }, where: you, quantity: 1, visibility: 'visible' },
  { id: 'l', item: { kind: 'item', itemId: 'tonic' }, where: { kind: 'location', id: 'sample-room' }, quantity: 2, visibility: 'visible' },
];
const TIMED: TimedEffectView[] = [
  { key: 'tonic-strength', itemName: 'Healing Tonic', effect: 'Strength +2', hoursLeft: 4 / 3 },
  { key: 'tonic-ward', itemName: 'Healing Tonic', effect: 'Warded', hoursLeft: 26 },
  { key: 'hidden', itemName: null, effect: 'Max Health -5', hoursLeft: 0.25 },
];
const PRESENT = [{ id: 'courier', name: 'Courier' }, { id: 'archivist', name: 'Archivist' }];
const HERE = 'sample-room';
const STATUS_TABS = [
  { value: 'stats', icon: StatIcon, label: 'Stats' },
  { value: 'traits', icon: TraitIcon, label: 'Traits' },
  { value: 'inventory', icon: ItemIcon, label: 'Inventory' },
  { value: 'location', icon: LocationIcon, label: 'Location' },
];

/** The side panel's tab strip at one width: every label, then the selected tab's, then icons alone. */
const Strip = ({ width }: { width: number }) => (
  <div style={{ width }} className="space-y-1">
    <Meta>{width}px</Meta>
    <Tabs value="inventory">
      <CollapsingTabsList aria-label="Status" value="inventory" tabs={STATUS_TABS} />
    </Tabs>
  </div>
);

/** The game panel's Inventory tab on sample Item Copies. Its buttons run the real Inventory module on local
 *  state, and Drop leaves Item Copies in the Here section. */
export function InventoryTabReference() {
  const [copies, setCopies] = useState(START);
  const [busy, setBusy] = useState(false);
  const onOps = (ops: InventoryOp[]) => setCopies((now) => applyInventoryOps(now, ops, {
    world: { items: ITEMS, slots: SLOTS, bodies: BODIES }, source: 'panel', newId: randomUUID,
    presence: { locationId: HERE, entityIds: new Set(PRESENT.map((e) => e.id)) },
  }).copies);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Tab</CardTitle>
        <CardDescription>
          Equip, Unequip, Use, Drop and Give act at once. Drop and Give on a stack ask how many. Use spends one Healing Tonic or one Ash Wand use, and turns off at zero uses. The Ash Wand is Bound. Effects lists the After Use effects running, with time left. Give lists the entities in the scene above the rest at the location. A card named for the location lists the visible items lying there, each with Pick Up.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-6">
        <div className="h-[36rem] w-full max-w-[19rem] space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="inventory-busy" checked={busy} onCheckedChange={(v) => setBusy(v === true)} />
            <Label htmlFor="inventory-busy">Turn Running</Label>
          </div>
          <InventoryTab
            ownerName="Kate"
            copies={copies.filter((c) => c.where.kind === 'you')}
            lying={copies.filter((c) => c.where.kind === 'location')}
            items={ITEMS}
            slots={BODY_SLOTS}
            present={PRESENT}
            locationId={HERE}
            locationName="Sample Room"
            disabled={busy}
            resolveText={(text) => text}
            timed={TIMED}
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
