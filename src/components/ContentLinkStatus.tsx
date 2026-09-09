import { Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Meta } from '@/components/ui/typography';
import { Tip } from '@/components/ui/tooltip';
import { CONTENT_LINK_LABELS, contentLinkSourceName, contentLinkState } from '@/lib/contentLink';
import type { ContentLink } from '@/types';

/** The marker beside a World Editor row whose copy follows a source. Nothing at all for an independent
 *  copy, so an unlinked world's lists look exactly as they did. Takes no color of its own, so it inverts
 *  with the row the way the folder glyph does. */
export function ContentLinkIcon({ link }: { link?: ContentLink }) {
  const state = contentLinkState(link);
  if (!state) return null;
  const label = CONTENT_LINK_LABELS[state];
  const source = contentLinkSourceName(link);
  // The span, not the glyph, takes the tooltip's composed ref — a lucide icon is not ref-safe here.
  return (
    <Tip tip={source ? `${label} — ${source}` : label} labelsChild={false}>
      <span className="shrink-0" aria-label={label} role="img">
        <Link2 className="h-4 w-4" />
      </span>
    </Tip>
  );
}

/** The selected entity or dictionary's link state and what it follows, above its fields. Renders nothing
 *  for an independent copy. The source name is the one carried on the record: a library item can be
 *  renamed or gone, and an imported world never had it. */
export function ContentLinkHeader({ link }: { link?: ContentLink }) {
  const state = contentLinkState(link);
  if (!state) return null;
  const source = contentLinkSourceName(link);
  return (
    <div className="space-y-1">
      <Badge variant="secondary">{CONTENT_LINK_LABELS[state]}</Badge>
      {source && <Meta as="p">Source: {source}</Meta>}
    </div>
  );
}
