import { forwardRef } from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The pastel gradients the main menu's action buttons use, in two shade families: the strong
 * ones sit on the page in the menu toolbar, the soft ones inside a world's action column where
 * a whole stack of them is on screen at once. Only the gradient lives here — everything else
 * about the look belongs to the components below, so a change to the set is one edit.
 */
const GRADIENT_TONES = {
  sky: 'from-sky-200 to-cyan-200 hover:from-sky-300 hover:to-cyan-300',
  indigo: 'from-indigo-200 to-blue-200 hover:from-indigo-300 hover:to-blue-300',
  amber: 'from-amber-200 to-yellow-200 hover:from-amber-300 hover:to-yellow-300',
  green: 'from-green-200 to-emerald-200 hover:from-green-300 hover:to-emerald-300',
  purple: 'from-purple-200 to-pink-200 hover:from-purple-300 hover:to-pink-300',

  skySoft: 'from-sky-100 to-sky-200 hover:from-sky-200 hover:to-sky-300',
  amberSoft: 'from-amber-100 to-yellow-100 hover:from-amber-200 hover:to-yellow-200',
  orangeSoft: 'from-orange-100 to-orange-200 hover:from-orange-200 hover:to-orange-300',
  purpleSoft: 'from-purple-100 to-purple-200 hover:from-purple-200 hover:to-purple-300',
  emeraldSoft: 'from-emerald-100 to-emerald-200 hover:from-emerald-200 hover:to-emerald-300',
  // Publish alone crosses hues on hover — it's the one action that leaves the machine.
  redSoft: 'from-red-100 to-red-200 hover:from-purple-200 hover:to-indigo-300',
} as const;

export type GradientTone = keyof typeof GRADIENT_TONES;

export interface GradientButtonProps extends ButtonProps {
  tone: GradientTone;
}

/**
 * A pastel action button: black bold label at control size over one of the shared gradients.
 * These are the menu's primary actions, so weight carries the emphasis rather than size.
 *
 * Forwards its ref so it can stand as a Radix `asChild` trigger — the hamburger menu is one.
 */
export const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ tone, className, ...props }, ref) => (
    <Button
      ref={ref}
      className={cn('bg-gradient-to-r text-label text-black font-bold', GRADIENT_TONES[tone], className)}
      {...props}
    />
  ),
);
GradientButton.displayName = 'GradientButton';
