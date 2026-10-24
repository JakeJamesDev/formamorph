import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pager } from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { RequestStatusRow, RequestStatusStrip } from '@/components/game/RequestStatusRow';
import {
  BACKGROUND_PASS_STATUS,
  FALLBACK_STATUS,
  REQUEST_STATUS,
  TOOL_GLYPH,
  requestLabel,
  type StatusGlyphKey,
} from '@/components/game/statusGlyphs/glyphMap';
import { StatusGlyph } from '@/components/game/statusGlyphs/StatusGlyph';
import { ThinkingLabel } from '@/components/game/ReasoningBlock';
import { NARRATION_FADE, NARRATION_FADE_UNDER_STRIP, useEdgeFades } from '@/components/game/narrationFade';

const NARRATION = [
  'The ferry scrapes against the landing. Rain runs off the rope rail and into the black water below.',
  'A lantern swings at the far end of the pier. Someone holds it high and waits.',
  'The ferryman points at the lantern and does not speak.',
].join('\n\n');

type RowShown = { label: string; glyph: StatusGlyphKey };

// The Turn row steps through a turn's requests, so the glyph swap shows.
const TURN_STEPS: ReadonlyArray<RowShown> = (
  ['thinking', 'director', 'storyboard', 'narration', 'choices', 'statUpdates', 'locationChange', 'timePassed', 'summary'] as const
).map((type) => ({ label: requestLabel(REQUEST_STATUS[type]), glyph: REQUEST_STATUS[type].glyph }));
const TURN_STEP_MS = 2000;

const ROWS = {
  turn: TURN_STEPS[0],
  tool: { label: 'Calling roll_dice…', glyph: TOOL_GLYPH },
  background: BACKGROUND_PASS_STATUS.digest,
  none: null,
} as const satisfies Record<string, RowShown | null>;

// What each glyph serves, read from the maps the game uses.
const GLYPH_USES = (() => {
  const uses = new Map<StatusGlyphKey, Set<string>>();
  const add = (glyph: StatusGlyphKey, use: string) => uses.set(glyph, (uses.get(glyph) ?? new Set()).add(use));
  for (const { name, glyph } of [...Object.values(REQUEST_STATUS), FALLBACK_STATUS]) add(glyph, name);
  add(TOOL_GLYPH, 'Tool calls');
  return [...uses].map(([glyph, names]) => [glyph, [...names].join(', ')] as const);
})();
type RowKey = keyof typeof ROWS;

// The shared Thinking header while the model thinks, as the game and Formaquestion show it.
const THINKING_FORMS = [
  { use: 'Game', who: null },
  { use: 'Formaquestion', who: 'Mascot' },
] as const;

export function RequestStatusStripReference() {
  const [row, setRow] = useState<RowKey>('turn');
  const [step, setStep] = useState(0);
  const [startedAt] = useState(() => Date.now() - 12_000);
  useEffect(() => {
    if (row !== 'turn') return;
    const id = setInterval(() => setStep((s) => (s + 1) % TURN_STEPS.length), TURN_STEP_MS);
    return () => clearInterval(id);
  }, [row]);
  const shown = row === 'turn' ? TURN_STEPS[step] : ROWS[row];
  const viewport = useRef<HTMLDivElement>(null);
  useEdgeFades(viewport);
  return (
    <Card role="region" aria-labelledby="status-strip-title">
      <CardHeader>
        <CardTitle id="status-strip-title" className="text-heading">Request Status Strip</CardTitle>
        <CardDescription>
          The production status row in its strip over a sample narration frame. Pick a row to show it. The footer stays still. Each request type loops its own glyph. The Turn row steps through the requests of one turn.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ToggleGroup
          type="single"
          aria-label="Status Row"
          className="justify-start"
          value={row}
          onValueChange={(next) => { if (next) setRow(next as RowKey); }}
        >
          <ToggleGroupItem value="turn">Turn</ToggleGroupItem>
          <ToggleGroupItem value="tool">Tool</ToggleGroupItem>
          <ToggleGroupItem value="background">Background</ToggleGroupItem>
          <ToggleGroupItem value="none">None</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex h-48 flex-col gap-2">
          <ScrollArea
            className="narration-text min-h-0 flex-grow border border-border bg-muted/80 p-2"
            viewportRef={viewport}
            viewportProps={{ className: shown ? NARRATION_FADE_UNDER_STRIP : NARRATION_FADE }}
          >
            <MarkdownRenderer text={NARRATION} />
          </ScrollArea>
          <div className="relative flex flex-col gap-2">
            {shown && (
              <RequestStatusStrip>
                <RequestStatusRow label={shown.label} glyph={shown.glyph} startedAt={row === 'background' ? undefined : startedAt} />
              </RequestStatusStrip>
            )}
            <Pager page={3} pageCount={3} onPageChange={() => {}} className="justify-center" />
          </div>
        </div>
        <ul aria-label="Status Glyphs" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GLYPH_USES.map(([glyph, use]) => (
            <li key={glyph} className="flex items-center gap-2 text-muted-foreground">
              <span aria-hidden className="flex size-4 shrink-0 items-center justify-center"><StatusGlyph glyph={glyph} /></span>
              <span className="text-meta">{use}</span>
            </li>
          ))}
        </ul>
        <ul aria-label="Thinking Header" className="grid gap-2 sm:grid-cols-2">
          {THINKING_FORMS.map(({ use, who }) => (
            <li key={use} className="flex items-center gap-1.5 text-meta text-muted-foreground">
              <ChevronRight aria-hidden className="h-3.5 w-3.5 rotate-90" />
              <ThinkingLabel active ms={0} who={who} />
              <span className="ml-auto">{use}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
