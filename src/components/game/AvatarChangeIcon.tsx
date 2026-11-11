import { AvatarIcon } from '@/lib/elementIcons';
import { avatarChangeTip } from '@/lib/avatarChanges';
import { Tip } from '@/components/ui/tooltip';

/**
 * The Avatar icon on a trait or stat that changes the Avatar. Draws nothing without names, or when the owner's
 * Avatar is not in use, so a caller passes both and never branches.
 */
export function AvatarChangeIcon({ names, inUse }: { names: readonly string[]; inUse: boolean }) {
  if (!inUse || names.length === 0) return null;
  return (
    <Tip tip={avatarChangeTip(names)}>
      <span
        tabIndex={0}
        data-testid="avatar-change-icon"
        className="inline-flex shrink-0 rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <AvatarIcon aria-hidden className="h-3.5 w-3.5" />
      </span>
    </Tip>
  );
}
