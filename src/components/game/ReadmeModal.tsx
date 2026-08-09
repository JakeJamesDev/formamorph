import { Checkbox } from "@/components/ui/checkbox";
import { MarkdownModal } from "@/components/MarkdownModal";

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
  <MarkdownModal
    open={open}
    onOpenChange={onOpenChange}
    title="Readme"
    text={readme}
    footer={
      <div className="flex items-center gap-2">
        <Checkbox
          id="readme-dont-show"
          checked={!show}
          onCheckedChange={(c) => onShowChange(c !== true)}
        />
        <label htmlFor="readme-dont-show" className="text-label cursor-pointer">Don&apos;t Show This Again</label>
      </div>
    }
  />
);

export default ReadmeModal;
