import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Entity, GameState } from '@/types';
import { buildPlayerView } from '@/lib/formaquestion/playerView';
import { speakerColors } from '@/lib/coref/speakerPalette';
import { blockMentions, remarkMentionLinks, turnMentionLinks } from '@/lib/coref/mentionLinks';
import { narrationHash, type MentionReadingMap } from '@/lib/coref/mentionReadings';
import type { MentionLink } from '@/lib/coref/mentionReading';
import { spokenQuotes, type QuoteSpeakerSource } from '@/lib/quoteSegments';
import { MarkdownRenderer, type RemarkPlugin } from './MarkdownRenderer';
import { MentionCardsProvider, MentionTurn, cardTriggers, mentionCardRows, turnCardTriggers, type CardCorrection } from './MentionCards';
import { applyCardCorrection, correctedMentionReadings, type MentionCorrectionMap } from '@/lib/coref/mentionCorrections';
import { useState } from 'react';

// The real renderer with a fake reading, and card rows from the real Player View: what counts is what the
// player can reach in the DOM.

const entity = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({
  id, name, playerDescription: `${name} player text.`, aiDescription: `${name} AI secret.`, ...extra,
});
const MIRA = entity('mira', 'Mira');
const KESSA = entity('kessa', 'Kessa');
const COURIER = entity('courier', 'Ilan', { strangerName: 'the courier', strangerDescription: 'Ilan stranger text.' });
const GHOST = entity('ghost', 'Wraith', { strangerName: 'a pale shape' });
const CAST = [MIRA, KESSA, COURIER, GHOST];
const COLORS = speakerColors(CAST);

const state = (extra: Partial<GameState> = {}): GameState => ({
  globalStats: [], globalTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0,
  characterData: null, choices: [], isGameStarted: true, timestamp: '', worldName: null, playerNotes: '',
  previousStateIndex: null, stateVersion: 1, ...extra,
});

/** Mira and Kessa met; the courier seen only as "the courier", never named; the wraith never seen. */
const ROWS = mentionCardRows(buildPlayerView({
  world: { entities: CAST, locations: [], traits: [] },
  chain: [state({ metEntities: ['mira', 'kessa'], visibleEntities: [{ name: 'Ilan', alias: 'the courier', revealed: false }] })],
  history: [], persona: null, resolve: (text) => text,
}));

/** Each `[text, entity]` found as a whole word in `passage`, in order, as the reading's mentions. */
function mentionsOf(passage: string, hits: [string, string | null][]): MentionLink[] {
  let from = 0;
  return hits.map(([text, entityId]) => {
    const match = new RegExp(`\\b${text}\\b`).exec(passage.slice(from));
    if (!match) throw new Error(`No ${text}`);
    const start = from + match.index;
    from = start + text.length;
    return { start, end: from, entityId };
  });
}

const linksOf = (passage: string, hits: [string, string | null][]): RemarkPlugin =>
  [remarkMentionLinks, { source: { text: passage, mentions: mentionsOf(passage, hits) } }];

function show(text: string, links?: RemarkPlugin, speakers?: QuoteSpeakerSource, onCorrect?: (c: CardCorrection) => void) {
  return render(
    <MentionCardsProvider colors={COLORS} rows={ROWS} onCorrect={onCorrect}>
      <MentionTurn turnId="t1">
        <MarkdownRenderer text={text} dialogue {...cardTriggers(speakers, links)} />
      </MentionTurn>
    </MentionCardsProvider>,
  );
}

const triggers = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-mention]')]
  .map((el) => [el.textContent, el.dataset.mention]);
const card = () => screen.queryByTestId('mention-card');

