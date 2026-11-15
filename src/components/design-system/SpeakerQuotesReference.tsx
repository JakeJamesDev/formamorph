import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta, SectionTitle } from '@/components/ui/typography';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { TurnCard } from '@/components/game/TurnCard';
import { QUOTE_CLASS, spokenQuotes, type QuoteSpeakerSource } from '@/lib/quoteSegments';
import { QUOTE_SWATCHES, SPEAKER_PALETTE_SIZE, speakerColors, swatchColor } from '@/lib/coref/speakerPalette';

const PASSAGE = `The ferry bumps the dock as Mira throws the line. "You said noon," Kessa says, coming down the plank.

"I said after the tide." Mira knots the rope twice. "Ask the courier if you don't believe me."

The courier lifts one hand from the bench. "Don't drag me into this." From the wheelhouse, someone calls out: "Both of you, the tide won't wait."`;

const LINES: [string, string | null][] = [
  ['"You said noon,"', 'kessa'], ['"I said after the tide."', 'mira'], ['"Ask the courier if you don\'t believe me."', 'mira'],
  ['"Don\'t drag me into this."', 'courier'], ['"Both of you, the tide won\'t wait."', null],
];

/** A canned reading of the passage: three speakers, Kessa pinned to a swatch, and one quote nobody in the cast said. */
const SPEAKERS: QuoteSpeakerSource = {
  text: PASSAGE,
  colors: speakerColors([{ id: 'mira' }, { id: 'kessa', quoteColor: 'teal' }, { id: 'courier' }]),
  quotes: spokenQuotes(PASSAGE, LINES),
};

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
        <Meta>Swatches (the first {SPEAKER_PALETTE_SIZE} are Auto)</Meta>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {QUOTE_SWATCHES.map((key) => (
            <div key={key} className="flex items-baseline justify-between gap-2">
              <span className={QUOTE_CLASS} style={{ '--quote-speaker': swatchColor(key) } as React.CSSProperties}>{'"Quote"'}</span>
              <Meta>{key}</Meta>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Meta>In a Turn</Meta>
        <TurnCard actions={[]} turnNumber={8}>
          <MarkdownRenderer text={PASSAGE} dialogue speakers={SPEAKERS} />
        </TurnCard>
      </div>
    </section>
  );
}

/** Speaker quote colors: the swatches and a turn read by Character Mentions, both modes at once. */
export function SpeakerQuotesReference() {
  return (
    <Card role="region" aria-labelledby="speaker-quotes-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="speaker-quotes-reference-title" className="text-heading">Speaker Quote Colors</CardTitle>
        <CardDescription>Shows each speaker’s quotes in their own color, with Quote Color on</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ThemePanel mode="light" />
        <ThemePanel mode="dark" />
      </CardContent>
    </Card>
  );
}
