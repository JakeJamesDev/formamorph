import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The icon a Built-in Placeholder chip carries before its label. The label and the heading name it. */
const BuiltinMark = ({ className }: { className?: string }) => (
  <Sparkles aria-hidden data-builtin-mark="" className={cn('h-3 w-3 shrink-0', className)} />
);

export default BuiltinMark;
