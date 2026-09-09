/** The location detail panel's own tabs, in order. Single source of truth: `LocationManager`'s TabsList
 *  renders from this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditorLocation`) is guarded against it
 *  in `devRouter.test.ts`. */
import { ImageIcon, MapPin, Pin, Users } from 'lucide-react';

export const LOCATION_PANEL_TABS = [
  { value: 'details', label: 'Details', icon: MapPin },
  { value: 'presence', label: 'Presence', icon: Users },
  { value: 'media', label: 'Media', icon: ImageIcon },
  { value: 'pins', label: 'Pins', icon: Pin, advancedOnly: true },
] as const;

export type LocationPanelTab = (typeof LOCATION_PANEL_TABS)[number]['value'];

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones, as the editor's own strip does. */
export function locationPanelTabsFor(advanced: boolean) {
  return LOCATION_PANEL_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}

/** Which tab holds each searchable field. The prose sits with Name rather than on a tab of its own, which
 *  is where the location panel parts company with the entity one. */
const TAB_BY_FIELD: Record<string, LocationPanelTab> = {
  name: 'details',
  playerDescription: 'details',
  aiDescription: 'details',
  aiSummary: 'details',
  imageTags: 'media',
};

/**
 * The tab holding `fieldKey`, or `null` for a key no tab claims.
 *
 * Find reaches a field by its text, which a tab that isn't open never renders, so a hit has to open its own
 * tab first. Keys come from the search targets in `worldSearch`; anything unlisted answers `null`, which
 * leaves the panel on whichever tab the author was already on.
 */
export function locationTabForField(fieldKey: string): LocationPanelTab | null {
  return TAB_BY_FIELD[fieldKey] ?? null;
}
