import { cn } from '@/lib/utils';

/** One choice on the setup screen: a trait or a starting location, framed and marked when chosen. */
export const choiceRowClass = (selected: boolean) => cn(
  'flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors',
  'focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset',
  selected
    ? 'border-primary bg-primary/10'
    : 'border-border hover:border-muted-foreground/60 hover:bg-muted/40',
);