const PASSAGE = 'The ferry bumps the dock as Mira throws the line. She doesn\'t look at her sister when Kessa comes down.';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('mention links in narration', () => {
  it('turns resolved mentions into triggers and leaves unresolved ones as text', () => {
    const { container } = show(PASSAGE, linksOf(PASSAGE, [['Mira', 'mira'], ['She', 'mira'], ['her sister', null], ['Kessa', 'kessa']]));
    expect(triggers(container)).toEqual([['Mira', 'mira'], ['She', 'mira'], ['Kessa', 'kessa']]);
    expect(container.textContent).toBe(PASSAGE);
    expect(container.querySelector('a')).toBeNull();
  });

  it('renders unchanged with no reading', () => {
    const plain = render(<MarkdownRenderer text={PASSAGE} dialogue />).container.innerHTML;
    cleanup();
    expect(show(PASSAGE).container.innerHTML).toBe(plain);
  });

  it('keeps a mention with no Player View row as plain text (Q46)', () => {
    const text = 'Behind the rail, the wraith waits.';
    const { container } = show(text, linksOf(text, [['the wraith', 'ghost']]));
    expect(triggers(container)).toEqual([]);
    expect(container.textContent).toBe(text);
  });

  it('places each mention by its offset, not by the first matching letters', () => {
    const text = 'The theater was empty when he arrived, and he sat.';
    const { container } = show(text, linksOf(text, [['he', 'mira'], ['he', 'kessa']]));
    expect(triggers(container)).toEqual([['he', 'mira'], ['he', 'kessa']]);
    expect(container.querySelector('[data-mention="mira"]')?.previousSibling?.textContent).toBe('The theater was empty when ');
  });

  it('links mentions across paragraphs and inside emphasis', () => {
    const text = 'Mira waves.\n\nThen **Kessa** laughs.';
    const { container } = show(text, linksOf(text, [['Mira', 'mira'], ['Kessa', 'kessa']]));
    expect(triggers(container)).toEqual([['Mira', 'mira'], ['Kessa', 'kessa']]);
    expect(container.querySelector('[data-streamdown="strong"] [data-mention="kessa"]')).not.toBeNull();
  });

  it('tells a repeated paragraph apart by its place in the passage', () => {
    const text = 'She nods.\n\nShe nods.';
    const hits: [string, string][] = [['She', 'mira'], ['She', 'kessa']];
    expect(triggers(show(text, linksOf(text, hits)).container)).toEqual([['She', 'mira'], ['She', 'kessa']]);
  });

  it('places a block by its text, and gives up on one that repeats with different mentions', () => {
    const text = 'She nods.\n\nShe nods.\n\nMira waits.';
    const source = { text, mentions: mentionsOf(text, [['She', 'mira'], ['She', 'kessa'], ['Mira', 'mira']]) };
    expect(blockMentions(source, '\nMira waits.')).toEqual([{ start: 1, end: 5, entityId: 'mira', from: 22, to: 26 }]);
    expect(blockMentions(source, 'She nods.')).toEqual([]);
  });

  it('links nothing in a block the narration does not hold', () => {
    const text = 'She nods.';
    const links: RemarkPlugin = [remarkMentionLinks, { source: { text: 'He waits. She nods twice.', mentions: [{ start: 10, end: 13, entityId: 'mira' }] } }];
    expect(triggers(show(text, links).container)).toEqual([]);
  });

  it('gives the renderer one plugin per reading and nothing while the feature is off', () => {
    const readings: MentionReadingMap = {
      t1: { model: 'small', version: 1, textHash: narrationHash(PASSAGE), reading: { mentions: mentionsOf(PASSAGE, [['Mira', 'mira']]), quotes: [] } },
    };
    expect(turnMentionLinks(true, readings, 't1', PASSAGE)).toBe(turnMentionLinks(true, readings, 't1', PASSAGE));
    expect(turnMentionLinks(false, readings, 't1', PASSAGE)).toBeUndefined();
    expect(turnMentionLinks(true, readings, 't1', `${PASSAGE} Edited.`)).toBeUndefined();
  });
});

