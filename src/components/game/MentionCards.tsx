// Mention hover cards: a resolved mention or a quote's speaker opens a card for that entity, from the Player View.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ComponentPropsWithoutRef, type ComponentType, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode,
} from 'react';
import { Check, ChevronLeft } from 'lucide-react';
import { defaultComponents, type ExtraProps } from 'streamdown';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import type { Base64Data, Entity } from '@/types';
import type { PlayerView, PlayerViewEntity } from '@/lib/formaquestion/playerView';
import { hasStrangerFace, type EntityPresence } from '@/lib/presence';
import { parseSpanKey, spanKey, type QuoteSpeakerSource, type SpeakerColors, type TextSpan } from '@/lib/quoteSegments';
import { MENU_ROW } from '@/components/menuRow';
import { ContributeQuestion } from './ContributeQuestion';
import { parseMentionMark, turnMentionLinks } from '@/lib/coref/mentionLinks';
import type { MentionCorrection } from '@/lib/coref/mentionCorrections';
import type { MentionLink, QuoteSpeaker } from '@/lib/coref/mentionReading';
import type { MentionReadingMap } from '@/lib/coref/mentionReadings';
import { turnQuoteSpeakers } from '@/lib/coref/quoteSpeakers';
import { cn } from '@/lib/utils';
import { thumbFit } from '@/lib/thumbAspect';
import { LINK_MARK_PROPERTY, type MarkdownComponents, type RemarkPlugin } from './MarkdownRenderer';

/** A card opens for a mention in the prose or for a quote's speaker. */
export type MentionCardRole = 'mention' | 'speaker';

/** A correction the player made on a card, with the turn it belongs to. */
export type CardCorrection = MentionCorrection & { turnId: string };

/** Hover delays on a mouse, in ms: before the card opens, and before it closes once the pointer leaves. */
const HOVER_OPEN_MS = 300;
const HOVER_CLOSE_MS = 200;

/** The card's initial: the name's first letter, past a leading article. */
const initialOf = (name: string): string => name.replace(/^(?:the|a|an)\s+/i, '').charAt(0).toUpperCase() || '?';

function Initial({ name, color, className }: { name: string | null; color?: string; className: string }) {
  return (
    <span
      aria-hidden
      style={color ? { backgroundColor: color } : undefined}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-background', !color && 'bg-muted-foreground', className)}
    >
      {name === null ? '–' : initialOf(name)}
    </span>
  );
}

/** The card's picture: the Player View image as a top-anchored portrait crop, else the colored initial. */
function MentionBadge({ row, color }: { row: PlayerViewEntity; color?: string }) {
  if (row.image) {
    return <img src={row.image} alt="" data-testid="mention-card-portrait" className={cn('h-14 w-12 shrink-0 rounded-md', thumbFit('portrait'))} />;
  }
  return <Initial name={row.name} color={color} className="h-8 w-8 text-label" />;
}

/** The card body: the entity's portrait or initial, its Player View name and description, and the correction
 *  action when one is wired. */
export function MentionCard({ row, color, onWrong, focusWrong = false }: {
  row: PlayerViewEntity; color?: string; onWrong?: () => void; focusWrong?: boolean;
}) {
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
        <button
          type="button"
          autoFocus={focusWrong}
          onClick={onWrong}
          className="self-start rounded-sm text-helper text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Wrong character?
        </button>
      )}
    </div>
  );
}

