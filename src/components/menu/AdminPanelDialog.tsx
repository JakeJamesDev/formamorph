import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManageUsersTab } from "@/components/menu/ManageUsersTab";
import { BroadcastsTab } from "@/components/menu/BroadcastsTab";
import { PoliciesTab } from "@/components/menu/PoliciesTab";
import { EventsTab } from "@/components/menu/EventsTab";
import { FeedbackTab } from "@/components/menu/FeedbackTab";
import { ReportsTab } from "@/components/menu/ReportsTab";
import { AuditLogTab } from "@/components/menu/AuditLogTab";
import { ServerSettingsTab } from "@/components/menu/ServerSettingsTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import {
  ADMIN_PANEL_OWNER_TABS,
  ADMIN_PANEL_TAB_LABELS,
  ADMIN_PANEL_TABS,
  type AdminPanelTab,
} from "@/components/menu/adminPanelTabs";
import { type PoliciesTab as PoliciesSubTab } from "@/components/menu/policiesTabs";
import { type FeedbackTab as FeedbackSubTab } from "@/components/menu/feedbackTabs";
import { isAdmin } from "@/lib/roles";
import AuthService from "@/services/AuthService";
import ReportService from "@/services/ReportService";

interface AdminPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tab to open on; the dev-router uses this to land on either half directly. */
  initialTab?: AdminPanelTab;
  /** Policies sub-tab to open on, when `initialTab` is `policies`. */
  initialPoliciesTab?: PoliciesSubTab;
  /** Feedback sub-tab to open on, when `initialTab` is `feedback`. */
  initialFeedbackTab?: FeedbackSubTab;
  /** Opens a reported listing — or the listing a reported comment sits on — in Community Creations.
   *  Absent leaves those groups readable but not followable. */
  onOpenListing?: (listingId: string) => void;
  /** Called when the open-report count may have changed, so the caller's own badge can re-read it. */
  onReportsChanged?: () => void;
}

/** Admin tools behind one dialog: accounts, broadcasts, the publish policies, both feedback queues, and
 *  the record of what was done. */
export function AdminPanelDialog({
  open, onOpenChange, initialTab = 'users', initialPoliciesTab, initialFeedbackTab,
  onOpenListing, onReportsChanged,
}: AdminPanelDialogProps) {
  // Broadcasts, Policies and Server are an administrator's: speaking to everyone at once, writing what
  // the site requires, and changing what the server does are not moderation. The server's own routes
  // allow any staff, so hiding the tab is a courtesy rather than the guard.
  // The rest of the panel is the everyday work, open to any staff —
  // Events included: the calendar is worth reading whether or not a viewer may act on it.
  const owner = isAdmin(AuthService.getCurrentUser());

  const [tab, setTab] = useState<AdminPanelTab>(initialTab);
  // How many targets have an open report on them. Zero against a server without the feature, so the tab
  // simply carries no count rather than reporting a failure nobody can act on.
  const [openReports, setOpenReports] = useState(0);

  const readOpenReports = useCallback(() => {
    void ReportService.fetchOpenCount().then(setOpenReports);
    onReportsChanged?.();
  }, [onReportsChanged]);

  useResetOnOpen(open, () => setTab(initialTab));

  // Read once per opening rather than per tab switch: it labels a tab the reader can see from anywhere
  // in the panel, and a resolution re-reads it on the spot.
  useEffect(() => {
    if (!open) return;
    void ReportService.fetchOpenCount().then(setOpenReports);
  }, [open]);

  // Also honor a *change* of `initialTab` while the dialog is already open — the dev-router points at a
  // tab by changing this prop, and without it a second `goto` at an open panel is silently ignored.
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  // A moderator pointed at a tab they cannot see — by the dev-router, or by a panel left open through a
  // demotion — lands on Users rather than on an empty dialog.
  useEffect(() => {
    if (!owner && ADMIN_PANEL_OWNER_TABS.includes(tab)) setTab('users');
  }, [owner, tab]);

  // One list drives both the strip and the narrow-width select, so they cannot offer different tabs.
  // The count rides the Reports label rather than a badge beside it: the strip is a fixed grid, and a
  // floating badge on one trigger shifts every other one's text off center.
  const visibleTabs = ADMIN_PANEL_TABS
    .filter((value) => owner || !ADMIN_PANEL_OWNER_TABS.includes(value))
    .map((value) => ({
      value,
      label: value === 'reports' && openReports > 0
        ? `Reports (${openReports > 9 ? '9+' : openReports})`
        : ADMIN_PANEL_TAB_LABELS[value],
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* No description: the tab labels say what each panel is. `aria-describedby={undefined}` is
          Radix's opt-out, otherwise it warns about the missing one. */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-[900px] h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Admin Panel</DialogTitle>
        </DialogHeader>

        {/* `min-w-0`: DialogContent is a grid, and a grid item's `min-width: auto` lets wide content
            widen the dialog past its max width instead of being contained. */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as AdminPanelTab)}
          className="w-full min-w-0 flex flex-col flex-1 min-h-0"
        >
          {/* The labels do not fit a narrow dialog, so the strip becomes a select of the current tab, as
              the Settings dialog does. Both drive the same `tab` state.
              The switch width follows the tab count, because the two roles need different room. The
              widest label is "Reports (9+)", 98px in the widest selectable font. Eight equal cells reach
              that only once the dialog is at its 900px cap (105px cells; 768px gives 89px), five already
              at `sm` (118px). So the administrator's switch is the cap itself rather than a standard
              breakpoint. `admin-panel-widths.spec.ts` holds the measurement. */}
          <Select value={tab} onValueChange={(value) => setTab(value as AdminPanelTab)}>
            <SelectTrigger
              aria-label="Admin Panel section"
              className={cn('w-full flex-shrink-0', owner ? 'min-[900px]:hidden' : 'sm:hidden')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibleTabs.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <TabsList
            className={cn(
              'hidden w-full flex-shrink-0',
              owner ? 'min-[900px]:grid grid-cols-8' : 'sm:grid grid-cols-5',
            )}
          >
            {visibleTabs.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>

          {/* Only the panel body scrolls; the title and tab strip stay put. */}
          <TabsContent value="users" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              {/* Each tab fetches only while it is the one on screen. */}
              <ManageUsersTab active={open && tab === 'users'} />
            </ScrollArea>
          </TabsContent>

          {owner && (
            <TabsContent value="broadcasts" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1 min-h-0 px-1">
                <BroadcastsTab active={open && tab === 'broadcasts'} />
              </ScrollArea>
            </TabsContent>
          )}

          {owner && (
            <TabsContent value="policies" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1 min-h-0 px-1">
                <PoliciesTab active={open && tab === 'policies'} initialTab={initialPoliciesTab} />
              </ScrollArea>
            </TabsContent>
          )}

          {owner && (
            <TabsContent value="serverSettings" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1 min-h-0 px-1">
                <ServerSettingsTab active={open && tab === 'serverSettings'} />
              </ScrollArea>
            </TabsContent>
          )}

          <TabsContent value="events" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              <EventsTab active={open && tab === 'events'} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="feedback" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              <FeedbackTab active={open && tab === 'feedback'} initialTab={initialFeedbackTab} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="reports" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              <ReportsTab
                active={open && tab === 'reports'}
                onOpenListing={onOpenListing}
                onResolved={readOpenReports}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="log" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              <AuditLogTab active={open && tab === 'log'} />
            </ScrollArea>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
