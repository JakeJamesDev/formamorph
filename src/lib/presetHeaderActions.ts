import { Pencil, RotateCcw, Trash2, type LucideIcon } from 'lucide-react';
import { ActionIcon } from '@/lib/actionIcons';

/** One action in a preset header. The desktop row and the narrow overflow menu render the same list. */
export interface PresetHeaderAction {
  key: 'duplicate' | 'rename' | 'import' | 'export' | 'publish' | 'reset' | 'delete';
  label: string;
  icon: LucideIcon;
  section: 'file' | 'destructive';
  run: () => void;
  /** Asked before `run`. The header owns the dialog and returns focus to its opener on cancel. */
  confirm?: { title: string; description: string };
}

/** A destructive handler and the confirm text that names what it changes. */
export interface ConfirmedHandler {
  run: () => void;
  description: string;
}

/** The handlers, each already bound to the active preset. An absent handler removes its action. */
export interface PresetHeaderHandlers {
  duplicate?: () => void;
  rename?: () => void;
  import?: () => void;
  export?: () => void;
  publish?: () => void;
  reset?: ConfirmedHandler;
  delete?: ConfirmedHandler;
}

type ActionDef = Omit<PresetHeaderAction, 'run' | 'confirm'> & { confirmTitle?: string };

// Menu order: file actions, then destructive.
const ACTION_DEFS: ActionDef[] = [
  { key: 'duplicate', label: 'Duplicate', icon: ActionIcon.copy, section: 'file' },
  { key: 'rename', label: 'Rename', icon: Pencil, section: 'file' },
  { key: 'import', label: 'Import', icon: ActionIcon.import, section: 'file' },
  { key: 'export', label: 'Export', icon: ActionIcon.export, section: 'file' },
  { key: 'publish', label: 'Publish', icon: ActionIcon.publish, section: 'file' },
  { key: 'reset', label: 'Reset', icon: RotateCcw, section: 'destructive', confirmTitle: 'Reset Preset' },
  { key: 'delete', label: 'Delete', icon: Trash2, section: 'destructive', confirmTitle: 'Delete Preset' },
];

// A built-in preset updates with each release, so it keeps only the actions that leave it unchanged.
const BUILT_IN_KEYS = new Set<PresetHeaderAction['key']>(['duplicate', 'import', 'export']);

/** The header actions in menu order, for the handlers the surface passes. */
export function presetHeaderActions(builtIn: boolean, h: PresetHeaderHandlers): PresetHeaderAction[] {
  const actions: PresetHeaderAction[] = [];
  for (const { confirmTitle, ...def } of ACTION_DEFS) {
    if (builtIn && !BUILT_IN_KEYS.has(def.key)) continue;
    const handler = h[def.key];
    if (!handler) continue;
    if (typeof handler === 'function') actions.push({ ...def, run: handler });
    else if (confirmTitle) actions.push({ ...def, run: handler.run, confirm: { title: confirmTitle, description: handler.description } });
  }
  return actions;
}