/** The pick list "Wrong character?" swaps the card for: the cast by Player View name, then "Someone Else". */
export function MentionPickList({ role, rows, colors, current, focusFirst = false, onPick, onBack }: {
  role: MentionCardRole;
  rows: ReadonlyMap<string, PlayerViewEntity>;
  colors: SpeakerColors;
  current: string;
  focusFirst?: boolean;
  onPick: (entityId: string | null) => void;
  onBack: () => void;
}) {
  const title = role === 'speaker' ? 'Who said this?' : 'Who is this?';
  return (
    <div className="flex flex-col gap-1" role="group" aria-label={title}>
      <div className="mb-1 flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Back" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-label font-medium">{title}</span>
      </div>
      {[...rows.values()].map((row, i) => (
        <button key={row.id} type="button" autoFocus={focusFirst && i === 0} onClick={() => onPick(row.id)} className={MENU_ROW}>
          {row.image
            ? <img src={row.image} alt="" className={cn('h-6 w-6 shrink-0 rounded-md', thumbFit('portrait'))} />
            : <Initial name={row.name} color={colors.get(row.id)} className="h-6 w-6 text-meta" />}
          <span className="flex-1">{row.name}</span>
          {row.id === current && <Check aria-label="Current" className="h-4 w-4 text-muted-foreground" />}
        </button>
      ))}
      <button type="button" autoFocus={focusFirst && rows.size === 0} onClick={() => onPick(null)} className={cn(MENU_ROW, 'text-muted-foreground')}>
        <Initial name={null} className="h-6 w-6 text-meta" />
        <span className="flex-1">Someone Else</span>
      </button>
    </div>
  );
}

/** Scene Presence as the cards read it: each cast member's label, by id, in cast order. */
export type CardPresence = ReadonlyMap<string, Pick<EntityPresence, 'entity' | 'known' | 'label'>>;

/** What a stranger's card row reads beyond its label: its visible image and its resolved Stranger Description. */
export interface StrangerReads {
  imageOf?: (entity: Entity) => Base64Data | undefined;
  describe?: (entity: Entity) => string;
}

/**
 * The card rows, by id: the played persona first (Q61), then everyone Scene Presence labels (Q63). A name the
 * player knows keeps its Player View row; an unmet stranger shows its label and Stranger Description (Q67), with
 * its Player View image, else `imageOf`'s. An entity with no label has no row.
 */
export function mentionCardRows(
  view: Pick<PlayerView, 'entities'>, presence: CardPresence, { imageOf, describe }: StrangerReads = {},
): ReadonlyMap<string, PlayerViewEntity> {
  const viewRows = new Map(view.entities.map((row) => [row.id, row]));
  const rows = new Map<string, PlayerViewEntity>();
  const persona = view.entities.find((row) => row.player);
  if (persona) rows.set(persona.id, persona);
  for (const [id, { entity, known, label }] of presence) {
    const row = viewRows.get(id);
    if (label === null || rows.has(id)) continue;
    if (known) {
      if (row) rows.set(id, row);
      continue;
    }
    const image = row?.image ?? imageOf?.(entity);
    rows.set(id, {
      kind: 'entity', id, name: label, description: (describe ?? strangerText)(entity).trim(), alias: true, ...(image && { image }),
    });
  }
  return rows;
}

const strangerText = (entity: Entity) => entity.strangerDescription ?? '';

/** Who the pick list offers in every turn (Q68): the persona, every scene-alias row, everyone on the met-in-play
 *  list, and a stranger the start rule meets. The start rule's meeting of a name it never hid is not seeing it. */
export function pickListBase(
  view: Pick<PlayerView, 'entities'>, presence: ReadonlyMap<string, Pick<EntityPresence, 'entity' | 'met'>>, metInPlay: readonly string[],
): ReadonlySet<string> {
  const ids = new Set([...view.entities.filter((row) => row.player || row.alias).map((row) => row.id), ...metInPlay]);
  for (const [id, { entity, met }] of presence) if (met && hasStrangerFace(entity)) ids.add(id);
  return ids;
}

/** A turn's pick list ids: {@link pickListBase} and every entity the turn's reading links or names as a speaker. */
export function turnPickList(
  base: ReadonlySet<string>,
  reading: { mentions: readonly Pick<MentionLink, 'entityId'>[]; quotes: readonly Pick<QuoteSpeaker, 'speaker'>[] } | null | undefined,
): ReadonlySet<string> {
  if (!reading) return base;
  const ids = new Set(base);
  for (const m of reading.mentions) if (m.entityId) ids.add(m.entityId);
  for (const q of reading.quotes) if (q.speaker) ids.add(q.speaker);
  return ids;
}

/** The colors of the speakers that have a card row: a speaker the player cannot name gets none (Q48, Q63). */
export const cardColors = (colors: SpeakerColors, rows: ReadonlyMap<string, unknown>): SpeakerColors =>
  new Map([...colors].filter(([id]) => rows.has(id)));

