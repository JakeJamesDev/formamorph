import { GENERIC_ITEM_ICON, itemIconById, type ShownItemIcon } from '@/lib/itemIcons';
import { THUMB_FRAME, THUMB_INTRINSIC, thumbFit } from '@/lib/thumbAspect';
import { cn } from '@/lib/utils';

/** One catalog icon, drawn in the current text color. The body is our generated catalog, never world text. */
export function ItemIconArt({ id, className }: { id: string; className?: string }) {
  const body = (itemIconById(id) ?? itemIconById(GENERIC_ITEM_ICON))?.body ?? '';
  return <svg viewBox="0 0 512 512" aria-hidden data-item-icon={id} className={cn('block', className)} dangerouslySetInnerHTML={{ __html: body }} />;
}

/** What an item row shows for its Item Copy: its icon, its image or nothing. */
export function ItemRowArt({ shown }: { shown: ShownItemIcon }) {
  if (shown.kind === 'icon') return <ItemIconArt id={shown.id} className="h-6 w-6 shrink-0" />;
  if (shown.kind === 'nothing') return null;
  return <img src={shown.src} alt="" {...THUMB_INTRINSIC.portrait} className={cn('w-6 shrink-0 rounded', THUMB_FRAME.portrait, thumbFit('portrait'))} />;
}
