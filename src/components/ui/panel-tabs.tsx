import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListDetailBack, ListDetailBackProvider } from '@/components/ui/list-detail';
import { useListDetailBack } from '@/components/ui/listDetailBack';
import type { SurfaceLedgerName } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

/** Set by a host to its side and bottom padding, so a tab body scrolls to the panel's edges. */
export const PANEL_GUTTER_VAR = '--panel-gutter';
const GUTTER = `var(${PANEL_GUTTER_VAR}, 0px)`;
const NEG_GUTTER = `calc(${GUTTER} * -1)`;

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
 * tab of the same name. `labelClassName` replaces the label's breakpoints for a host whose pane widens
 * differently. `leading` sits left of the strip, in the same row.
 */
export function PanelTabsList({ tabs, stripLabel, labelClassName = 'hidden sm:inline md:hidden xl:inline', leading }: {
  tabs: readonly PanelTab[];
  stripLabel: string;
  labelClassName?: string;
  leading?: ReactNode;
}) {
  const strip = (
    <TabsList
      aria-label={stripLabel}
      className={cn('grid', leading ? 'min-w-0 flex-1' : 'w-full')}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(({ value, label, icon: Icon }) => (
        <TabsTrigger key={value} value={value} aria-label={label} className="gap-1.5">
          <Icon className="h-4 w-4 shrink-0" />
          <span className={labelClassName}>{label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
  return leading ? <div className="flex items-center gap-1">{leading}{strip}</div> : strip;
}

/**
 * An editor detail panel's tabs: the strip is a fixed header row, and each `PanelTabContent` scrolls
 * below it. The panel takes the height its host gives it. One tab is no choice, so it gets no strip, and a
 * chosen tab the current mode hides shows the first tab. A pushed detail's back arrow leads the strip.
 */
export function PanelTabs<T extends string>({ tabs, value, onValueChange, stripLabel, labelClassName, surfaceTabs, children }: {
  tabs: readonly (PanelTab & { value: T })[];
  value: T;
  onValueChange: (value: T) => void;
  stripLabel: string;
  labelClassName?: string;
  /** The tab ledger the panel reports its shown tab under. */
  surfaceTabs?: SurfaceLedgerName;
  children: ReactNode;
}) {
  const shown = tabs.some((t) => t.value === value) ? value : tabs[0].value;
  const back = useListDetailBack();
  return (
    <Tabs value={shown} onValueChange={(v) => onValueChange(v as T)} surfaceTabs={surfaceTabs} className="flex min-h-0 flex-1 flex-col gap-4">
      {tabs.length > 1
        ? <PanelTabsList tabs={tabs} stripLabel={stripLabel} labelClassName={labelClassName} leading={back ? <ListDetailBack onStrip /> : undefined} />
        : back && <div className="flex"><ListDetailBack /></div>}
      {/* The arrow is placed; a panel nested in a tab doesn't place it again. */}
      <ListDetailBackProvider value={null}>{children}</ListDetailBackProvider>
    </Tabs>
  );
}

/** One tab's body under `PanelTabs`. It scrolls on its own; `fill` hands the height to a body that scrolls inside itself. */
export function PanelTabContent({ value, fill = false, className, children }: {
  value: string;
  fill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TabsContent value={value} className="mt-0 min-h-0 flex-1 flex-col data-[state=active]:flex">
      {fill ? children : (
        <ScrollArea
          className="min-h-0 flex-1"
          style={{ marginInline: NEG_GUTTER, marginBottom: NEG_GUTTER }}
          viewportProps={{ 'data-panel-tab-body': '' }}
        >
          <div className={cn('space-y-4', className)} style={{ paddingInline: GUTTER, paddingBottom: GUTTER }}>
            {children}
          </div>
        </ScrollArea>
      )}
    </TabsContent>
  );
}
