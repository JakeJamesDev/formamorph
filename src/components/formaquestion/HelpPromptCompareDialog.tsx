import { useEffect, useState, type ReactNode } from 'react';
import { PromptDiffModeToggle, PromptDiffView, type PromptDiffMode } from '@/components/game/PromptDiff';
import { TokenChip } from '@/components/prompt/TokenChip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HELP_CHIP, helpChipVocabulary, parseHelpPrompt } from '@/lib/formaquestion/helpChips';
import { COMPARE_COPY } from './formaquestionSettingsTabs';

const VOCABULARY = helpChipVocabulary(Object.values(HELP_CHIP));

/** `text` with each help chip drawn as its pill. */
function withHelpChips(text: string): ReactNode {
  return parseHelpPrompt(text).map((segment, i) => (segment.type === 'variable' ? <TokenChip key={i} token={segment.token} vocab={VOCABULARY} /> : segment.value));
}

/**
 * A custom help prompt against the current default text, in the prompt diff viewer. It opens over
 * Formaquestion Settings. The Raw view shows the custom text as it is stored.
 */
export function HelpPromptCompareDialog({ open, onOpenChange, label, defaultText, text }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The name of the prompt, as the rail shows it. */
  label: string;
  defaultText: string;
  text: string;
}) {
  // Reset to Changes at each open: the view is a reading preference for one sitting.
  const [mode, setMode] = useState<PromptDiffMode>('changes');
  useEffect(() => { if (open) setMode('changes'); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="formaquestionCompare" className="flex h-[85dvh] flex-col sm:max-w-[700px]">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="leading-normal">{COMPARE_COPY.title(label)}</DialogTitle>
            <PromptDiffModeToggle mode={mode} onModeChange={setMode} />
          </div>
          <DialogDescription>
            {COMPARE_COPY.legend.lead}{' '}
            <span className="rounded-[2px] bg-emerald-500/25 px-0.5 text-foreground">added</span>{' '}
            {COMPARE_COPY.legend.mid}{' '}
            <span className="rounded-[2px] bg-red-500/10 px-0.5 text-red-600 line-through decoration-red-500/70 dark:text-red-400">removed</span>{' '}
            {COMPARE_COPY.legend.tail}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 rounded-md bg-muted">
          <div className="p-4">
            <PromptDiffView base={defaultText} text={text} mode={mode} renderChips={withHelpChips} />
          </div>
        </ScrollArea>
        <div className="flex shrink-0 justify-end">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
