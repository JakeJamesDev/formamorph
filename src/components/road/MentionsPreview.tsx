// The Character Mentions offer's picture: a passage written for it, with a fixed reading, through the real
// narration renderer. It never runs the model (Q65).
import { useState } from 'react';
import { MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MarkdownRenderer, type RemarkPlugin } from '@/components/game/MarkdownRenderer';
import { MentionCardsProvider, cardTriggers } from '@/components/game/MentionCards';
import { remarkMentionLinks } from '@/lib/coref/mentionLinks';
import type { MentionLink } from '@/lib/coref/mentionReading';
import { speakerColors } from '@/lib/coref/speakerPalette';
import type { PlayerViewEntity } from '@/lib/formaquestion/playerView';
import { spokenQuotes, type QuoteSpeakerSource } from '@/lib/quoteSegments';
import { cn } from '@/lib/utils';

export const PREVIEW_PASSAGE = `Brann sets three cups on the bar. "First round's free," he says.

Ilse leans in beside you. "Since when does Brann give anything away?"

"Since the storm took his roof," old Pell calls from the hearth.

"Then pour mine," you say.`;

const PREVIEW_PLAYER = 'preview-player';

const entity = (id: string, name: string, description: string, player?: true): PlayerViewEntity =>
  ({ kind: 'entity', id, name, description, ...(player && { player }) });

const ROWS = new Map([
  entity('preview-brann', 'Brann', 'Runs the inn and pours the drinks.'),
  entity('preview-ilse', 'Ilse', 'A courier who stops here between runs.'),
  entity('preview-pell', 'Pell', 'A regular who keeps the seat by the fire.'),
  entity(PREVIEW_PLAYER, 'You', 'Your persona.', true),
].map((row) => [row.id, row]));

const COLORS = speakerColors(
  [{ id: 'preview-brann' }, { id: 'preview-ilse' }, { id: 'preview-pell' }],
  { id: PREVIEW_PLAYER },
);

/** The first whole-word span of each `[text, entity]` in order. */
function links(hits: readonly (readonly [string, string])[]): MentionLink[] {
  let from = 0;
  return hits.map(([text, entityId]) => {
    const found = new RegExp(`\\b${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    found.lastIndex = from;
    const start = found.exec(PREVIEW_PASSAGE)?.index;
    if (start === undefined) throw new Error(`No ${text} after offset ${from}`);
    from = start + text.length;
    return { start, end: from, entityId };
  });
}

export const PREVIEW_SPEAKERS: QuoteSpeakerSource = {
  text: PREVIEW_PASSAGE,
  colors: COLORS,
  quotes: spokenQuotes(PREVIEW_PASSAGE, [
    ['"First round\'s free,"', 'preview-brann'],
    ['"Since when does Brann give anything away?"', 'preview-ilse'],
    ['"Since the storm took his roof,"', 'preview-pell'],
    ['"Then pour mine,"', PREVIEW_PLAYER],
  ]),
};

const LINKS: RemarkPlugin = [remarkMentionLinks, {
  source: {
    text: PREVIEW_PASSAGE,
    mentions: links([
      ['Brann', 'preview-brann'], ['he', 'preview-brann'], ['Ilse', 'preview-ilse'], ['you', PREVIEW_PLAYER],
      ['Brann', 'preview-brann'], ['his', 'preview-brann'], ['old Pell', 'preview-pell'], ['you', PREVIEW_PLAYER],
    ]),
  },
}];

const TRIGGERS = cardTriggers(PREVIEW_SPEAKERS, LINKS);

/** The preview passage, with its own cards. */
export function MentionsPreview({ className }: { className?: string }) {
  return (
    <MentionCardsProvider colors={COLORS} rows={ROWS}>
      <div data-testid="mentions-preview" className={cn('narration-text rounded-md border border-border bg-muted/80 p-3', className)}>
        <MarkdownRenderer text={PREVIEW_PASSAGE} dialogue {...TRIGGERS} />
      </div>
    </MentionCardsProvider>
  );
}

/** "Show Me": a small tile that opens the preview in a dialog. */
export function MentionsPreviewButton({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <Button
        variant="outline"
        className="h-[72px] w-[72px] flex-col gap-1 whitespace-normal px-1 text-meta leading-tight"
        onClick={() => setOpen(true)}
      >
        <MessageSquareQuote aria-hidden className="size-5" />
        Show Me
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Character Mentions</DialogTitle>
            <DialogDescription>
              Each quote takes its speaker’s color, and your own lines take your Quote Color. Hover or tap a name to see who it is.
            </DialogDescription>
          </DialogHeader>
          <div className="text-body">
            <MentionsPreview className="p-4" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