const pickRows = (rows: ReadonlyMap<string, PlayerViewEntity>, ids: ReadonlySet<string>): ReadonlyMap<string, PlayerViewEntity> =>
  new Map([...rows].filter(([id]) => ids.has(id)));

/** How the open card was opened: a hover closes when the pointer leaves, a focus on blur, a click stays. A key
 *  press stays too and moves focus into the card. */
type OpenedBy = 'hover' | 'focus' | 'click' | 'key';

/** Where a trigger sits in the narration: its turn and span. */
interface CardTarget extends TextSpan { turnId: string }

/** The attribute a trigger carries its target in, so focus can find a trigger a correction remounted. */
const TARGET_ATTRIBUTE = 'data-card-target';
const targetKey = (target: CardTarget) => `${spanKey(target)}:${target.turnId}`;

interface OpenCard {
  anchor: HTMLElement;
  entityId: string;
  role: MentionCardRole;
  by: OpenedBy;
  target: CardTarget | null;
}

interface MentionCardsValue {
  colors: SpeakerColors;
  rows: ReadonlyMap<string, PlayerViewEntity>;
  open: (card: OpenCard) => void;
  hoverOut: () => void;
  blur: (anchor: HTMLElement) => void;
}

const MentionCardsContext = createContext<MentionCardsValue | null>(null);

/** True inside a mention trigger, so a quote span nested in it is no second trigger. */
const InMentionContext = createContext(false);

/** The turn whose narration the triggers inside it belong to. */
const MentionTurnContext = createContext<string | undefined>(undefined);

/** Names the turn of the narration inside it, so its cards can correct that turn. */
export function MentionTurn({ turnId, children }: { turnId: string | undefined; children: ReactNode }) {
  return <MentionTurnContext.Provider value={turnId}>{children}</MentionTurnContext.Provider>;
}

/**
 * The one card of a narration surface, and what its triggers read. `rows` is the Player View's entities: a
 * mention or speaker without a row stays plain text (Q46). `onCorrect` corrects the opened mention or quote; the
 * card shows "Wrong character?" only with it, and only for a trigger inside a {@link MentionTurn}. When
 * `askContribute` says so after a correction, the card asks the Contribute Corrections question; closing it unanswered
 * answers no (Q69).
 */
