import { UserCheck, UserX } from 'lucide-react';
import { ContextMenuItem } from '@/components/ui/context-menu';

/** The tile menu action that makes a persona the default, or clears it when it already is. */
export function DefaultPersonaMenuItem({ isDefault, onSet, onClear }: {
  isDefault: boolean;
  onSet: () => void;
  onClear: () => void;
}) {
  return isDefault ? (
    <ContextMenuItem onSelect={onClear}>
      <UserX className="h-4 w-4 shrink-0" /> Clear Default Persona
    </ContextMenuItem>
  ) : (
    <ContextMenuItem onSelect={onSet}>
      <UserCheck className="h-4 w-4 shrink-0" /> Set as Default Persona
    </ContextMenuItem>
  );
}

/** The grid card's mark for the default persona. */
export function DefaultPersonaBadge() {
  return <span className="rounded bg-overlay/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">Default</span>;
}
