import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The gradient tones the world action column uses. Each is only the gradient — every other
 * part of the look lives in the component, so a change to the set is one edit.
 *
 * `enter` is shared: Download World in the remote details modal is the same slot on a
 * Community Creations world, so it takes the same tone as Enter World.
 */
const TONES = {
  enter: 'from-sky-200 to-cyan-200 hover:from-sky-300 hover:to-cyan-300',
  quickStart: 'from-amber-100 to-yellow-100 hover:from-amber-200 hover:to-yellow-200',
  edit: 'from-orange-100 to-orange-200 hover:from-orange-200 hover:to-orange-300',
  duplicate: 'from-purple-100 to-purple-200 hover:from-purple-200 hover:to-purple-300',
  export: 'from-emerald-100 to-emerald-200 hover:from-emerald-200 hover:to-emerald-300',
  offline: 'from-sky-100 to-sky-200 hover:from-sky-200 hover:to-sky-300',
  publish: 'from-red-100 to-red-200 hover:from-purple-200 hover:to-indigo-300',
} as const;

export type WorldActionTone = keyof typeof TONES;

export interface WorldActionButtonProps extends ButtonProps {
  tone: WorldActionTone;
}

/**
 * A button in a world's action column. Owns everything the column shares — reading size,
 * full width, weight, black label over the gradient — so only the tone varies per action.
 * Callers override width and corners through className for the split Enter/Quick Start pair.
 */
export function WorldActionButton({ tone, className, ...props }: WorldActionButtonProps) {
  return (
    <Button
      className={cn('w-full text-body bg-gradient-to-r text-black font-bold', TONES[tone], className)}
      {...props}
    />
  );
}
