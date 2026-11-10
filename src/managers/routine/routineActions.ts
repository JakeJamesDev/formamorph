import { Route, Shuffle, type LucideIcon } from 'lucide-react';
import { ELEMENT_ICONS } from '@/lib/elementIcons';
import type { ActionKind } from '@/lib/routineEditing';

/** The three schedule actions, in the order the editor offers them. Stay keeps the entity at one location. */
export const ACTIONS: { value: ActionKind; label: string; Icon: LucideIcon }[] = [
  { value: 'stay', label: 'Stay', Icon: ELEMENT_ICONS.location },
  { value: 'wander', label: 'Wander', Icon: Shuffle },
  { value: 'patrol', label: 'Patrol', Icon: Route },
];
