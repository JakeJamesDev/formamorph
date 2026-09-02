import { cn } from "@/lib/utils";

/** The tint each account status carries. Anything unrecognized reads as active, which is what it is. */
const STATUS_STYLES: Record<string, string> = {
  suspended: 'bg-destructive/10 text-destructive',
  pending: 'bg-warning/10 text-warning',
};

interface StatusPillProps {
  /** The account's status. Empty or unknown reads as `active`. */
  status: string | null | undefined;
  className?: string;
}

/**
 * What state an account is in, as a pill.
 *
 * Shared rather than repeated so the moderation surfaces agree: a suspended account looks suspended in
 * the user table and in the likers of a listing, and staff never have to learn a second color.
 */
export function StatusPill({ status, className }: StatusPillProps) {
  const value = status || 'active';

  return (
    <span
      className={cn(
        'px-2 inline-flex shrink-0 text-meta leading-5 font-semibold rounded-full',
        STATUS_STYLES[value] ?? 'bg-success/10 text-success',
        className
      )}
    >
      {value}
    </span>
  );
}
