import { LocationIcon } from '@/lib/elementIcons';
import { cn } from '@/lib/utils';

/** Marks a part of an entity's routine that names the location whose Presence tab shows it. */
export function HereMark({ locationName, className }: { locationName: string; className?: string }) {
  return <LocationIcon role="img" aria-label={`Names ${locationName}`} className={cn('inline-block h-3.5 w-3.5 shrink-0 text-primary', className)} />;
}
