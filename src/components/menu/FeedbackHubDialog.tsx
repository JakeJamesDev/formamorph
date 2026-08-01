import { MessageSquarePlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MyFeedbackSection } from "@/components/menu/MyFeedbackSection";
import { type MyFeedbackTabKey } from "@/components/menu/myFeedbackTabs";

interface FeedbackHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Branch to open on; the dev-router uses this to land on either directly. */
  initialTab?: MyFeedbackTabKey;
  /** Fired when a thread is read or replied to, so the count on the button outside stays in step. */
  onChanged?: () => void;
}

/**
 * Everything a reader does with feedback, behind the main menu's Feedback button: browse both branches,
 * read a thread, reply to it, and file a new one.
 *
 * It opens on the lists rather than on the form. Filing is one click from here, and putting the form
 * first meant the queue could only be found by knowing it was somewhere else — which is what made the
 * same thing already filed get filed again. Triage stays in the Admin Panel: reading a thread and
 * deciding what happens to it are different jobs, even for the person who can do both.
 */
export function FeedbackHubDialog({ open, onOpenChange, initialTab, onChanged }: FeedbackHubDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* No description: the tab labels say what each list is. `aria-describedby={undefined}` is Radix's
          opt-out, otherwise it warns about the missing one. */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-[900px] h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4" /> Feedback
          </DialogTitle>
        </DialogHeader>

        {/* `min-w-0`: DialogContent is a grid, and a grid item's `min-width: auto` lets a wide thread
            widen the dialog past its max width instead of being contained. */}
        <ScrollArea className="flex-1 min-h-0 min-w-0 px-1">
          <MyFeedbackSection active={open} initialTab={initialTab} onChanged={onChanged} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
