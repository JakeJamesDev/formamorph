import { ArrowLeft, ArrowLeftRight, ArrowRight } from 'lucide-react';
import type { ConnectionDirection } from '@/lib/connectionEditing';

/** The icon of each Travel choice, read from the end being edited. */
export const TRAVEL_ICONS: Record<ConnectionDirection, typeof ArrowRight> = {
  'two-way': ArrowLeftRight,
  outgoing: ArrowRight,
  incoming: ArrowLeft,
};

/** How one Travel choice reads on a surface: a word beside its icon, or a tooltip on the icon alone. */
export type TravelChoiceLabel = { word: string } | { tip: string };

/** The Travel choices on a location's panel, worded from that location. */
export const PANEL_TRAVEL_LABELS: Record<ConnectionDirection, TravelChoiceLabel> = {
  'two-way': { word: 'Both Ways' },
  outgoing: { word: 'To There' },
  incoming: { word: 'To Here' },
};
