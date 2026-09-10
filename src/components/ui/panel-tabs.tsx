import type { LucideIcon } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface PanelTab {
  value: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The tab strip an editor detail panel puts above its fields.
 *
 * The pane these panels sit in is not monotonic in viewport width: below `md` the panel is the
 * full-width detail sheet, and at `md` the editor splits and the panel takes half. A label that fits at
 * 767px therefore does not fit at 820px, so the label steps on at `sm`, off at `md`, and on again at
 * `xl`. Where the label is hidden the tab's name still reaches assistive technology and role queries
 * through `aria-label`, which reads the same string at every width.
 *
 * `label` names the strip, because the editor's own strip is on the same screen and can carry a tab of
 * the same name.
 */
export function PanelTabsList({ tabs, label }: { tabs: readonly PanelTab[]; label: string }) {
  return (
    <TabsList
      aria-label={label}
      className="grid w-full"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(({ value, label: name, icon: Icon }) => (
        <TabsTrigger key={value} value={value} aria-label={name} className="gap-1.5">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline md:hidden xl:inline">{name}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
