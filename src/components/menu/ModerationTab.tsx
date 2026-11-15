import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportsTab } from "@/components/menu/ReportsTab";
import { ReviewTab } from "@/components/menu/ReviewTab";
import { AutoApprovedTab } from "@/components/menu/AutoApprovedTab";
import { MentionsTab } from "@/components/menu/MentionsTab";
import { countLabel, type ModerationTab as ModerationSubTab } from "@/components/menu/moderationTabs";

const SEGMENT = "min-w-0 whitespace-normal px-2 text-center leading-tight";

interface ModerationTabProps {
  /** Whether the tab is visible; the queues below only fetch while it is. */
  active: boolean;
  /** Sub-tab to open on; the dev-router uses this to land on either queue directly. */
  initialTab?: ModerationSubTab;
  /** Whether the server has listing review. Without it, the tab is the report queue alone. */
  reviewSupported: boolean;
  openReports: number;
  waitingReviews: number;
  /** Contributed Character Mentions corrections waiting for review. */
  waitingMentions: number;
  onMentionsChanged?: () => void;
  onOpenListing?: (listingId: string) => void;
  onReportsResolved?: () => void;
  onReviewChanged?: () => void;
  /** Review item to open on arrival; the dev-router's `pick`. */
  initialReviewItemId?: string;
}

/** Admin Panel → Moderation. The queues of work that wait on staff: reports, listing review and mention corrections. */
export function ModerationTab({
  active, initialTab, reviewSupported, openReports, waitingReviews, waitingMentions, onMentionsChanged,
  onOpenListing, onReportsResolved, onReviewChanged, initialReviewItemId,
}: ModerationTabProps) {
  const [tab, setTab] = useState<ModerationSubTab>(initialTab ?? 'reports');

  // A second dev-router `goto` changes this prop while the panel is open.
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  if (!reviewSupported) {
    return <ReportsTab active={active} onOpenListing={onOpenListing} onResolved={onReportsResolved} />;
  }

  return (
    <div className="py-4 min-w-0">
      <Tabs value={tab} onValueChange={(value) => setTab(value as ModerationSubTab)} className="w-full min-w-0">
        {/* Four cells on a phone: a label wraps (Auto-Approved at its hyphen) instead of spilling over its neighbor. */}
        <TabsList className="grid h-auto w-full grid-cols-4">
          <TabsTrigger value="reports" className={SEGMENT}>{countLabel('Reports', openReports)}</TabsTrigger>
          <TabsTrigger value="review" className={SEGMENT}>{countLabel('Review', waitingReviews)}</TabsTrigger>
          <TabsTrigger value="auto" className={SEGMENT}>Auto-Approved</TabsTrigger>
          <TabsTrigger value="mentions" className={SEGMENT}>{countLabel('Mentions', waitingMentions)}</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="min-w-0">
          <ReportsTab active={active && tab === 'reports'} onOpenListing={onOpenListing} onResolved={onReportsResolved} />
        </TabsContent>

        <TabsContent value="review" className="min-w-0">
          <ReviewTab
            active={active && tab === 'review'}
            onOpenListing={onOpenListing}
            onChanged={onReviewChanged}
            initialItemId={initialReviewItemId}
          />
        </TabsContent>

        <TabsContent value="auto" className="min-w-0">
          <AutoApprovedTab active={active && tab === 'auto'} onOpenListing={onOpenListing} />
        </TabsContent>

        <TabsContent value="mentions" className="min-w-0">
          <MentionsTab active={active && tab === 'mentions'} onChanged={onMentionsChanged} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
