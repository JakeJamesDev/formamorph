import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackQueueTab } from "@/components/menu/FeedbackQueueTab";
import { FEEDBACK_TABS, FEEDBACK_TAB_TYPES, type FeedbackTab as FeedbackSubTab } from "@/components/menu/feedbackTabs";
import { FEEDBACK_TYPE_LABELS } from "@/lib/feedbackPresentation";

interface FeedbackTabProps {
  /** Whether the tab is visible; the queue below only fetches while it is. */
  active: boolean;
  /** Sub-tab to open on; the dev-router uses this to land on either branch directly. */
  initialTab?: FeedbackSubTab;
}

/** Admin Panel → Feedback. Every branch under one tab: they are the same surface with different
 *  vocabularies, and side by side they would cost the strip three of its slots. */
export function FeedbackTab({ active, initialTab = 'bugs' }: FeedbackTabProps) {
  // Every panel stays mounted, so a switch keeps each branch's search, filters, and page. Closing the
  // dialog unmounts them, so the next open starts on defaults.
  const [tab, setTab] = useState<FeedbackSubTab>(initialTab);

  return (
    <div className="py-4 min-w-0">
      <Tabs value={tab} onValueChange={(value) => setTab(value as FeedbackSubTab)} className="w-full min-w-0">
        <TabsList className="grid w-full grid-cols-3">
          {FEEDBACK_TABS.map((key) => (
            <TabsTrigger key={key} value={key}>{FEEDBACK_TYPE_LABELS[FEEDBACK_TAB_TYPES[key]].many}</TabsTrigger>
          ))}
        </TabsList>

        {FEEDBACK_TABS.map((key) => (
          <TabsContent key={key} value={key} forceMount className="min-w-0 data-[state=inactive]:hidden">
            <FeedbackQueueTab active={active && tab === key} type={FEEDBACK_TAB_TYPES[key]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