describe('mention cards', () => {
  const COURIER_TEXT = 'The courier lifts one hand without standing.';
  const courierLinks = linksOf(COURIER_TEXT, [['The courier', 'courier']]);

  it('shows an unmet stranger under the label the player saw, with nothing hidden', () => {
    const { container } = show(COURIER_TEXT, courierLinks);
    fireEvent.click(container.querySelector<HTMLElement>('[data-mention="courier"]')!);
    const shown = card()!;
    expect(shown.textContent).toContain('the courier');
    expect(shown.textContent).not.toMatch(/Ilan|AI secret|stranger text/);
  });

  it('shows a met character under its name with its player description', () => {
    fireEvent.click(show(PASSAGE, linksOf(PASSAGE, [['Mira', 'mira']])).container.querySelector<HTMLElement>('[data-mention]')!);
    expect(card()!.textContent).toBe('MMiraMira player text.');
  });

  it('opens on a tap, and a second tap closes it', () => {
    const trigger = show(COURIER_TEXT, courierLinks).container.querySelector<HTMLElement>('[data-mention]')!;
    fireEvent.click(trigger);
    expect(card()).not.toBeNull();
    expect(trigger.hasAttribute('data-card-open')).toBe(true);
    fireEvent.click(trigger);
    expect(card()).toBeNull();
  });

  it('opens on keyboard focus and closes on blur', () => {
    const trigger = show(COURIER_TEXT, courierLinks).container.querySelector<HTMLElement>('[data-mention]')!;
    act(() => trigger.focus());
    expect(card()).not.toBeNull();
    act(() => trigger.blur());
    expect(card()).toBeNull();
  });

  it('opens on Enter, as a button does', () => {
    const trigger = show(COURIER_TEXT, courierLinks).container.querySelector<HTMLElement>('[data-mention]')!;
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(card()).not.toBeNull();
  });

  it('keeps a text selection rather than opening a card on the click that ends it', () => {
    const trigger = show(COURIER_TEXT, courierLinks).container.querySelector<HTMLElement>('[data-mention]')!;
    window.getSelection()!.selectAllChildren(trigger);
    fireEvent.click(trigger);
    expect(card()).toBeNull();
    window.getSelection()!.removeAllRanges();
  });

  it('opens after a short hover on a mouse, never at once', () => {
    vi.useFakeTimers();
    const trigger = show(COURIER_TEXT, courierLinks).container.querySelector<HTMLElement>('[data-mention]')!;
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    expect(card()).toBeNull();
    act(() => { vi.advanceTimersByTime(300); });
    expect(card()).not.toBeNull();
    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(200); });
    expect(card()).toBeNull();
  });

  it('opens nothing when a touch passes over a mention', () => {
    vi.useFakeTimers();
    const trigger = show(COURIER_TEXT, courierLinks).container.querySelector<HTMLElement>('[data-mention]')!;
    fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(card()).toBeNull();
  });

  it("opens the speaker's card from a quote, and a mention inside it opens its own", () => {
    const text = '"Ask the courier," Mira says.';
    const speakers: QuoteSpeakerSource = { text, colors: COLORS, quotes: spokenQuotes(text, [['"Ask the courier,"', 'mira']]) };
    const { container } = show(text, linksOf(text, [['the courier', 'courier'], ['Mira', 'mira']]), speakers);
    const quote = container.querySelector<HTMLElement>('[data-speaker="mira"][role="button"]')!;
    fireEvent.click(quote);
    expect(card()!.textContent).toContain('Mira');
    const nested = container.querySelector<HTMLElement>('[data-mention="courier"]')!;
    expect(nested.querySelector('[role="button"]')).toBeNull();
    fireEvent.click(nested);
    expect(card()!.textContent).toContain('the courier');
  });

  it('shows "Wrong character?" only with a correction handler (Q47)', () => {
    const { container } = show(COURIER_TEXT, courierLinks);
    fireEvent.click(container.querySelector<HTMLElement>('[data-mention]')!);
    expect(screen.queryByText('Wrong character?')).toBeNull();
    cleanup();
    fireEvent.click(show(COURIER_TEXT, courierLinks, undefined, vi.fn()).container.querySelector<HTMLElement>('[data-mention]')!);
    expect(screen.getByText('Wrong character?')).toBeTruthy();
  });

  it('offers no correction for narration outside a turn', () => {
    render(
      <MentionCardsProvider colors={COLORS} rows={ROWS} onCorrect={vi.fn()}>
        <MarkdownRenderer text={COURIER_TEXT} dialogue {...cardTriggers(undefined, courierLinks)} />
      </MentionCardsProvider>,
    );
    fireEvent.click(document.querySelector<HTMLElement>('[data-mention]')!);
    expect(card()).not.toBeNull();
    expect(screen.queryByText('Wrong character?')).toBeNull();
  });
});

