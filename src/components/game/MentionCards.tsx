// Mention hover cards: a resolved mention or a quote's speaker opens a card for that entity, from the Player View.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ComponentPropsWithoutRef, type ComponentType, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode,
} from 'react';
import { defaultComponents, type ExtraProps } from 'streamdown';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import type { PlayerView, PlayerViewEntity } from '@/lib/formaquestion/playerView';
import type { QuoteSpeakerSource, SpeakerColors } from '@/lib/quoteSegments';
import { MENTION_MARK, turnMentionLinks } from '@/lib/coref/mentionLinks';
import type { MentionReadingMap } from '@/lib/coref/mentionReadings';
import { turnQuoteSpeakers } from '@/lib/coref/quoteSpeakers';
import { cn } from '@/lib/utils';
import { thumbFit } from '@/lib/thumbAspect';
import { LINK_MARK_PROPERTY, type MarkdownComponents, type RemarkPlugin } from './MarkdownRenderer';

/** A card opens for a mention in the prose or for a quote's speaker. */
export type MentionCardRole = 'mention' | 'speaker';

/** Hover delays on a mouse, in ms: before the card opens, and before it closes once the pointer leaves. */
const HOVER_OPEN_MS = 300;
const HOVER_CLOSE_MS = 200;

/** The card's initial: the name's first letter, past a leading article. */
const initialOf = (name: string): string => name.replace(/^(?:the|a|an)\s+/i, '').charAt(0).toUpperCase() || '?';

/** The card's picture: the Player View image as a top-anchored portrait crop, else the colored initial. */
function MentionBadge({ row, color }: { row: PlayerViewEntity; color?: string }) {
  if (row.image) {
    return <img src={row.image} alt="" data-testid="mention-card-portrait" className={cn('h-14 w-12 shrink-0 rounded-md', thumbFit('portrait'))} />;
  }
  return (
    <span
      aria-hidden
      style={color ? { backgroundColor: color } : undefined}
      className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label font-semibold text-background', !color && 'bg-muted-foreground')}
    >
      {initialOf(row.name)}
    </span>
  );
}

/** The card body: the entity's portrait or initial, its Player View name and description, and the correction
 *  action when one is wired. */
export function MentionCard({ row, color, onWrong }: { row: PlayerViewEntity; color?: string; onWrong?: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <MentionBadge row={row} color={color} />
        <div className="min-w-0">
          <div className="text-label font-semibold">{row.name}</div>
          {row.description && <div className="line-clamp-2 text-helper text-muted-foreground">{row.description}</div>}
        </div>
      </div>
      {onWrong && (
        <button type="button" onClick={onWrong} className="self-start text-helper text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Wrong character?
        </button>
      )}
    </div>
  );
}

/** The card rows of a Player View: every entity but the player's own, by id. */
export const mentionCardRows = (view: Pick<PlayerView, 'entities'>): ReadonlyMap<string, PlayerViewEntity> =>
  new Map(view.entities.filter((row) => !row.player).map((row) => [row.id, row]));

/** How the open card was opened: a hover closes when the pointer leaves, a focus on blur, a click stays. */
type OpenedBy = 'hover' | 'focus' | 'click';

interface OpenCard {
  anchor: HTMLElement;
  entityId: string;
  role: MentionCardRole;
  by: OpenedBy;
}

interface MentionCardsValue {
  colors: SpeakerColors;
  rows: ReadonlyMap<string, PlayerViewEntity>;
  open: (anchor: HTMLElement, entityId: string, role: MentionCardRole, by: OpenedBy) => void;
  hoverOut: () => void;
  blur: (anchor: HTMLElement) => void;
}

const MentionCardsContext = createContext<MentionCardsValue | null>(null);

/** True inside a mention trigger, so a quote span nested in it is no second trigger. */
const InMentionContext = createContext(false);

/**
 * The one card of a narration surface, and what its triggers read. `rows` is the Player View's entities: a
 * mention or speaker without a row stays plain text (Q46). `onWrong` corrects the opened mention or quote; the
 * card shows "Wrong character?" only with it.
 */
