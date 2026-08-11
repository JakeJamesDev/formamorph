import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, dialogFullHeight } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { cn } from "@/lib/utils";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { useMorphResize } from "@/lib/useMorphFullscreen";

// Narration is prose, not a template: `plainVocabulary` chips nothing, so a brace the AI happened to write
// stays the text it is.
const VOCABULARY = plainVocabulary();

export const EditTextModal = ({
  isOpen,
  onOpenChange,
  text,
  onSave
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  onSave: (text: string) => void;
}) => {
  const [editedText, setEditedText] = useState(text);
  const [fullscreen, setFullscreen] = useState(false);
  // This window grows in place rather than raising a second one over itself, so the trip is the dialog
  // travelling between its own two sizes — the same animation, measured on one element.
  const morphRef = useMorphResize(fullscreen ? 'full' : 'window');

  // Reseed from `text` on each open, not on `text` changing — otherwise cancelling and reopening the same
  // page (unchanged `text`) would leave the discarded edits sitting in the editor. Fullscreen resets with
  // it, so a dialog never reopens filling the screen for a small edit.
  useResetOnOpen(isOpen, () => { setEditedText(text); setFullscreen(false); });

  const handleSave = () => {
    onSave(editedText);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        ref={morphRef}
        hideClose
        // The stock zoom-and-slide writes `transform` too, and this window animates its own resize. Two
        // owners of one property means whichever runs second wins, mid-trip.
        unanimated
        aria-describedby={undefined}
        className={cn(
          'flex flex-col',
          // Centered by margins, not by `translate(-50%, -50%)` as a dialog normally is. This one is the
          // only window that animates *itself* between two sizes, and a trip that has to compose with a
          // centering transform inherits every other thing writing to that property. Margin centering
          // leaves `transform` free for the animation alone.
          'inset-0 m-auto translate-x-0 translate-y-0',
          // Growing this dialog rather than letting the field raise its own overlay: an overlay inside a
          // dialog is a window on top of a window, and the buttons that save the edit would be under it.
          // A fixed height, not a max: the window keeps its size and the editor scrolls inside it, so a long
          // turn and a short one open the same box.
          fullscreen ? `${dialogFullHeight} max-w-none w-screen rounded-none` : 'sm:max-w-[760px] h-[85dvh]',
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-label">Edit Text</DialogTitle>
        </DialogHeader>
        {/* No margins of its own: the dialog's own `gap-4` spaces header, editor and footer evenly, where
            extra margin here stacked on top of it. */}
        <div className="flex-grow min-h-0 flex flex-col">
          <PromptField
            value={editedText}
            onChange={setEditedText}
            vocabulary={VOCABULARY}
            markdown
            ariaLabel="Edit text"
            className="flex-grow min-h-0"
            onRequestFullscreen={() => setFullscreen((f) => !f)}
            fullscreen={fullscreen}
          />
        </div>
        {/* A row at every width: two short buttons never need the stacked form. */}
        <DialogFooter className="flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
