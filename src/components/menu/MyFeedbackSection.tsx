import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MyFeedbackTab } from "@/components/menu/MyFeedbackTab";
import { FEEDBACK_TABS, FEEDBACK_TAB_TYPES, type FeedbackTab as MyFeedbackTabKey } from "@/components/menu/feedbackTabs";
import { FEEDBACK_TYPE_LABELS } from "@/lib/feedbackPresentation";

interface MyFeedbackSectionProps {
  /** Whether the tab is visible; the list below only fetches while it is. */
  active: boolean;
  /** Sub-tab to open on; the dev-router uses this to land on either branch directly. */
  initialTab?: MyFeedbackTabKey;
  /** Changes with each outside request, so a repeat request selects its tab again. */
  requestKey?: string;
  /** Fired when a thread is read or replied to, so the badge outside stays in step. */
  onChanged?: () => void;
}

/** The profile dialog's Feedback tab. Every branch under one tab, the same shape the Admin Panel uses —
 *  they are the same surface with different vocabularies, and side by side they would cost the strip three slots. */
export function MyFeedbackSection({ active, initialTab = 'bugs', requestKey, onChanged }: MyFeedbackSectionProps) {
  // Every panel stays mounted, so a switch keeps each branch's search, filters, and page. Closing the
  // dialog unmounts them, so the next open starts on defaults.
  const [tab, setTab] = useState<MyFeedbackTabKey>(initialTab);
  useEffect(() => { if (requestKey) setTab(initialTab); }, [initialTab, requestKey]);

  return (
    <div className="min-w-0">
      <Tabs surfaceTabs="feedbackHub" value={tab} onValueChange={(value) => setTab(value as MyFeedbackTabKey)} className="w-full min-w-0">
        <TabsList className="grid w-full grid-cols-3">
          {FEEDBACK_TABS.map((key) => (
            <TabsTrigger key={key} value={key}>{FEEDBACK_TYPE_LABELS[FEEDBACK_TAB_TYPES[key]].many}</TabsTrigger>
          ))}
        </TabsList>

        {FEEDBACK_TABS.map((key) => (
          <TabsContent key={key} value={key} forceMount className="min-w-0 data-[state=inactive]:hidden">
            <MyFeedbackTab active={active && tab === key} type={FEEDBACK_TAB_TYPES[key]} onChanged={onChanged} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
