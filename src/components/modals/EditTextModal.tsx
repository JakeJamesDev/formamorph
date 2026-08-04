import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useResetOnOpen } from "@/lib/useResetOnOpen";

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

  // Reseed from `text` on each open, not on `text` changing — otherwise cancelling and reopening the same
  // page (unchanged `text`) would leave the discarded edits sitting in the textarea.
  useResetOnOpen(isOpen, () => setEditedText(text));

  const handleSave = () => {
    onSave(editedText);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[600px] max-h-[80dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Text</DialogTitle>
        </DialogHeader>
        <div className="flex-grow min-h-0 my-4">
          <Textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full h-[300px] resize-none"
          />
        </div>
        <DialogFooter>
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
