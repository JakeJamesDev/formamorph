import { GradientButton, type GradientButtonProps } from '@/components/GradientButton';
import { cn } from '@/lib/utils';

/**
 * A button in a world's action column. Adds what the column shares on top of the gradient —
 * reading size and full width — so only the tone varies per action. Callers override width
 * and corners through className for the split Enter/Quick Start pair.
 */
export function WorldActionButton({ className, ...props }: GradientButtonProps) {
  return <GradientButton className={cn('w-full text-body', className)} {...props} />;
}