export function MentionCardsProvider({ colors, rows, onWrong, children }: {
  colors: SpeakerColors;
  rows: ReadonlyMap<string, PlayerViewEntity>;
  onWrong?: (card: { anchor: HTMLElement; entityId: string; role: MentionCardRole }) => void;
  children: ReactNode;
}) {
  const [card, setCard] = useState<OpenCard | null>(null);
  const cardRef = useRef(card);
  cardRef.current = card;
  const timer = useRef<number | undefined>(undefined);
  const clearTimer = () => { window.clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => clearTimer, []);

  const open = useCallback((anchor: HTMLElement, entityId: string, role: MentionCardRole, by: OpenedBy) => {
    clearTimer();
    const current = cardRef.current;
    if (by === 'hover') {
      if (current?.anchor === anchor) return;
      timer.current = window.setTimeout(() => setCard({ anchor, entityId, role, by }), HOVER_OPEN_MS);
      return;
    }
    // A second click on the anchor it pinned closes the card; a click on a hovered or focused card pins it.
    if (by === 'click' && current?.anchor === anchor && current.by === 'click') { setCard(null); return; }
    setCard({ anchor, entityId, role, by });
  }, []);
  const hoverOut = useCallback(() => {
    clearTimer();
    if (cardRef.current?.by !== 'hover') return;
    timer.current = window.setTimeout(() => setCard(null), HOVER_CLOSE_MS);
  }, []);
  const blur = useCallback((anchor: HTMLElement) => {
    const current = cardRef.current;
    if (current?.anchor === anchor && current.by === 'focus') setCard(null);
  }, []);

  // The open trigger keeps its underline while the card shows.
  useEffect(() => {
    if (!card) return;
    card.anchor.setAttribute('data-card-open', '');
    return () => card.anchor.removeAttribute('data-card-open');
  }, [card]);

  const value = useMemo(() => ({ colors, rows, open, hoverOut, blur }), [colors, rows, open, hoverOut, blur]);
  const row = card ? rows.get(card.entityId) : undefined;
  const anchorRef = useMemo(() => ({ current: card?.anchor ?? null }), [card]);
  return (
    <MentionCardsContext.Provider value={value}>
      {children}
      <Popover open={!!card && !!row} onOpenChange={(next) => { if (!next) setCard(null); }}>
        <PopoverAnchor virtualRef={anchorRef} />
        {card && row && (
          <PopoverContent
            className="w-64 p-3"
            data-testid="mention-card"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onPointerEnter={(event) => { if (event.pointerType === 'mouse') clearTimer(); }}
            onPointerLeave={(event) => { if (event.pointerType === 'mouse') hoverOut(); }}
            // A press on the open trigger is its own toggle, not a press outside.
            onInteractOutside={(event) => { if (event.target instanceof Node && card.anchor.contains(event.target)) event.preventDefault(); }}
          >
            <MentionCard
              row={row}
              color={colors.get(card.entityId)}
              onWrong={onWrong && (() => { onWrong(card); setCard(null); })}
            />
          </PopoverContent>
        )}
      </Popover>
    </MentionCardsContext.Provider>
  );
}

/** The handlers that open a card from `entityId`'s trigger: hover on a mouse, click or tap, keyboard focus. */
function useCardTrigger(entityId: string, role: MentionCardRole, hover: boolean) {
  const cards = useContext(MentionCardsContext);
  if (!cards?.rows.has(entityId)) return null;
  const { open, hoverOut, blur } = cards;
  return {
    color: cards.colors.get(entityId),
    handlers: {
      onClick: (event: { currentTarget: HTMLElement; stopPropagation: () => void }) => {
        event.stopPropagation();
        // The click that ends a text selection keeps the selection, not a card.
        if (window.getSelection()?.isCollapsed === false) return;
        open(event.currentTarget, entityId, role, 'click');
      },
      onFocus: (event: { currentTarget: HTMLElement }) => {
        if (event.currentTarget.matches(':focus-visible')) open(event.currentTarget, entityId, role, 'focus');
      },
      onBlur: (event: { currentTarget: HTMLElement }) => blur(event.currentTarget),
      ...(hover && {
        onPointerEnter: (event: PointerEvent<HTMLElement>) => { if (event.pointerType === 'mouse') open(event.currentTarget, entityId, role, 'hover'); },
        onPointerLeave: (event: PointerEvent<HTMLElement>) => { if (event.pointerType === 'mouse') hoverOut(); },
      }),
    },
  };
}

