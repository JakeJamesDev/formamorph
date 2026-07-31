import { useState } from "react";
import { Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManageUsersTab } from "@/components/menu/ManageUsersTab";
import { BroadcastsTab } from "@/components/menu/BroadcastsTab";
import { PoliciesTab } from "@/components/menu/PoliciesTab";
import { BugsTab } from "@/components/menu/BugsTab";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { type AdminPanelTab } from "@/components/menu/adminPanelTabs";
import { type PoliciesTab as PoliciesSubTab } from "@/components/menu/policiesTabs";

interface AdminPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tab to open on; the dev-router uses this to land on either half directly. */
  initialTab?: AdminPanelTab;
  /** Policies sub-tab to open on, when `initialTab` is `policies`. */
  initialPoliciesTab?: PoliciesSubTab;
}

/** Admin tools behind one dialog: user accounts, and broadcasts to everyone. */
export function AdminPanelDialog({ open, onOpenChange, initialTab = 'users', initialPoliciesTab }: AdminPanelDialogProps) {
  const [tab, setTab] = useState<AdminPanelTab>(initialTab);

  useResetOnOpen(open, () => setTab(initialTab));

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
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
            <TabsTrigger value="bugs">Bugs</TabsTrigger>
          </TabsList>

          {/* Only the panel body scrolls; the title and tab strip stay put. */}
          <TabsContent value="users" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              {/* Each tab fetches only while it is the one on screen. */}
              <ManageUsersTab active={open && tab === 'users'} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="broadcasts" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              <BroadcastsTab active={open && tab === 'broadcasts'} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="policies" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              <PoliciesTab active={open && tab === 'policies'} initialTab={initialPoliciesTab} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="bugs" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0 px-1">
              <BugsTab active={open && tab === 'bugs'} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
