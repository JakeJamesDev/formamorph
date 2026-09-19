import { Pencil, RotateCcw, Trash2, type LucideIcon } from 'lucide-react';
import { ActionIcon } from '@/lib/actionIcons';

/** One action in the Prompts preset header. The desktop row and the narrow overflow menu render the same list. */
export interface PresetHeaderAction {
  key: 'rename' | 'export' | 'reset' | 'delete';
  label: string;
  icon: LucideIcon;
  section: 'file' | 'destructive';
  run: () => void;
}

/** The handlers, each already bound to the active preset. */
export interface PresetHeaderHandlers {
  rename: () => void;
  export: () => void;
  reset: () => void;
  delete: () => void;
}

/** The header actions in menu order: file actions, then destructive. A built-in preset gets Export only. */
export function presetHeaderActions(builtIn: boolean, h: PresetHeaderHandlers): PresetHeaderAction[] {
  const actions: PresetHeaderAction[] = [];
  if (!builtIn) actions.push({ key: 'rename', label: 'Rename', icon: Pencil, section: 'file', run: h.rename });
  actions.push({ key: 'export', label: 'Export', icon: ActionIcon.export, section: 'file', run: h.export });
  if (!builtIn) {
    actions.push({ key: 'reset', label: 'Reset', icon: RotateCcw, section: 'destructive', run: h.reset });
    actions.push({ key: 'delete', label: 'Delete', icon: Trash2, section: 'destructive', run: h.delete });
  }
  return actions;
}
