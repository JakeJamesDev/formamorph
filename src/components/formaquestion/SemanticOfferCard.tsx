import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { FLOATING } from './floatingPieces';
import { ModelDownloadBar } from './ModelDownloadBar';
import type { SemanticSearch } from './useSemanticSearch';

/** How the card sits: a floating piece under Minimal and Bubble, a band under the Full window's title bar. */
export type OfferVariant = 'floating' | 'framed';

/**
 * The card at the top of the help window that offers Semantic Search. After Turn On it follows the download,
 * with the progress and Retry the switch in Settings shows, and it goes when the model is ready.
 */
export function SemanticOfferCard({ semantic, variant, className }: { semantic: SemanticSearch; variant: OfferVariant; className?: string }) {
  const { card, progress, error, downloading } = semantic;
  if (card === null) return null;
  return (
    <section
      aria-label="Semantic Search Offer"
      data-fq-offer={card}
      className={cn('flex shrink-0 flex-col gap-2 p-3 text-label', variant === 'floating' ? cn(FLOATING, 'rounded-2xl border bg-popover text-popover-foreground') : 'border-b bg-muted/40', className)}
    >
      {card === 'offer' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Semantic Search</span>
            <Badge variant="secondary">Recommended</Badge>
          </div>
          <Hint>Improves help by finding sections by meaning. Downloads a small model once.</Hint>
          <div className="flex gap-2">
            <Button size="sm" onClick={semantic.turnOn}>Turn On</Button>
            <Button size="sm" variant="ghost" onClick={semantic.noThanks}>No Thanks</Button>
          </div>
        </>
      ) : downloading ? (
        <ModelDownloadBar progress={progress} />
      ) : (
        <>
          <p role="alert" className="text-helper text-destructive">Model download failed: {error}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={semantic.turnOn}>Retry</Button>
            <Button size="sm" variant="ghost" onClick={semantic.dismiss}>Dismiss</Button>
          </div>
        </>
      )}
    </section>
  );
}
