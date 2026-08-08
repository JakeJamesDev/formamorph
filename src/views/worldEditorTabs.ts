/** The World Editor's top-level tabs, in order. Single source of truth: WorldEditor's TabsList renders
 *  from this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditor`) is guarded against it in
 *  `devRouter.test.ts`. */
export const WORLD_EDITOR_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'stats', label: 'Stats' },
  { value: 'entities', label: 'Entities' },
  { value: 'locations', label: 'Locations' },
  { value: 'traits', label: 'Traits' },
  { value: 'dictionary', label: 'Dictionary' },
  { value: 'placeholders', label: 'Placeholders', advancedOnly: true },
] as const;

/** The tabs one editor mode shows. Simple drops the `advancedOnly` ones. */
export function editorTabsFor(advanced: boolean) {
  return WORLD_EDITOR_TABS.filter((t) => advanced || !('advancedOnly' in t && t.advancedOnly));
}
