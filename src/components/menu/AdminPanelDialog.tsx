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
import { ModerationTab } from "@/components/menu/ModerationTab";
import { type ModerationTab as ModerationSubTab } from "@/components/menu/moderationTabs";
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
import { useListingReviewMeta } from "@/lib/useListingReviewMeta";
import { useMountedRef } from "@/lib/useMountedRef";
import AuthService from "@/services/AuthService";
import ReportService from "@/services/ReportService";
import ReviewService from "@/services/ReviewService";

interface AdminPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tab to open on; the dev-router uses this to land on either half directly. */
  initialTab?: AdminPanelTab;
  /** Policies sub-tab to open on, when `initialTab` is `policies`. */
  initialPoliciesTab?: PoliciesSubTab;
  /** Feedback sub-tab to open on, when `initialTab` is `feedback`. */
  initialFeedbackTab?: FeedbackSubTab;
  /** Moderation sub-tab to open on, when `initialTab` is `moderation`. */
  initialModerationTab?: ModerationSubTab;
  /** Review item to open on arrival, when the Review sub-tab opens. */
  initialReviewItemId?: string;
  /** Opens a reported listing — or the listing a reported comment sits on — in Community Creations.
   *  Absent leaves those groups readable but not followable. */
  onOpenListing?: (listingId: string) => void;
  /** Called when the open-report or waiting-review count may have changed, so the caller's own badge can re-read it. */
  onQueuesChanged?: () => void;
}

/** Admin tools behind one dialog: accounts, broadcasts, the publish policies, both feedback queues, and
 *  the record of what was done. */
export function AdminPanelDialog({
  open, onOpenChange, initialTab = 'users', initialPoliciesTab, initialFeedbackTab, initialModerationTab,
  initialReviewItemId, onOpenListing, onQueuesChanged,
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
  const [waitingReviews, setWaitingReviews] = useState(0);
  const review = useListingReviewMeta(open);
  const mounted = useMountedRef();

  const readOpenReports = useCallback(() => {
    void ReportService.fetchOpenCount().then((count) => { if (mounted.current) setOpenReports(count); });
    onQueuesChanged?.();
  }, [onQueuesChanged, mounted]);

  const readWaitingReviews = useCallback(() => {
    void ReviewService.fetchCount().then((count) => { if (mounted.current) setWaitingReviews(count); });
    onQueuesChanged?.();
  }, [onQueuesChanged, mounted]);

  useResetOnOpen(open, () => setTab(initialTab));

  // Read once per opening rather than per tab switch: they label a tab the reader can see from anywhere
  // in the panel, and a decision re-reads them on the spot.
  useEffect(() => {
    if (!open) return;
    void ReportService.fetchOpenCount().then((count) => { if (mounted.current) setOpenReports(count); });
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !review.supported) return;
    void ReviewService.fetchCount().then((count) => { if (mounted.current) setWaitingReviews(count); });
  }, [open, review.supported, mounted]);

  // Also honor a *change* of `initialTab` while the dialog is already open — the dev-router points at a
  // tab by changing this prop, and without it a second `goto` at an open panel is silently ignored.
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  // A moderator pointed at a tab they cannot see — by the dev-router, or by a panel left open through a
  // demotion — lands on Users rather than on an empty dialog.
  useEffect(() => {
    if (!owner && ADMIN_PANEL_OWNER_TABS.includes(tab)) setTab('users');
  }, [owner, tab]);

  // One list drives both the strip and the narrow-width select, so they cannot offer different tabs.
  // No count on the strip: "Moderation (9+)" overflows a cell in the widest fonts. The counts ride the
  // Moderation tab's own Reports and Review segments.
  const visibleTabs = ADMIN_PANEL_TABS
    .filter((value) => owner || !ADMIN_PANEL_OWNER_TABS.includes(value))
    .map((value) => ({ value, label: ADMIN_PANEL_TAB_LABELS[value] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* No description: the tab labels say what each panel is. `aria-describedby={undefined}` is
          Radix's opt-out, otherwise it warns about the missing one. */}
      <DialogContent surface="adminPanel" aria-describedby={undefined} className="sm:max-w-[1000px] h-[90dvh] flex flex-col overflow-hidden">
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
              widest label is "Moderation", 96px in OpenDyslexic. The administrator's eight cells switch at
              the dialog's 1000px cap (118px cells), the moderator's five at `md` (143px).
              `admin-panel-widths.spec.ts` holds the measurement in every selectable font. */}
          <Select value={tab} onValueChange={(value) => setTab(value as AdminPanelTab)}>
            <SelectTrigger
              aria-label="Admin Panel section"
              className={cn('w-full flex-shrink-0', owner ? 'min-[1000px]:hidden' : 'md:hidden')}
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
              owner ? 'min-[1000px]:grid grid-cols-8' : 'md:grid grid-cols-5',
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

          {/* Stays mounted, so leaving and returning keeps the queues' search, filters, and page. */}
          <TabsContent value="feedback" forceMount className="flex-1 min-h-0 data-[state=active]:flex data-[state=inactive]:hidden flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              <FeedbackTab active={open && tab === 'feedback'} initialTab={initialFeedbackTab} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="moderation" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              <ModerationTab
                active={open && tab === 'moderation'}
                initialTab={initialModerationTab}
                reviewSupported={review.supported}
                openReports={openReports}
                waitingReviews={waitingReviews}
                onOpenListing={onOpenListing}
                onReportsResolved={readOpenReports}
                onReviewChanged={readWaitingReviews}
                initialReviewItemId={initialReviewItemId}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="log" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              <AuditLogTab active={open && tab === 'log'} onOpenListing={onOpenListing} />
            </ScrollArea>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
