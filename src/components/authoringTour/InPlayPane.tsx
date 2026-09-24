import { useId, useMemo, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Hint } from '@/components/ui/typography';
import { WorldCardFace } from '@/components/WorldCardFace';
import { LocationTabBody } from '@/components/game/LocationTabBody';
import { LocationBackdrop } from '@/components/game/LocationBackdrop';
import { EntityListRow } from '@/components/game/EntityListRow';
import { EntityCardBody, EntityDescription } from '@/components/game/EntityCard';
import { StatRow } from '@/components/game/StatRow';
import { SetupTraitList } from '@/components/game/SetupTraitList';
import {
  computeInPlay, type InPlayReader, type InPlaySlice, type MarkSpan, type PlayerSurface, type ReaderState,
  type SetupTraitCategory, type StartsAt, type TourPromptTemplates, usesTestLine,
} from '@/lib/authoringTour/inPlay';
import type { PlayerStat, Trait } from '@/types';
import { useTourRecord } from '@/lib/authoringTour/progress';
import type { TourStep } from '@/lib/authoringTour/steps';
import { sampleMissLine, sampleTestLine, type TestLineScan } from '@/lib/authoringTour/testLine';

const STARTS_LINES: Record<StartsAt, string> = {
  here: 'A new game starts here',
  elsewhere: 'A new game starts at another location',
  anywhere: 'A new game starts at a random location',
};

