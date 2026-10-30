import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { CollapsingTabsList } from '@/components/ui/collapsing-tabs-list';
import { ListDetailBack, ListDetailBackProvider } from '@/components/ui/list-detail';
import { useListDetailBack } from '@/components/ui/listDetailBack';
import type { SurfaceLedgerName } from '@/components/ui/surface';
import { useHelpFocus, type HelpFocus } from '@/lib/formaquestion/helpFocus';
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
 * The tab strip an editor detail panel puts above its fields. It folds by its own room: every label, then
 * the selected tab's, then icons alone. See "Pattern: Panel Tab Strip" in the Design System guide.
 *
 * `stripLabel` names the strip, because the editor's own strip is on the same screen and can carry a
 * tab of the same name. `value` is the shown tab. `leading` sits left of the strip, in the same row.
 */
export function PanelTabsList({ tabs, value, stripLabel, leading }: {
  tabs: readonly PanelTab[];
  value: string;
  stripLabel: string;
  leading?: ReactNode;
}) {
  const strip = <CollapsingTabsList tabs={tabs} value={value} aria-label={stripLabel} className={leading ? 'flex-1' : undefined} />;
  return leading ? <div className="flex items-center gap-1">{leading}{strip}</div> : strip;
}

/**
 * An editor detail panel's tabs: the strip is a fixed header row, and each `PanelTabContent` scrolls
 * below it. The panel takes the height its host gives it. One tab is no choice, so it gets no strip, and a
 * chosen tab the current mode hides shows the first tab. A pushed detail's back arrow leads the strip.
 */
export function PanelTabs<T extends string>({ tabs, value, onValueChange, stripLabel, surfaceTabs, focus, children }: {
  tabs: readonly (PanelTab & { value: T })[];
  value: T;
  onValueChange: (value: T) => void;
  stripLabel: string;
  /** The tab ledger the panel reports its shown tab under. */
  surfaceTabs?: SurfaceLedgerName;
  /** The item the panel shows, for Formaquestion. Registered only with `surfaceTabs`, so a panel nested in another stays under its host's focus. */
  focus?: HelpFocus;
  children: ReactNode;
}) {
  useHelpFocus(surfaceTabs ? focus : undefined);
  const shown = tabs.some((t) => t.value === value) ? value : tabs[0].value;
  const back = useListDetailBack();
  return (
    <Tabs value={shown} onValueChange={(v) => onValueChange(v as T)} surfaceTabs={surfaceTabs} className="flex min-h-0 flex-1 flex-col gap-4">
      {tabs.length > 1
        ? <PanelTabsList tabs={tabs} value={shown} stripLabel={stripLabel} leading={back ? <ListDetailBack onStrip /> : undefined} />
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
