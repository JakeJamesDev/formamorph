import { Route, Shuffle, type LucideIcon } from 'lucide-react';
import { ELEMENT_ICONS } from '@/lib/elementIcons';
import { ACTION_LABELS, type ActionKind } from '@/lib/routineEditing';

/** The three schedule actions, in the order the editor offers them. Stay keeps the entity at one location. */
export const ACTIONS: { value: ActionKind; label: string; Icon: LucideIcon }[] = [
  { value: 'stay', label: ACTION_LABELS.stay, Icon: ELEMENT_ICONS.location },
  { value: 'wander', label: ACTION_LABELS.wander, Icon: Shuffle },
  { value: 'patrol', label: ACTION_LABELS.patrol, Icon: Route },
];

/** Each action's fill on the day strip and its sentence swatch. */
export const ACTION_TONE: Record<ActionKind, string> = {
  stay: 'bg-routine-stay/70', wander: 'bg-routine-wander/70', patrol: 'bg-routine-patrol/70',
};
