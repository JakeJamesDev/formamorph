import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** A regenerated text shown before it replaces anything. Takes any entry: a memory row or a diary entry. */
export const RegeneratePreview = ({
  current,
  proposed,
  onKeep,
  onDiscard,
}: {
  /** The text Keep would replace. */
  current: string;
  proposed: string;
  onKeep: () => void;
  onDiscard: () => void;
}) => (
  <div className="space-y-2" role="group" aria-label="Rewrite Preview">
    <p className="text-meta">{proposed}</p>
    <p className="border-l-2 border-border pl-2 text-[10px] text-muted-foreground">Replaces: {current}</p>
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" className="h-7" onClick={onDiscard}>
        <X className="mr-1 h-3.5 w-3.5" /> Discard
      </Button>
      <Button size="sm" className="h-7" onClick={onKeep}>
        <Check className="mr-1 h-3.5 w-3.5" /> Keep
      </Button>
    </div>
  </div>
);
