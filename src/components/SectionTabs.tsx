import { useState } from 'react';
import { EditorSectionsBar } from '@/components/editor/EditorSectionsBar';
import type { NavRailGroup } from '@/components/NavRail';
import { CollapsingTabsList } from '@/components/ui/collapsing-tabs-list';

/** A dialog's tab chrome: the collapsing icon strip, or on mobile a Sections bar folding the grouped list. Renders
 *  inside a `Tabs` root spread with `useSectionTabsRoot().rootProps`. */
export function SectionTabs({ isMobile, groups, value, label, bodyId }: {
  isMobile: boolean;
  groups: readonly NavRailGroup[];
  value: string;
  label: string;
  /** The id of the Sections bar's folding body, unique on the page. */
  bodyId: string;
}) {
  const [open, setOpen] = useState(false);
  if (isMobile) {
    return <EditorSectionsBar groups={groups} label={label} bodyId={bodyId} value={value} open={open} onOpenChange={setOpen} />;
  }
  return <CollapsingTabsList tabs={groups.flatMap((group) => group.tabs)} value={value} aria-label={label} className="flex-shrink-0" />;
}
