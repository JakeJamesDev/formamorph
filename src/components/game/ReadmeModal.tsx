import { Checkbox } from "@/components/ui/checkbox";
import { MarkdownModal } from "@/components/MarkdownModal";

/** One of a world's two readmes: the Introduction over the first setup screen, or the Gameplay readme on
 *  entering the game. Close via the X, click-outside, or Esc (Radix Dialog).
 *  The "Don't Show This Again" checkbox writes the inverse of the per-world "show readme" flag, so it
 *  stays in sync with the main-menu "Show Readme" toggle (both back the same stored value, which covers
 *  both readmes — one world, one answer to "show me this world's readmes"). */
const ReadmeModal = ({
  readme,
  open,
  onOpenChange,
  show,
  onShowChange,
  title = 'Readme',
}: {
  readme: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current per-world flag (true = show on entry). */
  show: boolean;
  onShowChange: (show: boolean) => void;
  title?: string;
}) => (
  <MarkdownModal
    open={open}
    onOpenChange={onOpenChange}
    title={title}
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
