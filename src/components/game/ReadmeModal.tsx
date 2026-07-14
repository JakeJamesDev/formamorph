import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";

/** World README shown to the player on entry. Close via the X, click-outside, or Esc (Radix Dialog).
 *  The "Don't Show This Again" checkbox writes the inverse of the per-world "show readme" flag, so it
 *  stays in sync with the main-menu "Show Readme" toggle (both back the same stored value). */
const ReadmeModal = ({
  readme,
  open,
  onOpenChange,
  show,
  onShowChange,
}: {
  readme: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current per-world flag (true = show on entry). */
  show: boolean;
  onShowChange: (show: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[640px] max-h-[85dvh] flex flex-col">
      <DialogHeader className="shrink-0">
        <DialogTitle>Readme</DialogTitle>
      </DialogHeader>

      <ScrollArea className="flex-1 min-h-0 pr-3">
        <MarkdownRenderer text={readme} />
      </ScrollArea>

      <div className="shrink-0 flex items-center gap-2">
        <Checkbox
          id="readme-dont-show"
          checked={!show}
          onCheckedChange={(c) => onShowChange(c !== true)}
        />
        <label htmlFor="readme-dont-show" className="text-sm cursor-pointer">Don&apos;t Show This Again</label>
      </div>
    </DialogContent>
  </Dialog>
);

export default ReadmeModal;
