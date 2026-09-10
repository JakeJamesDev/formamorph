import type { LucideIcon } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface PanelTab {
  value: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The tab strip an editor detail panel puts above its fields. The label's breakpoints follow the
 * pane's non-monotonic width; see "Pattern: Panel Tab Strip" in the Design System guide.
 *
 * `stripLabel` names the strip, because the editor's own strip is on the same screen and can carry a
 * tab of the same name.
 */
export function PanelTabsList({ tabs, stripLabel }: { tabs: readonly PanelTab[]; stripLabel: string }) {
  return (
    <TabsList
      aria-label={stripLabel}
      className="grid w-full"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(({ value, label, icon: Icon }) => (
        <TabsTrigger key={value} value={value} aria-label={label} className="gap-1.5">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline md:hidden xl:inline">{label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
