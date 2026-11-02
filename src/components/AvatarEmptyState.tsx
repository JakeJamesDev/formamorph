import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

/** A surface with no Avatar in the library: why it is empty, and the action that adds a .vrm file. */
export function AvatarEmptyState({ onAdd, disabled, className }: { onAdd: () => void; disabled?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 text-center select-none', className)}>
      <Hint className="max-w-md">No Avatars yet. Import a .vrm file to add one. Games run without an Avatar.</Hint>
      <Button variant="outline" size="sm" onClick={onAdd} disabled={disabled}>Import Avatar</Button>
    </div>
  );
}
