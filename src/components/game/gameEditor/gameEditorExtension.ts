import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { StepLabelParts } from '@/lib/editorHistoryLabels';
import type { SearchTarget } from '@/lib/worldSearch';
import type { GameEditorTab } from '@/views/gameEditorTabs';
import type { DiscoveredEntity, Entity } from '@/types';

/** What one rail tab puts in the editor: its list, its detail, and how a phone shows them. */
export interface GameEditorSection {
  toolbar?: ReactNode;
  list: ReactNode;
  detail: ReactNode;
  footer?: ReactNode;
  /** The detail scrolls inside itself, as the entity panel's tabs do. */
  detailScrolls?: boolean;
  /** The list scrolls inside itself. */
  listScrolls?: boolean;
  /** On a phone: the detail is pushed over the list once one is picked. Absent ⇒ the two stack. */
  push?: { showDetail: boolean; onBack: () => void; backLabel: string };
}

/** The editor's state a feature reads and writes through. */
export interface GameEditorContext {
  /** A past turn: everything reads only. */
  readOnly: boolean;
  /** The invented entities as the draft shows them. */
  entities: readonly DiscoveredEntity[];
  /** The id on the Entities tab's panel: an entity's, `GAME_EDITOR_PLAYER`, or null. */
  selectedId: string | null;
  openTab: (tab: string) => void;
  openEntity: (id: string) => void;
  /** This feature's slice of the draft, by key. Absent ⇒ unchanged. */
  extra: <T>(key: string) => T | undefined;
  /** Sets a slice as one history step; `undefined` drops it from the draft. */
  setExtra: (label: StepLabelParts, stepKey: string, key: string, value: unknown) => void;
}

/** A tab of the entity panel a feature adds. */
export interface GameEntityExtraTab {
  value: string;
  label: string;
  icon: LucideIcon;
  body: ReactNode;
}

/** The player's editable fields, for a feature that keeps them in the save. Absent ⇒ the player has stats only. */
export interface GamePlayerEntry {
  fields: Partial<Entity>;
  onEdit: (patch: Partial<Entity>) => void;
}

/** What a feature adds to the editor. Every part is optional. */
export interface GameEditorParts {
  /** Rail tabs, after the editor's own. */
  tabs?: readonly { tab: GameEditorTab; section: GameEditorSection; /** Its row on the Overview. */ jump?: string }[];
  /** Entity panel tabs, after Descriptions. */
  entityTabs?: readonly GameEntityExtraTab[];
  player?: GamePlayerEntry;
  /** Sections at the end of the Overview's list, and of its detail. */
  overviewList?: ReactNode;
  overviewDetail?: ReactNode;
  /** Rows under the Profile tab's fields. */
  profile?: ReactNode;
  /** Controls beside the AI-Facing Description's label. */
  descriptionTools?: ReactNode;
  /** Controls at the start and the end of the panel's footer. */
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
  searchTargets?: readonly SearchTarget[];
  /** Writes this feature's slices into the game when the player saves. */
  onSave?: () => void;
}

/**
 * A feature of the Game Editor, as a hook: it reads the game itself and hands back what it adds. The list a
 * host passes must keep its length and order across renders, as any hook's call order must.
 */
export type UseGameEditorExtension = (context: GameEditorContext) => GameEditorParts;
