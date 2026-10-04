import { useEffect, useState, type ReactNode } from 'react';
import { PromptDiffModeToggle, PromptDiffView, type PromptDiffMode } from '@/components/game/PromptDiff';
import { TokenChip } from '@/components/prompt/TokenChip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SurfaceIdName } from '@/components/ui/surface';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { RESET_COMPARE_COPY } from './promptResetCompareCopy';

/** `text` with each chip the vocabulary knows drawn as its pill. */
function withChips(text: string, vocab: ChipVocabulary): ReactNode {
  return vocab.parse(text).map((segment, i) => (segment.type === 'variable' ? <TokenChip key={i} token={segment.token} vocab={vocab} /> : segment.value));
}

/**
 * An edited prompt against the default text the caller passes, in the prompt diff viewer. The Raw view
 * shows the edited text as it is stored.
 */
export function PromptCompareDialog({ open, onOpenChange, name, defaultText, text, vocabulary, surface }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The full noun of the prompt, such as "Narration Prompt". */
  name: string;
  defaultText: string;
  text: string;
  /** The chip family of the prompt, so a chip reads as its pill on both sides of the diff. */
  vocabulary: ChipVocabulary;
  surface: SurfaceIdName;
}) {
  // Reset to Changes at each open: the view is a reading preference for one sitting.
  const [mode, setMode] = useState<PromptDiffMode>('changes');
  useEffect(() => { if (open) setMode('changes'); }, [open]);
  const { legend } = RESET_COMPARE_COPY.compare;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface={surface} className="flex h-[85dvh] flex-col sm:max-w-[700px]">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="leading-normal">{RESET_COMPARE_COPY.compare.title(name)}</DialogTitle>
            <PromptDiffModeToggle mode={mode} onModeChange={setMode} />
          </div>
          <DialogDescription>
            {legend.lead}{' '}
            <span className="rounded-[2px] bg-emerald-500/25 px-0.5 text-foreground">added</span>{' '}
            {legend.mid}{' '}
            <span className="rounded-[2px] bg-red-500/10 px-0.5 text-red-600 line-through decoration-red-500/70 dark:text-red-400">removed</span>{' '}
            {legend.tail}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 rounded-md bg-muted">
          <div className="p-4">
            <PromptDiffView base={defaultText} text={text} mode={mode} renderChips={(value) => withChips(value, vocabulary)} />
          </div>
        </ScrollArea>
        <div className="flex shrink-0 justify-end">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
