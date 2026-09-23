import { useMemo, type ReactNode } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorldCardFace } from '@/components/WorldCardFace';
import {
  computeInPlay, type InPlayReader, type InPlaySlice, type MarkSpan, type PlayerSurface, type ReaderState,
} from '@/lib/authoringTour/inPlay';
import { useTourRecord } from '@/lib/authoringTour/progress';
import type { TourStep } from '@/lib/authoringTour/steps';

const STATE_LINES: Record<Exclude<ReaderState, 'reads'>, string> = {
  neverReads: 'The AI never reads this field',
  notInScene: 'The AI never reads an entity with no location',
  noKeyword: 'The AI reads this entry only when the test line has a keyword',
};

/** The reader text with each of the author's own runs marked. */
function markedText(text: string, marks: readonly MarkSpan[]): ReactNode[] {
  const parts: ReactNode[] = [];
  let at = 0;
  marks.forEach((m, i) => {
    if (m.start > at) parts.push(text.slice(at, m.start));
    parts.push(<mark key={i} className="rounded-sm bg-amber-400/25 px-0.5 text-inherit">{text.slice(m.start, m.end)}</mark>);
    at = m.end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="space-y-2">
    <h3 className="text-label font-medium">{title}</h3>
    {children}
  </section>
);

const Muted = ({ children }: { children: ReactNode }) => (
  <p className="text-helper text-muted-foreground">{children}</p>
);

function PlayerSees({ surface }: { surface: PlayerSurface }) {
  if (surface.kind === 'none') return null;
  return (
    <Section title="Player Sees">
      {surface.kind === 'libraryCard'
        ? <div className="w-56 max-w-full"><WorldCardFace world={surface.world} layout="grid" /></div>
        : <Muted>Players never see this field</Muted>}
    </Section>
  );
}

const Reader = ({ reader }: { reader: InPlayReader }) => (
  <Section title={`${reader.prompt} Reads`}>
    {reader.state === 'reads' ? (
      <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 text-meta leading-relaxed">
        {markedText(reader.text, reader.marks)}
      </pre>
    ) : <Muted>{STATE_LINES[reader.state]}</Muted>}
  </Section>
);

/** The Authoring Tour's In Play pane: the current step's field as the player sees it and as each prompt reads it. */
export function InPlayPane({ slice }: { slice: InPlaySlice }) {
  return (
    <section aria-labelledby="in-play-title" className="flex h-full flex-col">
      <h2 id="in-play-title" className="flex-shrink-0 border-b px-3 py-2 text-heading font-semibold">In Play</h2>
      <ScrollArea className="min-h-0 flex-grow">
        <div className="space-y-4 p-3">
          <PlayerSees surface={slice.playerSees} />
          {slice.readers.map((reader) => <Reader key={reader.prompt} reader={reader} />)}
        </div>
      </ScrollArea>
    </section>
  );
}

/** In Play for the open world's current tour step, recomputed on every edit. */
export function TourInPlay({ worldId, step }: { worldId: string; step: TourStep }) {
  const { getWorldData } = useGameData();
  const items = useTourRecord(worldId)?.items;
  // `getWorldData` is memoized on the world arrays, so its identity changes with each edit.
  const slice = useMemo(
    () => computeInPlay(step.inPlay, getWorldData(), worldId, items ?? {}),
    [step, getWorldData, worldId, items],
  );
  return <InPlayPane slice={slice} />;
}
