import type { CSSProperties } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta, SectionTitle } from '@/components/ui/typography';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { MentionCard, MentionCardsProvider, cardTriggers } from '@/components/game/MentionCards';
import { TurnCard } from '@/components/game/TurnCard';
import { remarkMentionLinks } from '@/lib/coref/mentionLinks';
import { speakerColors } from '@/lib/coref/speakerPalette';
import type { PlayerViewEntity } from '@/lib/formaquestion/playerView';
import type { MentionLink } from '@/lib/coref/mentionReading';
import { spokenQuotes, type QuoteSpeakerSource } from '@/lib/quoteSegments';
import type { RemarkPlugin } from '@/components/game/MarkdownRenderer';

const PASSAGE = `The ferry bumps the dock as Mira throws the line. She doesn't look at her sister when Kessa comes down the plank.

"Ask the courier if you don't believe me." The courier lifts one hand from the bench.`;

const COLORS = speakerColors([{ id: 'mira' }, { id: 'kessa' }, { id: 'courier' }]);

/** A tall placeholder portrait with a head near the top, so the top-anchored crop shows. */
const portraitData = (back: string, figure: string) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><rect width="240" height="360" fill="${back}"/>`
  + `<circle cx="120" cy="80" r="44" fill="${figure}"/><rect x="56" y="136" width="128" height="224" rx="40" fill="${figure}"/></svg>`,
)}`;

const row = (id: string, name: string, description: string, alias?: true): PlayerViewEntity =>
  ({ kind: 'entity', id, name, description, ...(alias && { alias }) });
const MIRA = row('mira', 'Mira', 'Ferry captain. Keeps the ledger and the grudges.');
const KESSA = row('kessa', 'Kessa', "Mira's younger sister. Runs the tackle shop on the pier.");
const COURIER: PlayerViewEntity = { ...row('courier', 'the courier', '', true), image: portraitData('#6b5a48', '#d8c3a5') };
const ROWS = new Map([MIRA, KESSA, COURIER].map((r) => [r.id, r]));

/** The first span of each `[text, entity]` in order: a canned reading. */
function mentions(hits: [string, string][]): MentionLink[] {
  let from = 0;
  return hits.map(([text, entityId]) => {
    const start = PASSAGE.indexOf(text, from);
    from = start + text.length;
    return { start, end: from, entityId };
  });
}

const LINKS: RemarkPlugin = [remarkMentionLinks, {
  source: { text: PASSAGE, mentions: mentions([['Mira', 'mira'], ['She', 'mira'], ['her sister', 'kessa'], ['Kessa', 'kessa'], ['the courier', 'courier'], ['The courier', 'courier']]) },
}];
const SPEAKERS: QuoteSpeakerSource = { text: PASSAGE, colors: COLORS, quotes: spokenQuotes(PASSAGE, [['"Ask the courier if you don\'t believe me."', 'mira']]) };

/** A mention in the state its card shows it: underlined in its entity's color. */
function UnderlinedMention({ id, children }: { id: string; children: string }) {
  return (
    <span
      style={{ '--mention-color': COLORS.get(id) } as CSSProperties}
      className="underline decoration-dotted decoration-[1.5px] underline-offset-4 [text-decoration-color:var(--mention-color)]"
    >
      {children}
    </span>
  );
}

/** One mode of the sample. The class and `data-theme` pin the mode, so both render at once. */
function ThemePanel({ mode }: { mode: 'light' | 'dark' }) {
  return (
    <section
      aria-label={`${mode === 'light' ? 'Light' : 'Dark'} Theme`}
      className={`${mode} min-w-0 space-y-5 rounded-md border border-border bg-background p-4 text-foreground`}
      data-theme="blue"
    >
      <SectionTitle>{mode === 'light' ? 'Light' : 'Dark'}</SectionTitle>
      <div className="space-y-2">
        <Meta>Cards</Meta>
        <div className="flex flex-wrap gap-3">
          {[MIRA, COURIER].map((r) => (
            <div key={r.id} className="w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
              <MentionCard row={r} color={COLORS.get(r.id)} onWrong={() => {}} />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Meta>Hovered Mention</Meta>
        <p>The ferry bumps the dock as <UnderlinedMention id="mira">Mira</UnderlinedMention> throws the line.</p>
      </div>
      <div className="space-y-2">
        <Meta>In a Turn</Meta>
        <TurnCard actions={[]} turnNumber={8}>
          <MarkdownRenderer text={PASSAGE} dialogue {...cardTriggers(SPEAKERS, LINKS)} />
        </TurnCard>
      </div>
    </section>
  );
}

/** Mention hover cards: the card, a hovered mention, and a live turn to hover, both modes at once. */
export function MentionCardsReference() {
  return (
    <MentionCardsProvider colors={COLORS} rows={ROWS}>
      <Card role="region" aria-labelledby="mention-cards-reference-title" className="min-w-0">
        <CardHeader>
          <CardTitle id="mention-cards-reference-title" className="text-heading">Mention Cards</CardTitle>
          <CardDescription>Hover, tap or focus a name in the turn to open its card</CardDescription>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4 lg:grid-cols-2">
          <ThemePanel mode="light" />
          <ThemePanel mode="dark" />
        </CardContent>
      </Card>
    </MentionCardsProvider>
  );
}