const COURIER_LINE = 'The courier lifts one hand without standing.';
const courierLine = linksOf(COURIER_LINE, [['The courier', 'courier']]);

describe('correcting from a card', () => {
  const names = () => [...card()!.querySelectorAll('button')].map((b) => b.textContent);

  it('swaps the card for the cast by Player View name, with a way back', () => {
    const { container } = show(COURIER_LINE, courierLine, undefined, vi.fn());
    fireEvent.click(container.querySelector<HTMLElement>('[data-mention]')!);
    fireEvent.click(screen.getByText('Wrong character?'));
    expect(card()!.textContent).toContain('Who is this?');
    // The unseen wraith has no Player View row, so it is no choice.
    expect(names()).toEqual(['', 'MMira', 'KKessa', 'Cthe courier', '–Someone Else']);
    fireEvent.click(screen.getByLabelText('Back'));
    expect(screen.getByText('Wrong character?')).toBeTruthy();
  });

  it("corrects the opened mention's span in its turn, and closes the card", () => {
    const onCorrect = vi.fn();
    const { container } = show(COURIER_LINE, courierLine, undefined, onCorrect);
    fireEvent.click(container.querySelector<HTMLElement>('[data-mention]')!);
    fireEvent.click(screen.getByText('Wrong character?'));
    fireEvent.click(screen.getByText('Kessa'));
    const start = COURIER_LINE.indexOf('The courier');
    expect(onCorrect).toHaveBeenCalledWith({ turnId: 't1', kind: 'mention', start, end: start + 'The courier'.length, entityId: 'kessa' });
    expect(card()).toBeNull();
  });

  it("asks who said a quote, and corrects the quote's span", () => {
    const text = 'Mira turns. "Go," she says.';
    const speakers: QuoteSpeakerSource = { text, colors: COLORS, quotes: spokenQuotes(text, [['"Go,"', 'mira']]) };
    const onCorrect = vi.fn();
    const { container } = show(text, undefined, speakers, onCorrect);
    fireEvent.click(container.querySelector<HTMLElement>('[data-speaker="mira"][role="button"]')!);
    fireEvent.click(screen.getByText('Wrong character?'));
    expect(card()!.textContent).toContain('Who said this?');
    fireEvent.click(screen.getByText('Someone Else'));
    expect(onCorrect).toHaveBeenCalledWith({ turnId: 't1', kind: 'quote', start: 12, end: 17, entityId: null });
  });
});

