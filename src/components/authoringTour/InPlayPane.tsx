import { useMemo, type ReactNode } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorldCardFace } from '@/components/WorldCardFace';
import { LocationTabBody } from '@/components/game/LocationTabBody';
import { EntityListRow } from '@/components/game/EntityListRow';
import { EntityCardBody, EntityDescription } from '@/components/game/EntityCard';
import { StatRow } from '@/components/game/StatRow';
import {
  computeInPlay, type InPlayReader, type InPlaySlice, type MarkSpan, type PlayerSurface, type ReaderState,
  type StartsAt,
} from '@/lib/authoringTour/inPlay';
import { useTourRecord } from '@/lib/authoringTour/progress';
import type { TourStep } from '@/lib/authoringTour/steps';

const STARTS_LINES: Record<StartsAt, string> = {
  here: 'A new game starts here',
  elsewhere: 'A new game starts at another location',
  anywhere: 'A new game starts at a random location',
};

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

/** The tour entity's row in the Entities tab, its card, or both. The row only shows while the entity has a
 *  location, except on the Name step, which shows the entity the way players meet it. */
function EntitySurface({ surface }: { surface: Extract<PlayerSurface, { entity: unknown }> }) {
  const { entity, at, kind } = surface;
  if (!entity) return null;
  const row = kind !== 'entityCard';
  const card = kind !== 'entityRow';
  if (kind === 'entityRow' && !at) return <Muted>Players never see an entity with no location</Muted>;
  return (
    <div className="space-y-3">
      {row && (
        <div className="space-y-1">
          {at && <Muted>{`While players are at ${at}`}</Muted>}
          <div className="rounded-md border p-1"><EntityListRow label={entity.name} /></div>
        </div>
      )}
      {card && (
        <div className="flex flex-col rounded-md border">
          <h4 className="border-b px-4 py-2 text-heading font-semibold">{entity.name}</h4>
          <EntityCardBody entity={entity}>
            <EntityDescription text={entity.playerDescription ?? ''} />
          </EntityCardBody>
        </div>
      )}
    </div>
  );
}

function Surface({ surface }: { surface: Exclude<PlayerSurface, { kind: 'none' }> }) {
  switch (surface.kind) {
    case 'libraryCard':
      return <div className="w-56 max-w-full"><WorldCardFace world={surface.world} layout="grid" /></div>;
    case 'locationTab':
      return (
        <div className="rounded-md border">
          <LocationTabBody location={surface.location} locations={surface.locations} connections={surface.connections} />
        </div>
      );
    case 'startsHere':
      return <p className="text-label">{STARTS_LINES[surface.startsAt]}</p>;
    case 'entityRow':
    case 'entityCard':
    case 'entityRowAndCard':
      return <EntitySurface surface={surface} />;
    case 'statRow':
      return surface.stat && (
        <div className="rounded-md border p-3 pb-1">
          <StatRow
            stat={surface.stat}
            change={0}
            barDelta={0}
            draining={false}
            page={0}
            isViewingPast={false}
            snap
            fading={false}
            editable={false}
            reserveDescriptorLine={false}
            onCommitValue={() => {}}
          />
        </div>
      );
    case 'never':
      return <Muted>Players never see this field</Muted>;
  }
}

function PlayerSees({ surface }: { surface: PlayerSurface }) {
  if (surface.kind === 'none') return null;
  return (
    <Section title="Player Sees">
      <Surface surface={surface} />
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
