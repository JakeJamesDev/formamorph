import { createContext, memo, useContext, useMemo, useState, type ComponentPropsWithoutRef, type ComponentType, type MouseEvent } from 'react';
import { defaultComponents, type ExtraProps } from 'streamdown';
import { Bug, CircleHelp, ImageOff, Lightbulb, User } from 'lucide-react';
import { LINK_MARK_PROPERTY, MarkdownRenderer, type MarkdownComponents, type RemarkPlugin } from '@/components/game/MarkdownRenderer';
import { UserAvatar } from '@/components/UserAvatar';
import { useUserProfile } from '@/contexts/userProfileStore';
import { API_BASE_URL } from '@/lib/apiBase';
import { KIND_ICONS, KIND_LABELS, kindHasThumbnail, kindOf } from '@/lib/catalogKinds';
import { feedbackListingUrl, feedbackProfileUrl, feedbackThreadChipHref, type FeedbackLinkKind } from '@/lib/feedbackLinks';
import { serverAssetSrc } from '@/lib/serverAssets';
import { statusStyle } from '@/lib/feedbackPresentation';
import { remarkFeedbackLinks } from '@/lib/remarkFeedbackLinks';
import { cn } from '@/lib/utils';
import type { FeedbackLinkTarget, FeedbackType } from '@/types';

/** Where feedback links go on this surface. */
export interface FeedbackLinkPlace {
  /** The boards this surface shows; a thread on any other renders unavailable. */
  boards: readonly FeedbackType[];
  /** The address a thread chip carries, for a new tab or a copied link. None means the thread opens only in place. */
  threadHref: (number: number, type: FeedbackType) => string | undefined;
  /** Opens a thread here. Without it a chip follows its address. */
  openThread?: (number: number) => void;
  /** The address a listing chip carries. */
  listingHref: (listing: { kind: string; id: string }) => string;
  /** Opens a listing here. Without it a chip follows its address. */
  openListing?: (listing: { kind: string; id: string }) => void;
  /** The address a user chip carries, for a new tab or a copied link. A click opens the profile through the surface's profile provider. */
  profileHref: (username: string) => string;
}

export const FeedbackLinkContext = createContext<FeedbackLinkPlace>({
  boards: ['bug', 'suggestion', 'question'],
  threadHref: feedbackThreadChipHref,
  listingHref: feedbackListingUrl,
  profileHref: feedbackProfileUrl,
});

/** What a chip renderer gets: its target, or none when the server sent none for that ref. */
export interface FeedbackChipProps {
  linkRef: string;
  target: FeedbackLinkTarget | undefined;
}

/** The shared frame: one line tall, centered on the text line, a 16px leading slot. */
export const CHIP_CLASS = 'inline-flex h-5 max-w-[min(100%,20rem)] items-center gap-1 rounded-md border bg-muted/40 px-1 align-top text-meta leading-4 no-underline hover:bg-muted';
export const UNAVAILABLE_CHIP_CLASS = 'border-dashed bg-transparent text-muted-foreground hover:bg-transparent';
export const CHIP_SLOT_CLASS = 'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm';

const TYPE_ICONS: Record<FeedbackType, typeof Bug> = { bug: Bug, suggestion: Lightbulb, question: CircleHelp };

/** A plain click opens in place; a modified one is the browser's. */
const opensInPlace = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

function ThreadChip({ linkRef, target }: FeedbackChipProps) {
  const place = useContext(FeedbackLinkContext);

  if (target?.kind !== 'thread' || !target.available || !place.boards.includes(target.type)) {
    return (
      <span className={cn(CHIP_CLASS, UNAVAILABLE_CHIP_CLASS)}>
        <span className={CHIP_SLOT_CLASS}><CircleHelp className="h-3 w-3" /></span>
        {linkRef} · Unavailable thread
      </span>
    );
  }

  const Icon = TYPE_ICONS[target.type];
  const status = statusStyle(target.status);
  const { openThread } = place;
  const href = place.threadHref(target.number, target.type);
  const content = (
    <>
      <span className={CHIP_SLOT_CLASS}><Icon className="h-3 w-3 text-muted-foreground" /></span>
      <span className="shrink-0 whitespace-nowrap font-medium text-primary">{target.number}</span>
      <span className="truncate text-foreground">{target.title}</span>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', status.dot)} role="img" aria-label={status.label} />
    </>
  );

  // No address: a button, so the chip stays focusable and opens only in place.
  if (href === undefined) {
    return <button type="button" className={CHIP_CLASS} onClick={() => openThread?.(target.number)}>{content}</button>;
  }
  return (
    <a
      href={href}
      className={CHIP_CLASS}
      onClick={openThread && ((event) => {
        if (!opensInPlace(event)) return;
        event.preventDefault();
        openThread(target.number);
      })}
    >
      {content}
    </a>
  );
}