export function MentionCardsProvider({ colors, rows, onCorrect, pickable, askContribute, onContributeAnswer, children }: {
  colors: SpeakerColors;
  rows: ReadonlyMap<string, PlayerViewEntity>;
  onCorrect?: (correction: CardCorrection) => void;
  /** The ids a turn's pick list offers (Q68); every row without it. */
  pickable?: (turnId: string) => ReadonlySet<string>;
  /** Whether a correction asks the Contribute Corrections question. */
  askContribute?: boolean;
  onContributeAnswer?: (yes: boolean, turnId: string) => void;
  children: ReactNode;
}) {
  const [card, setCard] = useState<OpenCard | null>(null);
  const [picking, setPicking] = useState(false);
  // The turn whose correction the open question is about.
  const [asking, setAsking] = useState<string | null>(null);
  const askingRef = useRef(asking);
  askingRef.current = asking;
  const answerRef = useRef(onContributeAnswer);
  answerRef.current = onContributeAnswer;
  const cardRef = useRef(card);
  cardRef.current = card;
  const timer = useRef<number | undefined>(undefined);
  // The trigger a key-opened card hands focus back to when it closes, and the focus that must not reopen it.
  const returnTo = useRef<{ anchor: HTMLElement; target: CardTarget | null } | null>(null);
  const refocusing = useRef(false);
  const clearTimer = () => { window.clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => clearTimer, []);

  // Ends the open question with `yes`; a card closed or replaced unanswered ends it with no.
  const endQuestion = useCallback((yes: boolean) => {
    const turnId = askingRef.current;
    if (turnId === null) return;
    askingRef.current = null;
    setAsking(null);
    answerRef.current?.(yes, turnId);
  }, []);
  const show = useCallback((next: OpenCard | null) => {
    endQuestion(false);
    setPicking(false);
    setCard(next);
  }, [endQuestion]);

  const open = useCallback((next: OpenCard) => {
    clearTimer();
    const current = cardRef.current;
    if (next.by === 'focus' && refocusing.current) return;
    if (next.by === 'hover') {
      if (current?.anchor === next.anchor) return;
      timer.current = window.setTimeout(() => show(next), HOVER_OPEN_MS);
      return;
    }
    // A second click or press on the anchor it pinned closes the card; a click on a hovered or focused card pins it.
    const pinned = current?.anchor === next.anchor && (current.by === 'click' || current.by === 'key');
    if ((next.by === 'click' || next.by === 'key') && pinned) { show(null); return; }
    returnTo.current = next.by === 'key' ? { anchor: next.anchor, target: next.target } : null;
    show(next);
  }, [show]);
  const hoverOut = useCallback(() => {
    clearTimer();
    if (cardRef.current?.by !== 'hover') return;
    timer.current = window.setTimeout(() => show(null), HOVER_CLOSE_MS);
  }, [show]);
  const blur = useCallback((anchor: HTMLElement) => {
    const current = cardRef.current;
    if (current?.anchor === anchor && current.by === 'focus') show(null);
  }, [show]);

  // The open trigger keeps its underline while the card shows.
  useEffect(() => {
    if (!card) return;
    card.anchor.setAttribute('data-card-open', '');
    return () => card.anchor.removeAttribute('data-card-open');
  }, [card]);

  const value = useMemo(() => ({ colors, rows, open, hoverOut, blur }), [colors, rows, open, hoverOut, blur]);
  const row = card ? rows.get(card.entityId) : undefined;
  // A correction remounts the narration, so the card follows its target's new element.
  const anchorRef = useMemo(() => ({
    current: card && {
      getBoundingClientRect: () => (card.anchor.isConnected || !card.target ? card.anchor
        : document.querySelector<HTMLElement>(`[${TARGET_ATTRIBUTE}="${CSS.escape(targetKey(card.target))}"]`) ?? card.anchor
      ).getBoundingClientRect(),
    },
  }), [card]);
  const byKey = card?.by === 'key';
  const target = card?.target;
  const correct = onCorrect && target && card
    ? (entityId: string | null) => {
      onCorrect({ turnId: target.turnId, kind: card.role === 'speaker' ? 'quote' : 'mention', start: target.start, end: target.end, entityId });
      if (!askContribute) { show(null); return; }
      setPicking(false);
      askingRef.current = target.turnId;
      setAsking(target.turnId);
    }
    : undefined;
  return (
    <MentionCardsContext.Provider value={value}>
      {children}
      <Popover open={!!card && !!row} onOpenChange={(next) => { if (!next) show(null); }}>
        <PopoverAnchor virtualRef={anchorRef} />
        {card && row && (
          <PopoverContent
            // A key press on a focus-opened card remounts it, so focus moves in.
            key={byKey ? 'key' : 'pointer'}
            className="w-64 p-3"
            data-testid="mention-card"
            onOpenAutoFocus={(event) => { if (!byKey) event.preventDefault(); }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const back = returnTo.current;
              returnTo.current = null;
              // A correction remounts the narration, so the trigger may be a new element at the same target.
              const anchor = back?.anchor.isConnected || !back?.target ? back?.anchor
                : document.querySelector<HTMLElement>(`[${TARGET_ATTRIBUTE}="${CSS.escape(targetKey(back.target))}"]`);
              // A press elsewhere keeps the focus it gave; only focus the card dropped goes back to the anchor.
              const active = document.activeElement;
              const dropped = !active || active === document.body || !!active.closest('[data-testid="mention-card"]');
              if (!anchor?.isConnected || !dropped) return;
              refocusing.current = true;
              anchor.focus();
              refocusing.current = false;
            }}
            onPointerEnter={(event) => { if (event.pointerType === 'mouse') clearTimer(); }}
            onPointerLeave={(event) => { if (event.pointerType === 'mouse') hoverOut(); }}
            // A press on the open trigger is its own toggle, not a press outside.
            onInteractOutside={(event) => { if (event.target instanceof Node && card.anchor.contains(event.target)) event.preventDefault(); }}
          >
            {asking !== null ? (
              <ContributeQuestion
                focusFirst={byKey}
                onAnswer={(yes) => {
                  endQuestion(yes);
                  show(null);
                }}
              />
            ) : picking && correct ? (
              <MentionPickList
                role={card.role}
                rows={pickable && target ? pickRows(rows, pickable(target.turnId)) : rows}
                colors={colors}
                current={card.entityId}
                focusFirst={byKey}
                onPick={correct}
                onBack={() => setPicking(false)}
              />
            ) : (
              <MentionCard
                row={row}
                color={colors.get(card.entityId)}
                focusWrong={byKey}
                onWrong={correct && (() => {
                  // A hover-opened card stays while the player picks.
                  if (card.by === 'hover' || card.by === 'focus') setCard({ ...card, by: 'click' });
                  setPicking(true);
                })}
              />
            )}
          </PopoverContent>
        )}
      </Popover>
    </MentionCardsContext.Provider>
  );
}

