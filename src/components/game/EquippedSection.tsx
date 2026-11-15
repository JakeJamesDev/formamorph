import type { ReactNode } from 'react';
import { dollColumnWidth } from '@/lib/bodyLayout';
import type { ShownItemIcon } from '@/lib/itemIcons';
import { cn } from '@/lib/utils';
import type { Body, ItemInstance } from '@/types';
import { BodyDoll } from './BodyDoll';
import { PanelSubheader } from './PanelOwnerCard';

/** The owner's figure with the Equipped list beside it. A Body wider than tall stacks them (V1). */
export function EquippedSection({ body, boxes, listed, slotName, nameOf, shownIconOf, listRow, popoverRow }: {
  /** The Body with only the entries that draw. */
  body: Body;
  /** The Item Instance in each filled box. */
  boxes: ReadonlyMap<string, ItemInstance>;
  /** One Item Instance per row, so an All of item in two boxes lists once. */
  listed: readonly ItemInstance[];
  slotName: (slotId: string) => string;
  nameOf: (instance: ItemInstance) => string;
  shownIconOf: (instance: ItemInstance) => ShownItemIcon;
  listRow: (instance: ItemInstance) => ReactNode;
  popoverRow: (instance: ItemInstance) => ReactNode;
}) {
  const doll = (
    <BodyDoll
      body={body}
      slotName={slotName}
      fills={new Map([...boxes].map(([key, instance]) => [key, {
        id: instance.id,
        name: nameOf(instance),
        icon: shownIconOf(instance),
        detail: popoverRow(instance),
      }]))}
    />
  );
  const list = (className?: string) => (listed.length === 0
    ? <p role="status" className={cn('px-2 py-2 text-label text-muted-foreground', className)}>Nothing is equipped.</p>
    : <ul aria-label="Equipped Items" className={className}>{listed.map(listRow)}</ul>);
  return (
    <>
      <PanelSubheader>Equipped</PanelSubheader>
      {body.aspect > 1 ? (
        <div data-doll-layout="stacked" className="flex flex-col gap-3">
          {doll}
          {list()}
        </div>
      ) : (
        <div data-doll-layout="columns" className="flex items-start gap-3">
          <div className="shrink-0" style={{ width: dollColumnWidth(body.aspect) }}>{doll}</div>
          {list('min-w-0 flex-1')}
        </div>
      )}
    </>
  );
}
