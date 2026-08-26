import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { reasoningExpandPref, setReasoningExpandPref } from '@/lib/reasoningCollapsePref';
import { MarkdownRenderer } from './MarkdownRenderer';

/**
 * The collapsible reasoning aside shown above a turn's narration: a reasoning model's (or the inline-thinking
 * directive's) private scratchpad. Expanded while the model is still thinking (`active`) and auto-collapses to
 * its header the moment narration begins — unless the reader has taken manual control. Each turn mounts a
 * fresh instance, so the reader's last manual toggle persists as the seed for future blocks: collapse one and
 * the next turn's thinking stays behind its header until expanded again. The body renders full markdown but
 * de-emphasized (muted, smaller, down-scaled headings) so it stays subordinate to the story.
 */
export function ReasoningBlock({ text, ms, active }: { text: string; ms: number; active: boolean }) {
  const [open, setOpen] = useState(active && reasoningExpandPref());
  const userToggled = useRef(false);
  // Follow `active` (open while thinking → collapse when narration starts) until the reader clicks the
  // header — auto-open only while the standing preference allows it; auto-collapse regardless.
  useEffect(() => {
    if (!userToggled.current) setOpen(active && reasoningExpandPref());
  }, [active]);

  if (!text) return null;
  const seconds = Math.max(1, Math.round(ms / 1000));

  return (
    <Collapsible open={open} onOpenChange={(o) => { userToggled.current = true; setOpen(o); setReasoningExpandPref(o); }} className="mb-2">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-meta text-muted-foreground hover:text-foreground">
        <ChevronRight className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`} />
        {active ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse motion-reduce:animate-none" />
            Thinking…
          </span>
        ) : (
          `Thought for ${seconds}s`
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 border-l-2 border-border pl-3 text-helper leading-snug text-muted-foreground [&_h1]:text-helper [&_h2]:text-helper [&_h3]:text-helper [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
          <MarkdownRenderer text={text} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