/** The handlers that open a card from `entityId`'s trigger: hover on a mouse, click or tap, keyboard focus, and
 *  Enter or Space, which also moves focus into the card. */
function useCardTrigger(entityId: string, role: MentionCardRole, span: TextSpan | null, hover: boolean) {
  const cards = useContext(MentionCardsContext);
  const turnId = useContext(MentionTurnContext);
  if (!cards?.rows.has(entityId)) return null;
  const { open, hoverOut, blur } = cards;
  const target = turnId && span ? { turnId, ...span } : null;
  const at = (anchor: HTMLElement, by: OpenedBy) => open({ anchor, entityId, role, by, target });
  return {
    color: cards.colors.get(entityId),
    handlers: {
      ...(target && { [TARGET_ATTRIBUTE]: targetKey(target) }),
      onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        at(event.currentTarget, 'key');
      },
      onClick: (event: { currentTarget: HTMLElement; stopPropagation: () => void }) => {
        event.stopPropagation();
        // The click that ends a text selection keeps the selection, not a card.
        if (window.getSelection()?.isCollapsed === false) return;
        at(event.currentTarget, 'click');
      },
      onFocus: (event: { currentTarget: HTMLElement }) => {
        if (event.currentTarget.matches(':focus-visible')) at(event.currentTarget, 'focus');
      },
      onBlur: (event: { currentTarget: HTMLElement }) => blur(event.currentTarget),
      ...(hover && {
        onPointerEnter: (event: PointerEvent<HTMLElement>) => { if (event.pointerType === 'mouse') at(event.currentTarget, 'hover'); },
        onPointerLeave: (event: PointerEvent<HTMLElement>) => { if (event.pointerType === 'mouse') hoverOut(); },
      }),
    },
  };
}

const TRIGGER = 'cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** A resolved mention: plain text that shows a dotted underline in its entity's color on hover, focus, or while
 *  its card is open. A span, not a button, so a multi-word mention wraps like the prose around it. */
function MentionTrigger({ entityId, span, children }: { entityId: string; span: TextSpan; children: ReactNode }) {
  const trigger = useCardTrigger(entityId, 'mention', span, true);
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
        {...trigger.handlers}
      >
        {children}
      </span>
    </InMentionContext.Provider>
  );
}

/** A quote with a resolved speaker opens its speaker's card on click, tap, keyboard focus, or a key press. */
function SpeakerQuoteTrigger({ speaker, props }: { speaker: string; props: ComponentPropsWithoutRef<'span'> }) {
  const trigger = useCardTrigger(speaker, 'speaker', parseSpanKey((props as Record<string, unknown>)['data-quote-span']), false);
  const inMention = useContext(InMentionContext);
  if (!trigger || inMention) return <span {...props} />;
  return <span {...props} role="button" tabIndex={0} className={cn(props.className, TRIGGER)} {...trigger.handlers} />;
}

// Streamdown's own anchor, so an ordinary link keeps the leave-site check.
const DefaultAnchor = defaultComponents.a as ComponentType<ComponentPropsWithoutRef<'a'> & ExtraProps>;

function MentionAnchor(props: ComponentPropsWithoutRef<'a'> & ExtraProps) {
  const mention = parseMentionMark(String(props.node?.properties?.[LINK_MARK_PROPERTY] ?? ''));
  if (!mention) return <DefaultAnchor {...props} />;
  return <MentionTrigger entityId={mention.entityId} span={mention}>{props.children}</MentionTrigger>;
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