function ListingChip({ target }: FeedbackChipProps) {
  const place = useContext(FeedbackLinkContext);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

  if (target?.kind !== 'listing' || !target.available) {
    return (
      <span className={cn(CHIP_CLASS, UNAVAILABLE_CHIP_CLASS)}>
        <span className={CHIP_SLOT_CLASS}><ImageOff className="h-3 w-3" /></span>
        Unavailable listing
      </span>
    );
  }

  const kind = kindOf(target);
  const Icon = KIND_ICONS[kind];
  const src = kindHasThumbnail(kind) ? serverAssetSrc(target.thumbnailUrl, API_BASE_URL) : null;
  const listing = { kind: target.listingKind, id: target.id };
  const href = place.listingHref(listing);
  const { openListing } = place;
  return (
    <a
      href={href}
      // An address on another host leaves this page, so it opens beside it.
      {...(href.startsWith('http') && !openListing ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={CHIP_CLASS}
      onClick={openListing && ((event) => {
        if (!opensInPlace(event)) return;
        event.preventDefault();
        openListing(listing);
      })}
    >
      <span className={CHIP_SLOT_CLASS}>
        {src && src !== brokenSrc
          ? <img src={src} alt="" className="h-4 w-4 rounded-sm object-cover" onError={() => setBrokenSrc(src)} />
          : <Icon className="h-3 w-3 text-muted-foreground" />}
      </span>
      <span className="truncate font-medium text-foreground">{target.title}</span>
      <span className="shrink-0 whitespace-nowrap text-muted-foreground">{KIND_LABELS[kind].one}</span>
    </a>
  );
}

function UserChip({ target }: FeedbackChipProps) {
  const place = useContext(FeedbackLinkContext);
  const { openProfile } = useUserProfile();

  // The typed name is never drawn: a typo and a deleted account look the same.
  if (target?.kind !== 'user' || !target.available) {
    return (
      <span className={cn(CHIP_CLASS, UNAVAILABLE_CHIP_CLASS)}>
        <span className={CHIP_SLOT_CLASS}><User className="h-3 w-3" /></span>
        Unknown user
      </span>
    );
  }

  return (
    <a
      href={place.profileHref(target.username)}
      className={CHIP_CLASS}
      onClick={(event) => {
        if (!opensInPlace(event)) return;
        event.preventDefault();
        openProfile(target.id, target.username);
      }}
    >
      <UserAvatar username={target.username} avatarUrl={target.avatarUrl} className="h-4 w-4 text-[9px]" />
      <span className="truncate font-medium text-foreground">{target.username}</span>
    </a>
  );
}

/** The chip for each link kind. A kind without one renders as the markdown it is. */
const CHIPS: Partial<Record<FeedbackLinkKind, ComponentType<FeedbackChipProps>>> = {
  thread: ThreadChip,
  listing: ListingChip,
  user: UserChip,
};

const LINKS: RemarkPlugin = [remarkFeedbackLinks, { kinds: new Set(Object.keys(CHIPS)) }];

// Streamdown's own anchor, so an ordinary link keeps the leave-site check.
const DefaultAnchor = defaultComponents.a as ComponentType<ComponentPropsWithoutRef<'a'> & ExtraProps>;

/**
 * A feedback body or comment, with each link of a kind in `CHIPS` drawn as a chip from `targets`, the links
 * the server resolved for this reader.
 */
export const FeedbackMarkdown = memo(function FeedbackMarkdown(
  { text, targets }: { text: string; targets?: FeedbackLinkTarget[] },
) {
  const components = useMemo<MarkdownComponents>(() => ({
    a: (props: ComponentPropsWithoutRef<'a'> & ExtraProps) => {
      const mark = String(props.node?.properties?.[LINK_MARK_PROPERTY] ?? '');
      const separator = mark.indexOf(':');
      const kind = mark.slice(0, separator) as FeedbackLinkKind;
      const Chip = separator > 0 ? CHIPS[kind] : undefined;
      if (!Chip) return <DefaultAnchor {...props} />;

      const linkRef = mark.slice(separator + 1);
      return <Chip linkRef={linkRef} target={targets?.find((t) => t.kind === kind && t.ref === linkRef)} />;
    },
  }), [targets]);

  return <MarkdownRenderer text={text} components={components} links={LINKS} />;
});
