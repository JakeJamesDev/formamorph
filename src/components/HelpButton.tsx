import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownModal } from '@/components/MarkdownModal';
import { HELP_TOPICS, helpWikiUrl } from '@/lib/helpTopics';
import { isHelpSeen, markHelpSeen } from '@/lib/helpSeenStore';
import { cn } from '@/lib/utils';

/**
 * The `?` that opens a topic's explanation. Generic over any surface: pass a `HELP_TOPICS` id and it
 * renders the button, the markdown pop-out, and the "Learn more" link when the topic has a wiki section.
 *
 * Renders nothing for an unknown id, so a surface can ask for help it doesn't have copy for yet without
 * showing a dead button. Until its topic has been opened once the button carries an accent tint — the
 * features here are easy to miss, and a silent `?` is missed by exactly the people who need it.
 */
export function HelpButton({ topicId, className }: { topicId: string; className?: string }) {
  const topic = HELP_TOPICS[topicId];
  const [open, setOpen] = useState(false);
  // Tracked against the topic it was read for: a host that swaps `topicId` on one mounted button (the World
  // Editor does, per tab) would otherwise keep showing the previous topic's seen state. Re-read during
  // render rather than in an effect so the first paint of a new topic is never wrong.
  const [seen, setSeen] = useState(() => ({ id: topicId, value: isHelpSeen(topicId) }));
  if (seen.id !== topicId) setSeen({ id: topicId, value: isHelpSeen(topicId) });

  if (!topic) return null;
  const wikiUrl = helpWikiUrl(topic);

  const openHelp = () => {
    setOpen(true);
    markHelpSeen(topicId);
    setSeen({ id: topicId, value: true });
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={openHelp}
        aria-label={`About ${topic.title}`}
        className={cn('flex-shrink-0', !seen.value && 'border-primary text-primary', className)}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
      <MarkdownModal
        open={open}
        onOpenChange={setOpen}
        title={topic.title}
        text={topic.body}
        footer={wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Learn more →
          </a>
        )}
      />
    </>
  );
}
