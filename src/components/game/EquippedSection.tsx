import type { ReactNode } from 'react';
import { dollColumnWidth } from '@/lib/bodyLayout';
import type { ShownItemIcon } from '@/lib/itemIcons';
import { cn } from '@/lib/utils';
import type { Body, ItemCopy } from '@/types';
import { BodyDoll } from './BodyDoll';
import { PanelSubheader } from './PanelOwnerCard';

/** The owner's figure with the Equipped list beside it. A Body wider than tall stacks them (V1). */
export function EquippedSection({ body, boxes, listed, slotName, nameOf, shownIconOf, listRow, popoverRow }: {
  /** The Body with only the entries that draw. */
  body: Body;
  /** The Item Copy in each filled box. */
  boxes: ReadonlyMap<string, ItemCopy>;
  /** One Item Copy per row, so an All of item in two boxes lists once. */
  listed: readonly ItemCopy[];
  slotName: (slotId: string) => string;
  nameOf: (copy: ItemCopy) => string;
  shownIconOf: (copy: ItemCopy) => ShownItemIcon;
  listRow: (copy: ItemCopy) => ReactNode;
  popoverRow: (copy: ItemCopy) => ReactNode;
}) {
  const doll = (
    <BodyDoll
      body={body}
      slotName={slotName}
      fills={new Map([...boxes].map(([key, copy]) => [key, {
        id: copy.id,
        name: nameOf(copy),
        icon: shownIconOf(copy),
        detail: popoverRow(copy),
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
