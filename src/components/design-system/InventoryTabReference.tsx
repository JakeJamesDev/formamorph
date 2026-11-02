import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs } from '@/components/ui/tabs';
import { Hint, Meta } from '@/components/ui/typography';
import { InventoryTab } from '@/components/game/InventoryTab';
import { CollapsingTabsList } from '@/components/ui/collapsing-tabs-list';
import { applyInventoryOps, type InventoryOp, type TimedEffectView } from '@/lib/inventory';
import { ItemIcon, LocationIcon, StatIcon, TraitIcon } from '@/lib/elementIcons';
import { randomUUID } from '@/lib/uuid';
import { bodySlots, parseBodies } from '@/lib/bodies';
import type { Body, Item, ItemCopy, Slot } from '@/types';

const SLOTS: Slot[] = [{ id: 'hand', name: 'Main Hand' }, { id: 'off-hand', name: 'Off Hand' }, { id: 'ring', name: 'Ring' }];
const BODIES: Body[] = parseBodies([{
  id: 'humanoid', name: 'Humanoid', backdrop: { kind: 'humanoid' }, aspect: 0.5,
  entries: [
    { slotId: 'hand', boxes: [{ x: 0.02, y: 0.3725, w: 0.26, h: 0.26 }] },
    { slotId: 'off-hand', boxes: [{ x: 0.72, y: 0.3725, w: 0.26, h: 0.26 }] },
    { slotId: 'ring', capacity: 2, boxes: [{ x: 0.04, y: 0.4725, w: 0.22, h: 0.09 }, { x: 0.74, y: 0.4725, w: 0.22, h: 0.09 }] },
  ],
}]);
const BODY_SLOTS = bodySlots(BODIES[0], SLOTS);
const item = (id: string, name: string, over: Partial<Item>): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ITEMS: Item[] = [
  item('tonic', 'Healing Tonic', { uses: 1 }),
  item('wand', 'Ash Wand', { uses: 3, whenEmpty: { kind: 'stays' }, stackable: false, bound: true, slotRule: { mode: 'either', slotIds: ['hand', 'off-hand'] } }),
  item('sword', 'Greatsword', { stackable: false, slotRule: { mode: 'all', slotIds: ['hand', 'off-hand'] } }),
  item('ring', 'Silver Ring', { stackable: false, icon: 'none', slotRule: { mode: 'either', slotIds: ['ring'] } }),
];
/** A sample image at its size in pixels. */
const art = (width: number, height: number, fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`)}`;
const ART: Record<string, string> = { sword: art(360, 720, '#8a9bb0'), ring: art(240, 720, '#c9b458') };
const you = { kind: 'you' } as const;
const START: ItemCopy[] = [
  { id: 's', item: { kind: 'item', itemId: 'sword' }, where: you, quantity: 1, visibility: 'visible', equipped: { slotId: 'hand', order: 1 } },
  { id: 't', item: { kind: 'item', itemId: 'tonic' }, where: you, quantity: 5, visibility: 'visible' },
  { id: 'w', item: { kind: 'item', itemId: 'wand' }, where: you, quantity: 1, visibility: 'visible', state: { uses: 2 } },
  { id: 'r', item: { kind: 'item', itemId: 'ring' }, where: you, quantity: 1, visibility: 'visible', equipped: { slotId: 'ring', order: 2 } },
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
          Shows the Status panel&apos;s Inventory tab on sample items. <strong>Equip</strong>, <strong>Unequip</strong>, <strong>Use</strong>, <strong>Drop</strong> and <strong>Give</strong> act at once.
        </CardDescription>
        <Hint as="ul" className="list-disc space-y-1 pl-5">
          <li><strong>Equipped</strong> draws the figure, with a list beside it. The Greatsword takes both hands, so its icon shows in each, its image doesn&apos;t show, and the list gives it one row with both slot names.</li>
          <li>The Silver Ring&apos;s icon is set to None, so its tall image shows and keeps its shape in a wide box. Selecting beside it opens the Greatsword under it.</li>
          <li>Select a filled box or a list row&apos;s name for the item&apos;s full name, <strong>Use</strong> and <strong>Unequip</strong>. <strong>Unequip</strong> on the row acts at once. An empty box names its slot when you hover over it or select it.</li>
          <li>Equip the Ash Wand to see an icon from an item&apos;s name. Hover over its box to see the name.</li>
          <li><strong>Drop</strong> and <strong>Give</strong> on a stack ask how many.</li>
          <li><strong>Use</strong> spends one Healing Tonic or one Ash Wand use, and turns off at zero uses.</li>
          <li>The Ash Wand is Bound, so you can&apos;t drop or give it.</li>
          <li><strong>Effects</strong> lists the After Use effects running, with the time left.</li>
          <li><strong>Give</strong> lists the entities in the scene first, then the rest at the location.</li>
          <li>A card named for the location lists the visible items there, each with <strong>Pick Up</strong>.</li>
        </Hint>
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
            body={BODIES[0]}
            slots={BODY_SLOTS}
            worldSlots={SLOTS}
            imageOf={(copy) => (copy.item.kind === 'item' ? ART[copy.item.itemId] : undefined)}
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
