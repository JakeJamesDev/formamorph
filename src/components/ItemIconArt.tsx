import { GENERIC_ITEM_ICON, itemIconById } from '@/lib/itemIcons';
import { cn } from '@/lib/utils';

/** One catalog icon, drawn in the current text color. The body is our generated catalog, never world text. */
export function ItemIconArt({ id, className }: { id: string; className?: string }) {
  const body = (itemIconById(id) ?? itemIconById(GENERIC_ITEM_ICON))?.body ?? '';
  return <svg viewBox="0 0 512 512" aria-hidden data-item-icon={id} className={cn('block', className)} dangerouslySetInnerHTML={{ __html: body }} />;
}
