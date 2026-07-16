import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClosingSnapshot } from "@/lib/useClosingSnapshot";

/** Short name-input dialog for adding or renaming a system-prompt preset. Trims input; ignores empty. */
export const PresetNameDialog = ({
  open,
  mode,
  initialName,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: 'add' | 'rename';
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}) => {
  const [name, setName] = useState(initialName);

  // Reseed whenever the dialog (re)opens so Add starts empty and Rename shows the current name.
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  // Hold the title's mode through the fade-out — the parent flips `mode` back to 'add' as it closes.
  const shownMode = useClosingSnapshot(open, mode);

  const trimmed = name.trim();
  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{shownMode === 'add' ? 'New Preset' : 'Rename Preset'}</DialogTitle>
        </DialogHeader>
        <div className="my-4">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="Preset name"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!trimmed}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
