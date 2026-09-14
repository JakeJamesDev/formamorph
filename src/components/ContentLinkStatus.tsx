import { Link2 } from 'lucide-react';
import { SplitButton, type SplitButtonAction } from '@/components/ui/split-button';
import { Tip } from '@/components/ui/tooltip';
import { CONTENT_LINK_LABELS, contentLinkState, contentLinkStatusLine } from '@/lib/contentLink';
import type { ContentLink } from '@/types';

/** The marker beside a World Editor row whose copy follows a source. Nothing at all for an independent
 *  copy, so an unlinked world's lists look exactly as they did. Takes no color of its own, so it inverts
 *  with the row the way the folder glyph does. */
export function ContentLinkIcon({ link }: { link?: ContentLink }) {
  const state = contentLinkState(link);
  if (!state) return null;
  const label = CONTENT_LINK_LABELS[state];
  // The span, not the glyph, takes the tooltip's composed ref — a lucide icon is not ref-safe here.
  return (
    <Tip tip={contentLinkStatusLine(link) ?? label} labelsChild={false}>
      <span className="shrink-0" aria-label={label} role="img">
        <Link2 className="h-4 w-4" />
      </span>
    </Tip>
  );
}

/**
 * The selected entity or dictionary's library actions in the editor footer, where its Export button was.
 * An independent copy saves itself to the library, a linked copy opens the item it follows, and Export
 * moves into the menu.
 */
export function SelectedContentActions({ faceLabel, faceTip, menu, onFace, disabled }: {
  /** What the face does, in the caller's words for this kind of content. */
  faceLabel: string;
  /** What the face will do, since "Save to Library" does not say that the copy then follows the item.
   *  Absent draws the button bare, which is what a face whose label already says it all wants. */
  faceTip?: string;
  menu: SplitButtonAction[];
  onFace: () => void;
  disabled?: boolean;
}) {
  const button = (
    <SplitButton
      icon={<Link2 className="h-4 w-4 mr-2 shrink-0" />}
      label={faceLabel}
      menu={menu}
      onClick={onFace}
      disabled={disabled}
      menuLabel="More library actions"
    />
  );
  if (!faceTip) return button;
  // The span, not the pair, takes the tooltip's composed ref.
  return (
    <Tip tip={faceTip} labelsChild={false}>
      <span className="inline-flex">{button}</span>
    </Tip>
  );
}
