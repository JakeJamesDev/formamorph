import { UserCheck, UserX } from 'lucide-react';
import { ContextMenuItem } from '@/components/ui/context-menu';

interface DefaultMenuItemProps {
  isDefault: boolean;
  onSet: () => void;
  onClear: () => void;
}

/** The tile menu action that makes a library item the default, or clears it when it already is. */
function DefaultMenuItem({ noun, isDefault, onSet, onClear }: DefaultMenuItemProps & { noun: string }) {
  return isDefault ? (
    <ContextMenuItem onSelect={onClear}>
      <UserX className="h-4 w-4 shrink-0" /> Clear Default {noun}
    </ContextMenuItem>
  ) : (
    <ContextMenuItem onSelect={onSet}>
      <UserCheck className="h-4 w-4 shrink-0" /> Set as Default {noun}
    </ContextMenuItem>
  );
}

export const DefaultPersonaMenuItem = (props: DefaultMenuItemProps) => <DefaultMenuItem noun="Persona" {...props} />;

export const DefaultAvatarMenuItem = (props: DefaultMenuItemProps) => <DefaultMenuItem noun="Avatar" {...props} />;

/** The grid card's mark for the default persona or Avatar. */
export function DefaultBadge() {
  return <span className="rounded bg-overlay/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">Default</span>;
}