const STATE_LINES: Record<Exclude<ReaderState, 'reads'>, string> = {
  neverReads: 'The AI never reads this field',
  notInScene: 'The AI never reads an entity with no location',
  noKeyword: 'Nothing reaches the AI on this line',
  noValue: 'The entry fires, but adds nothing until it has a Value',
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

/** The tour entity's row in the Entities tab, its card, or both, as players will meet it. */
function EntitySurface({ surface }: { surface: Extract<PlayerSurface, { entity: unknown }> }) {
  const { entity, at, kind } = surface;
  if (!entity) return null;
  const row = kind !== 'entityCard';
  const card = kind !== 'entityRow';
  return (
    <div className="space-y-3">
      {!at && <Muted>Players meet this entity once it has a location</Muted>}
      {row && (
        <div className="space-y-1">
          {at && <Muted>{`While players are at ${at}`}</Muted>}
          <div className="rounded-md border p-1"><EntityListRow label={entity.name} /></div>
        </div>
      )}
      {card && (
        // The card has no fixed height here, so the picture is capped rather than filling three quarters of one.
        <div className="flex flex-col rounded-md border [&_img]:max-h-72">
          <h4 className="border-b px-4 py-2 text-heading font-semibold">{entity.name}</h4>
          <EntityCardBody entity={entity}>
            <EntityDescription text={entity.playerDescription ?? ''} />
          </EntityCardBody>
        </div>
      )}
    </div>
  );
}

const StatSurface = ({ stat }: { stat: PlayerStat }) => (
  <div className="rounded-md border p-3 pb-1">
    <StatRow
      stat={stat}
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

const asWritten = (text: string) => text;
const traitAsWritten = (_trait: Trait, text: string) => text;

/** The tour trait's category on the setup screen, ticked as the player picks it. Its text arrives resolved. */
const SetupTraitSurface = ({ category }: { category: SetupTraitCategory }) => (
  <div className="rounded-md border p-3">
    <SetupTraitList
      name={category.name}
      groups={category.groups}
      traits={category.traits}
      exclusive={category.exclusive}
      stats={category.stats}
      selectedTraits={category.selected}
      resolveText={asWritten}
      resolveTraitText={traitAsWritten}
      onTraitSelect={() => {}}
    />
  </div>
);

function Surface({ surface }: { surface: Exclude<PlayerSurface, { kind: 'none' }> }) {
  switch (surface.kind) {
    case 'libraryCard':
      return <div className="w-56 max-w-full"><WorldCardFace world={surface.world} layout="grid" /></div>;
    case 'locationTab':
      return (
        // The location's picture sits behind the tab the way it sits behind the story, under the same fade.
        <div className="relative isolate overflow-hidden rounded-md border">
          <LocationBackdrop image={surface.location?.backgroundImage} overlay={0.7} overlayHidden={false} />
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
      return surface.stat && <StatSurface stat={surface.stat} />;
    case 'setupTraits':
      return surface.category && <SetupTraitSurface category={surface.category} />;
    case 'setupTraitsAndStat':
      return (
        <div className="space-y-3">
          {surface.category && <SetupTraitSurface category={surface.category} />}
          {surface.stat && (
            <div className="space-y-1">
              <Muted>When a new game starts</Muted>
              <StatSurface stat={surface.stat} />
            </div>
          )}
        </div>
      );
    case 'never':
      return <Muted>Players never see this field</Muted>;
    case 'neverDictionary':
      return <Muted>Players never see dictionary entries</Muted>;
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

/** The player message a Dictionary step scans for the tour entry's keywords. */
export interface TestLineInput {
  value: string;
  onChange: (value: string) => void;
  /** A line that fires the entry and one that misses, for the try button. Blank hit line: no keyword yet. */
  samples: { hit: string; miss: string };
}

const quote = (text: string) => `“${text}”`;

/** One line on whether the entry fires, and on which keyword. */
function scanStatus(scan: TestLineScan): string {
  if (scan.fired) {
    return scan.hitKeywords.length ? `Fires on ${scan.hitKeywords.map(quote).join(', ')}` : 'Fires on every line';
  }
  if (scan.reason) return `Doesn't fire: ${scan.reason}`;
  if (!scan.keywords.length) return "Doesn't fire: the entry has no keywords yet";
  return "Doesn't fire: the line has none of this entry's keywords";
}

function TestLine({ value, onChange, samples, scan }: TestLineInput & { scan?: TestLineScan }) {
  const id = useId();
  const tryLine = scan?.fired ? samples.miss : samples.hit;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Test Line</Label>
      <Hint>Type a player message to see when the entry loads</Hint>
      <div className="flex gap-2">
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
        {tryLine && (
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => onChange(tryLine)}>
            {scan?.fired ? 'Try a Miss' : 'Try a Hit'}
          </Button>
        )}
      </div>
      {scan && (
        <>
          {scan.keywords.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label="Keywords">
              {scan.keywords.map((keyword) => {
                const hit = scan.hitKeywords.includes(keyword);
                return (
                  <li key={keyword}>
                    <Badge variant={hit ? 'default' : 'outline'} className={cn(!hit && 'text-muted-foreground')}>
                      {keyword}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
          {value.trim() && (
            <p className="rounded-md border bg-muted/30 p-2 text-meta leading-relaxed">
              {scan.segments.map((s, i) => s.hit
                ? <mark key={i} className="rounded-sm bg-amber-400/25 px-0.5 text-inherit">{s.text}</mark>
                : <span key={i}>{s.text}</span>)}
            </p>
          )}
          <p role="status" className={cn('flex items-start gap-1.5 text-helper', !scan.fired && 'text-muted-foreground')}>
            {scan.fired
              ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              : <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
            <span>{scanStatus(scan)}</span>
          </p>
        </>
      )}
    </div>
  );
}

/** The Authoring Tour's In Play pane: the current step's field as the player sees it and as each prompt reads it. */
export function InPlayPane({ slice, testLine }: { slice: InPlaySlice; testLine?: TestLineInput }) {
  return (
    <section aria-labelledby="in-play-title" className="flex h-full flex-col">
      <h2 id="in-play-title" className="flex-shrink-0 border-b px-3 py-2 text-heading font-semibold">In Play</h2>
      <ScrollArea className="min-h-0 flex-grow">
        <div className="space-y-4 p-3">
          <PlayerSees surface={slice.playerSees} />
          {testLine && <TestLine {...testLine} scan={slice.testLine} />}
          {slice.readers.map((reader) => <Reader key={reader.prompt} reader={reader} />)}
        </div>
      </ScrollArea>
    </section>
  );
}

/**
 * In Play for the open world's current tour step, recomputed on every edit. The test line follows the tour
 * entry's first keyword until the author edits it; `testLineEdit` is that edit, held by the editor.
 */
export function TourInPlay({ worldId, step, testLineEdit, onTestLineEdit }: {
  worldId: string;
  step: TourStep;
  testLineEdit: string | null;
  onTestLineEdit: (value: string) => void;
}) {
  const { getWorldData } = useGameData();
  const { systemPrompt, locationChangePromptText, statUpdatesPrompt } = useSettings();
  const items = useTourRecord(worldId)?.items;
  // `getWorldData` is memoized on the world arrays, so its identity changes with each edit.
  const world = useMemo(() => getWorldData(), [getWorldData]);
  const templates = useMemo((): TourPromptTemplates => ({
    'Narration Prompt': systemPrompt,
    'Location Change Prompt': locationChangePromptText,
    'Stat Updates Prompt': statUpdatesPrompt,
  }), [systemPrompt, locationChangePromptText, statUpdatesPrompt]);
  const testLine = usesTestLine(step.inPlay) ? testLineEdit ?? sampleTestLine(world, items ?? {}) : null;
  const slice = useMemo(
    () => computeInPlay(step.inPlay, world, worldId, items ?? {}, templates, testLine ?? ''),
    [step, world, worldId, items, templates, testLine],
  );
  return (
    <InPlayPane
      slice={slice}
      testLine={testLine === null ? undefined : {
        value: testLine,
        onChange: onTestLineEdit,
        samples: { hit: sampleTestLine(world, items ?? {}), miss: sampleMissLine(world, items ?? {}) },
      }}
    />
  );
}
