import { cn } from '@/lib/utils';

interface PublishOptionSwitchProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** The accessible name: what turning it on does. */
  label: string;
  /** The track's fill while on. */
  onClassName: string;
}

/** The switch on a Publish dialog option card. */
export function PublishOptionSwitch({ checked, onCheckedChange, label, onClassName }: PublishOptionSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        checked ? onClassName : 'bg-input',
      )}
    >
      <span
        className={cn(
          'block h-5 w-5 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
