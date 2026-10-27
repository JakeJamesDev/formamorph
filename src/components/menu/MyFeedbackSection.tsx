import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MyFeedbackTab } from "@/components/menu/MyFeedbackTab";
import { FEEDBACK_TABS, FEEDBACK_TAB_TYPES, type FeedbackTab as MyFeedbackTabKey } from "@/components/menu/feedbackTabs";
import { FEEDBACK_TYPE_LABELS, TAB_GRID_COLUMNS } from "@/lib/feedbackPresentation";
import {
  APP_FEEDBACK_CAPABILITIES, type FeedbackCapabilities, type FeedbackNotify,
} from "@/lib/feedbackCapabilities";
import { cn } from "@/lib/utils";

interface MyFeedbackSectionProps {
  /** Whether the tab is visible; the list below only fetches while it is. */
  active: boolean;
  /** Sub-tab to open on; the dev-router uses this to land on either branch directly. */
  initialTab?: MyFeedbackTabKey;
  /** Changes with each outside request, so a repeat request selects its tab again. */
  requestKey?: string;
  /** Fired when a thread is read or replied to, so the badge outside stays in step. */
  onChanged?: () => void;
  /** Reports each result to the reader. */
  notify: FeedbackNotify;
  /** What this surface may show and do; the app's full set when omitted. */
  capabilities?: FeedbackCapabilities;
  /** Set for a guest: Vote, Reply and New call it instead of the service. */
  onGuestWrite?: () => void;
  /** The selected tab and its setter, when the caller owns the selection. */
  tabControl?: { tab: MyFeedbackTabKey; onTabChange: (tab: MyFeedbackTabKey) => void };
  /** Opens a thread somewhere else; the tabs then never show one themselves. */
  onOpenThread?: (id: string, number: number) => void;
}

/** The profile dialog's Feedback tab. Every branch under one tab, the same shape the Admin Panel uses —
 *  they are the same surface with different vocabularies, and side by side they would cost the strip three slots. */
export function MyFeedbackSection({
  active, initialTab: requestedTab = 'bugs', requestKey, onChanged, notify, capabilities = APP_FEEDBACK_CAPABILITIES, onGuestWrite,
  tabControl, onOpenThread,
}: MyFeedbackSectionProps) {
  const tabs = FEEDBACK_TABS.filter((key) => capabilities.boards.includes(FEEDBACK_TAB_TYPES[key]));
  const initialTab = tabs.includes(requestedTab) ? requestedTab : tabs[0];
  // Every panel stays mounted, so a switch keeps each branch's search, filters, and page. Closing the
  // dialog unmounts them, so the next open starts on defaults.
  const [ownTab, setOwnTab] = useState<MyFeedbackTabKey>(initialTab);
  useEffect(() => { if (requestKey) setOwnTab(initialTab); }, [initialTab, requestKey]);
  const tab = tabControl?.tab ?? ownTab;
  const setTab = tabControl?.onTabChange ?? setOwnTab;

  return (
    <div className="min-w-0">
      <Tabs surfaceTabs="feedbackHub" value={tab} onValueChange={(value) => setTab(value as MyFeedbackTabKey)} className="w-full min-w-0">
        <TabsList className={cn('grid w-full', TAB_GRID_COLUMNS[tabs.length])}>
          {tabs.map((key) => (
            <TabsTrigger key={key} value={key}>{FEEDBACK_TYPE_LABELS[FEEDBACK_TAB_TYPES[key]].many}</TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((key) => (
          <TabsContent key={key} value={key} forceMount className="min-w-0 data-[state=inactive]:hidden">
            <MyFeedbackTab
              active={active && tab === key}
              type={FEEDBACK_TAB_TYPES[key]}
              onChanged={onChanged}
              notify={notify}
              capabilities={capabilities}
              onGuestWrite={onGuestWrite}
              onOpenThread={onOpenThread}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