describe('a correction on a played turn', () => {
  const TEXT = 'Mira turns to her sister. "Go," she says.';
  const span = (word: string) => ({ start: TEXT.indexOf(word), end: TEXT.indexOf(word) + word.length });
  const READINGS: MentionReadingMap = {
    t1: {
      model: 'small', version: 1, textHash: narrationHash(TEXT),
      reading: {
        mentions: [{ ...span('Mira'), entityId: 'mira' }, { ...span('her sister'), entityId: null }, { ...span('she'), entityId: 'mira' }],
        quotes: [{ ...span('"Go,"'), speaker: 'mira' }],
      },
    },
  };

  /** The game view's loop: a card's correction joins the turn's map, which overlays the reading the turn renders from. */
  function Turn() {
    const [corrections, setCorrections] = useState<MentionCorrectionMap>({});
    const readings = correctedMentionReadings(READINGS, corrections);
    return (
      <MentionCardsProvider
        colors={COLORS}
        rows={ROWS}
        onCorrect={(c) => setCorrections((prev) => applyCardCorrection(prev, READINGS, c))}
      >
        <MentionTurn turnId="t1">
          <MarkdownRenderer text={TEXT} dialogue {...turnCardTriggers(false, true, readings, COLORS, 't1', TEXT)} />
        </MentionTurn>
      </MentionCardsProvider>
    );
  }

  const pick = (trigger: HTMLElement, name: string) => {
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Wrong character?'));
    fireEvent.click(screen.getByText(name));
  };
  const quote = (root: HTMLElement) => root.querySelector<HTMLElement>('.dialogue-quote')!;

  it("recolors a quote at once when its speaker is corrected", () => {
    const { container } = render(<Turn />);
    expect(quote(container).style.getPropertyValue('--quote-speaker')).toBe(COLORS.get('mira'));
    pick(quote(container), 'Kessa');
    expect(quote(container).dataset.speaker).toBe('kessa');
    expect(quote(container).style.getPropertyValue('--quote-speaker')).toBe(COLORS.get('kessa'));
  });

  it("relinks a mention at once, and its card shows the new character", () => {
    const { container } = render(<Turn />);
    pick(container.querySelectorAll<HTMLElement>('[data-mention]')[1], 'Kessa');
    expect(triggers(container)).toEqual([['Mira', 'mira'], ['she', 'kessa']]);
    fireEvent.click(container.querySelectorAll<HTMLElement>('[data-mention]')[1]);
    expect(card()!.textContent).toContain('Kessa');
  });

  it('hands keyboard focus to the corrected mention after the narration remounts', async () => {
    const { container } = render(<Turn />);
    const she = container.querySelectorAll<HTMLElement>('[data-mention]')[1];
    she.focus();
    fireEvent.keyDown(she, { key: 'Enter' });
    fireEvent.click(document.activeElement!);
    fireEvent.click(screen.getByText('Kessa'));
    expect(she.isConnected).toBe(false);
    await waitFor(() => expect((document.activeElement as HTMLElement).dataset.mention).toBe('kessa'));
    expect(document.activeElement!.textContent).toBe('she');
    expect(card()).toBeNull();
  });

  it('unlinks a mention with "Someone Else"', () => {
    const { container } = render(<Turn />);
    pick(container.querySelectorAll<HTMLElement>('[data-mention]')[1], 'Someone Else');
    expect(triggers(container)).toEqual([['Mira', 'mira']]);
    expect(container.textContent).toBe(TEXT);
  });
});

describe('the card from the keyboard', () => {
  it('moves focus into the card on Enter, through the pick list, and back to the mention after a pick', async () => {
    const onCorrect = vi.fn();
    const { container } = show(COURIER_LINE, courierLine, undefined, onCorrect);
    const trigger = container.querySelector<HTMLElement>('[data-mention]')!;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(document.activeElement?.textContent).toBe('Wrong character?');
    fireEvent.click(document.activeElement!);
    expect(document.activeElement?.textContent).toBe('MMira');
    fireEvent.click(document.activeElement!);
    expect(onCorrect).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'mira' }));
    expect(card()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(card()).toBeNull();
  });

  it('moves focus into a card that was already open when Enter comes', () => {
    vi.useFakeTimers();
    const trigger = show(COURIER_LINE, courierLine, undefined, vi.fn()).container.querySelector<HTMLElement>('[data-mention]')!;
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(300); });
    trigger.focus();
    expect(card()).not.toBeNull();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(document.activeElement?.textContent).toBe('Wrong character?');
  });

  it('closes a key-opened card on Escape and hands focus back', async () => {
    const { container } = show(COURIER_LINE, courierLine, undefined, vi.fn());
    const trigger = container.querySelector<HTMLElement>('[data-mention]')!;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: ' ' });
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(card()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(card()).toBeNull();
  });
});
