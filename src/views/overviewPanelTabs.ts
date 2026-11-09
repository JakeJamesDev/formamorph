/** The Overview's right-column tabs, in order. `WorldDetailsManager`'s `PanelTabs` renders from these, and the
 *  dev-router ledger (`DEV_MODAL_TABS.worldEditorOverview`) is guarded against them in `devRouter.test.ts`. */
import { ScrollText } from 'lucide-react';

import { ELEMENT_ICONS } from '@/lib/elementIcons';
import { isOpeningFieldKey } from '@/lib/openings';
import { WORLD_PROMPT_KINDS, worldPromptFieldKey, type WorldPromptKind } from '@/lib/worldPrompt';

export const OVERVIEW_PANEL_TABS = [
  { value: 'details', label: 'Details', icon: ELEMENT_ICONS.world },
  { value: 'prompts', label: 'Custom Prompts', icon: ScrollText, advancedOnly: true },
  { value: 'openings', label: 'Openings', icon: ELEMENT_ICONS.opening, advancedOnly: true },
] as const;

export type OverviewPanelTab = (typeof OVERVIEW_PANEL_TABS)[number]['value'];

/** The tabs one editor mode shows. Simple leaves Details alone, and so no strip. */
export function overviewPanelTabsFor(advanced: boolean) {
  return OVERVIEW_PANEL_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}

/** Where on the right column the author is: a tab, and on Custom Prompts the prompt kind it shows. */
export interface OverviewPlace {
  tab: OverviewPanelTab;
  kind: WorldPromptKind;
}

export const DEFAULT_OVERVIEW_PLACE: OverviewPlace = { tab: 'details', kind: 'narration' };

/** The value a Step's Origin records for a place: the prompt kind stands for its tab. */
export const overviewOriginValue = ({ tab, kind }: OverviewPlace): string => (tab === 'prompts' ? kind : tab);

/** The place an Origin's value names, keeping `kind` when it names none. Unknown values open Details. */
export function overviewPlaceFor(value: string, kind: WorldPromptKind): OverviewPlace {
  const named = WORLD_PROMPT_KINDS.find((k) => k === value);
  if (named) return { tab: 'prompts', kind: named };
  return { tab: value === 'openings' ? 'openings' : 'details', kind };
}

/** The find-bar keys of the Details fields. */
const DETAILS_FIELDS: ReadonlySet<string> = new Set(['description', 'systemPrompt', 'introReadme', 'readme']);

/** The place holding a find-bar field, or null for a key the right column doesn't hold. */
export function overviewPlaceForField(fieldKey: string, kind: WorldPromptKind): OverviewPlace | null {
  if (isOpeningFieldKey(fieldKey)) return { tab: 'openings', kind };
  const prompt = WORLD_PROMPT_KINDS.find((k) => worldPromptFieldKey(k) === fieldKey);
  if (prompt) return { tab: 'prompts', kind: prompt };
  return DETAILS_FIELDS.has(fieldKey) ? { tab: 'details', kind } : null;
}