const TRIGGER = 'cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Enter and Space press a span trigger, as they press a button. */
const pressKeys = (press: (event: KeyboardEvent<HTMLSpanElement>) => void) => (event: KeyboardEvent<HTMLSpanElement>) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  press(event);
};

/** A resolved mention: plain text that shows a dotted underline in its entity's color on hover, focus, or while
 *  its card is open. A span, not a button, so a multi-word mention wraps like the prose around it. */
function MentionTrigger({ entityId, children }: { entityId: string; children: ReactNode }) {
  const trigger = useCardTrigger(entityId, 'mention', true);
  if (!trigger) return <>{children}</>;
  return (
    <InMentionContext.Provider value>
      <span
        role="button"
        tabIndex={0}
        data-mention={entityId}
        style={{ '--mention-color': trigger.color ?? 'hsl(var(--muted-foreground))' } as CSSProperties}
        className={cn(
          TRIGGER,
          'underline decoration-transparent decoration-dotted decoration-[1.5px] underline-offset-4',
          'hover:[text-decoration-color:var(--mention-color)] focus-visible:[text-decoration-color:var(--mention-color)] data-[card-open]:[text-decoration-color:var(--mention-color)]',
        )}
        onKeyDown={pressKeys(trigger.handlers.onClick)}
        {...trigger.handlers}
      >
        {children}
      </span>
    </InMentionContext.Provider>
  );
}

/** A quote with a resolved speaker opens its speaker's card on click, tap, or keyboard focus. */
function SpeakerQuoteTrigger({ speaker, props }: { speaker: string; props: ComponentPropsWithoutRef<'span'> }) {
  const trigger = useCardTrigger(speaker, 'speaker', false);
  const inMention = useContext(InMentionContext);
  if (!trigger || inMention) return <span {...props} />;
  return <span {...props} role="button" tabIndex={0} className={cn(props.className, TRIGGER)} onKeyDown={pressKeys(trigger.handlers.onClick)} {...trigger.handlers} />;
}

// Streamdown's own anchor, so an ordinary link keeps the leave-site check.
const DefaultAnchor = defaultComponents.a as ComponentType<ComponentPropsWithoutRef<'a'> & ExtraProps>;

function MentionAnchor(props: ComponentPropsWithoutRef<'a'> & ExtraProps) {
  const mark = String(props.node?.properties?.[LINK_MARK_PROPERTY] ?? '');
  if (!mark.startsWith(MENTION_MARK)) return <DefaultAnchor {...props} />;
  return <MentionTrigger entityId={mark.slice(MENTION_MARK.length)}>{props.children}</MentionTrigger>;
}

function QuoteSpan({ node: _node, ...props }: ComponentPropsWithoutRef<'span'> & ExtraProps) {
  const speaker = (props as Record<string, unknown>)['data-speaker'];
  return typeof speaker === 'string' ? <SpeakerQuoteTrigger speaker={speaker} props={props} /> : <span {...props} />;
}

/** The renderer components that draw mention links and speaker quotes as card triggers, inside a
 *  {@link MentionCardsProvider}. */
const MENTION_COMPONENTS: MarkdownComponents = { a: MentionAnchor, span: QuoteSpan };

/** The renderer props of a turn's speakers and mention links, with the trigger components when either exists. */
export const cardTriggers = (speakers: QuoteSpeakerSource | undefined, links: RemarkPlugin | undefined) =>
  speakers || links ? { speakers, links, components: MENTION_COMPONENTS } : {};

/** {@link cardTriggers} for a committed turn from its reading; none while the turn still streams. */
export const turnCardTriggers = (
  live: boolean, enabled: boolean, readings: MentionReadingMap, colors: SpeakerColors, turnId: string | undefined, narration: string,
) => (live ? {} : cardTriggers(
  turnQuoteSpeakers(enabled, readings, colors, turnId, narration),
  turnMentionLinks(enabled, readings, turnId, narration),
));
