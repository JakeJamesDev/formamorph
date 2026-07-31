import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManageUsersTab } from "@/components/menu/ManageUsersTab";
import { BroadcastsTab } from "@/components/menu/BroadcastsTab";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { type AdminPanelTab } from "@/components/menu/adminPanelTabs";

interface AdminPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tab to open on; the dev-router uses this to land on either half directly. */
  initialTab?: AdminPanelTab;
}

/** Admin tools behind one dialog: user accounts, and broadcasts to everyone. */
export function AdminPanelDialog({ open, onOpenChange, initialTab = 'users' }: AdminPanelDialogProps) {
  const [tab, setTab] = useState<AdminPanelTab>(initialTab);

  useResetOnOpen(open, () => setTab(initialTab));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[85dvh] overflow-y-auto flex flex-col items-start">
        <DialogHeader>
          <DialogTitle>Admin Panel</DialogTitle>
          <DialogDescription>
            Manage user accounts and send broadcasts.
          </DialogDescription>
        </DialogHeader>

        {/* `min-w-0`: DialogContent is a grid, and a grid item's `min-width: auto` lets wide content
            widen the dialog past its max width instead of being contained. */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as AdminPanelTab)}
          className="w-full min-w-0"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            {/* Each tab fetches only while it is the one on screen. */}
            <ManageUsersTab active={open && tab === 'users'} />
          </TabsContent>

          <TabsContent value="broadcasts">
            <BroadcastsTab active={open && tab === 'broadcasts'} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
