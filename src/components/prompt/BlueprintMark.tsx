import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The link glyph a blueprint chip carries before its label: the chip reads each bearer's own copy. */
const BlueprintMark = ({ className }: { className?: string }) => (
  <Link2 aria-hidden data-blueprint-mark="" className={cn('h-3 w-3 shrink-0', className)} />
);

export default BlueprintMark;
