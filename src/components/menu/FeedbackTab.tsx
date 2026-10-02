import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackQueueTab } from "@/components/menu/FeedbackQueueTab";
import { type FeedbackTab as FeedbackSubTab } from "@/components/menu/feedbackTabs";

interface FeedbackTabProps {
  /** Whether the tab is visible; the queue below only fetches while it is. */
  active: boolean;
  /** Sub-tab to open on; the dev-router uses this to land on either branch directly. */
  initialTab?: FeedbackSubTab;
}

/** Admin Panel → Feedback. Both branches under one tab: they are the same surface with different
 *  vocabularies, and side by side they cost the strip two of its six slots. */
export function FeedbackTab({ active, initialTab = 'bugs' }: FeedbackTabProps) {
  // Both panels stay mounted, so a switch keeps each branch's search, filters, and page. Closing the
  // dialog unmounts them, so the next open starts on defaults.
  const [tab, setTab] = useState<FeedbackSubTab>(initialTab);

  return (
    <div className="py-4 min-w-0">
      <Tabs value={tab} onValueChange={(value) => setTab(value as FeedbackSubTab)} className="w-full min-w-0">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bugs">Bugs</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        </TabsList>

        <TabsContent value="bugs" forceMount className="min-w-0 data-[state=inactive]:hidden">
          <FeedbackQueueTab active={active && tab === 'bugs'} type="bug" />
        </TabsContent>

        <TabsContent value="suggestions" forceMount className="min-w-0 data-[state=inactive]:hidden">
          <FeedbackQueueTab active={active && tab === 'suggestions'} type="suggestion" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
