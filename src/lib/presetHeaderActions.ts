import { Maximize2, Minimize2, Pencil, RotateCcw, Trash2, type LucideIcon } from 'lucide-react';
import { ActionIcon } from '@/lib/actionIcons';

/** One action in a preset header. The desktop row and the narrow overflow menu render the same list. */
export interface PresetHeaderAction {
  key: 'duplicate' | 'rename' | 'import' | 'export' | 'publish' | 'fullscreen' | 'reset' | 'delete';
  /** The accessible name and the menu text. */
  label: string;
  /** The tooltip, when it says more than the label. */
  tip?: string;
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
  /** Replaces the action's default confirm title. */
  title?: string;
}

/** The handlers, each already bound to the active preset. An absent handler removes its action. */
export interface PresetHeaderHandlers {
  duplicate?: () => void;
  rename?: () => void;
  import?: () => void;
  export?: () => void;
  publish?: () => void;
  /** The panel's full-screen toggle, labeled for the way it goes next. */
  fullscreen?: { active: boolean; toggle: () => void };
  /** A plain handler resets with no confirm, for a surface whose Undo or Cancel reverts it. */
  reset?: ConfirmedHandler | (() => void);
  delete?: ConfirmedHandler;
}

type ActionDef = Omit<PresetHeaderAction, 'run' | 'confirm'> & {
  confirmTitle?: string;
  /** The label and icon of a toggle that is on. */
  on?: Pick<PresetHeaderAction, 'label' | 'icon'>;
};

// Menu order: file actions, then destructive.
const ACTION_DEFS: ActionDef[] = [
  { key: 'duplicate', label: 'Duplicate', icon: ActionIcon.copy, section: 'file' },
  { key: 'rename', label: 'Rename', icon: Pencil, section: 'file' },
  { key: 'import', label: 'Import', icon: ActionIcon.import, section: 'file' },
  { key: 'export', label: 'Export', icon: ActionIcon.export, section: 'file' },
  { key: 'publish', label: 'Publish', icon: ActionIcon.publish, section: 'file' },
  { key: 'fullscreen', label: 'View full screen', icon: Maximize2, section: 'file', on: { label: 'Exit full screen', icon: Minimize2 } },
  { key: 'reset', label: 'Reset', icon: RotateCcw, section: 'destructive', confirmTitle: 'Reset Preset' },
  { key: 'delete', label: 'Delete', icon: Trash2, section: 'destructive', confirmTitle: 'Delete Preset' },
];

// A built-in preset updates with each release, so it keeps only the actions that leave it unchanged.
const BUILT_IN_KEYS = new Set<PresetHeaderAction['key']>(['duplicate', 'import', 'export', 'fullscreen']);

/** The header actions in menu order, for the handlers the surface passes. */
export function presetHeaderActions(builtIn: boolean, h: PresetHeaderHandlers): PresetHeaderAction[] {
  const actions: PresetHeaderAction[] = [];
  for (const { confirmTitle, on, ...def } of ACTION_DEFS) {
    if (builtIn && !BUILT_IN_KEYS.has(def.key)) continue;
    const handler = h[def.key];
    if (!handler) continue;
    if (typeof handler === 'function') actions.push({ ...def, run: handler });
    else if ('toggle' in handler) actions.push({ ...def, ...(handler.active ? on : undefined), run: handler.toggle });
    else if (confirmTitle) {
      actions.push({ ...def, run: handler.run, confirm: { title: handler.title ?? confirmTitle, description: handler.description } });
    }
  }
  return actions;
}
