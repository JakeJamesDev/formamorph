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
  // Radix unmounts an inactive tab panel, so each branch remounts on every visit — which is what keeps
  // its filters from carrying over from the last look.
  const [tab, setTab] = useState<FeedbackSubTab>(initialTab);

  return (
    <div className="py-4 min-w-0">
      <Tabs value={tab} onValueChange={(value) => setTab(value as FeedbackSubTab)} className="w-full min-w-0">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bugs">Bugs</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        </TabsList>

        <TabsContent value="bugs" className="min-w-0">
          <FeedbackQueueTab active={active && tab === 'bugs'} type="bug" />
        </TabsContent>

        <TabsContent value="suggestions" className="min-w-0">
          <FeedbackQueueTab active={active && tab === 'suggestions'} type="suggestion" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
