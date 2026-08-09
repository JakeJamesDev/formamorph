import { GradientButton, type GradientButtonProps } from '@/components/GradientButton';
import { cn } from '@/lib/utils';

/**
 * A button in a world's action column, where every action spans the column. Callers override
 * width and corners through className for the split Enter/Quick Start pair.
 */
export function WorldActionButton({ className, ...props }: GradientButtonProps) {
  return <GradientButton className={cn('w-full', className)} {...props} />;
}
