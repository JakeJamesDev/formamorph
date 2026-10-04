import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MyFeedbackTab } from "@/components/menu/MyFeedbackTab";
import { type MyFeedbackTabKey } from "@/components/menu/myFeedbackTabs";

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

/** The profile dialog's Feedback tab. Both branches under one tab, the same shape the Admin Panel uses —
 *  they are the same surface with different vocabularies, and side by side they cost the strip two slots. */
export function MyFeedbackSection({ active, initialTab = 'bugs', requestKey, onChanged }: MyFeedbackSectionProps) {
  // Both panels stay mounted, so a switch keeps each branch's search, filters, and page. Closing the
  // dialog unmounts them, so the next open starts on defaults.
  const [tab, setTab] = useState<MyFeedbackTabKey>(initialTab);
  useEffect(() => { if (requestKey) setTab(initialTab); }, [initialTab, requestKey]);

  return (
    <div className="min-w-0">
      <Tabs surfaceTabs="feedbackHub" value={tab} onValueChange={(value) => setTab(value as MyFeedbackTabKey)} className="w-full min-w-0">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bugs">Bugs</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        </TabsList>

        <TabsContent value="bugs" forceMount className="min-w-0 data-[state=inactive]:hidden">
          <MyFeedbackTab active={active && tab === 'bugs'} type="bug" onChanged={onChanged} />
        </TabsContent>

        <TabsContent value="suggestions" forceMount className="min-w-0 data-[state=inactive]:hidden">
          <MyFeedbackTab active={active && tab === 'suggestions'} type="suggestion" onChanged={onChanged} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
