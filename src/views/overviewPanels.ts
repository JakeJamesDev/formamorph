import { WORLD_PROMPT_KINDS, type WorldPromptKind } from '@/lib/worldPrompt';

/**
 * The Overview's custom prompt panels, at most one open. The openings share the picker without being a
 * {@link WorldPromptKind}: they are the player's first message, and live on their own overview fields instead
 * of in `promptOverrides`.
 */
export type OverviewPanel = WorldPromptKind | 'opening';

/** The three system prompts first, then the outlier. */
export const OVERVIEW_PANELS: readonly OverviewPanel[] = [...WORLD_PROMPT_KINDS, 'opening'];

/** The sub-tab an Origin records when no panel was open, so a reveal closes the one open now. */
export const NO_OVERVIEW_PANEL = 'none';

/** The panel a history reveal names, or none for no panel or one the editor doesn't offer. */
export const overviewPanelFor = (value: string): OverviewPanel | null =>
  OVERVIEW_PANELS.find((panel) => panel === value) ?? null;
