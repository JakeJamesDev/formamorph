/**
 * The Opening instrument — the start inspector. What a fresh game as the lens PC actually looks like: every
 * stat settled at its real turn-one value with a slider to scrub the band coverage, the traits and pins in
 * force, the wildcard rolls with their true odds, and the assembled first prompt.
 *
 * Presentational: the view-model arrives as a prop and the reroll is a callback the editor fulfills. The
 * sliders own their scrub position locally — scrubbing is a test, never an edit, so no value here ever
 * reaches the world.
 */
import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Dices, Pin, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { placeholderAccent } from '@/lib/chipVocabulary';
import { estimateTokens } from '@/lib/memoryUtils';
import { activeDescriptor, statValueLabel } from '@/lib/statContext';
import type { OpeningData, OpeningRollGroup, OpeningStat, OpeningTrait } from '@/lib/testBench/opening';

const tokenLabel = (tokens: number) => `~${tokens.toLocaleString()}`;

const SectionHeading = ({ label, note }: { label: string; note?: string }) => (
  <div className="flex items-baseline gap-2 pt-1">
    <p className="text-meta font-medium">{label}</p>
    {note && <p className="min-w-0 truncate text-meta text-muted-foreground">{note}</p>}
  </div>
);

/**
 * One stat: the fresh game's number and band on the face of the row, and a slider that scrubs the whole
 * range, live-updating which descriptor the AI would be told. The scrub position is row-local state; the
 * row itself is keyed on the settled numbers, so a world edit or PC change snaps it back to the real start.
 */
const StatRow = ({ stat }: { stat: OpeningStat }) => {
  const [value, setValue] = useState(stat.value);
  const scrubbed = value !== stat.value;
  const band = activeDescriptor(stat, value);
  const gap = stat.descriptors.length > 0 && !band;
  return (
    <div className="rounded-md border p-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="min-w-0 flex-grow truncate text-label">{stat.name}</span>
        {stat.traitShift !== 0 && (
          <span className="shrink-0 text-meta text-muted-foreground">
            {stat.traitShift > 0 ? `+${stat.traitShift}` : stat.traitShift} from traits
          </span>
        )}
        <span className={cn('shrink-0 text-meta', scrubbed ? 'text-muted-foreground' : 'font-medium')}>
          {statValueLabel(stat, value)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Slider
          value={[value]}
          min={stat.min}
          max={stat.max}
          step={1}
          onValueChange={([next]) => setValue(next)}
          aria-label={`Scrub ${stat.name}`}
          className="min-w-0 flex-grow"
        />
        <span
          className={cn(
            'w-24 shrink-0 truncate text-right text-meta',
            gap ? 'text-warning' : 'text-muted-foreground',
          )}
        >
          {band ? band.description : stat.descriptors.length > 0 ? 'no status' : '—'}
        </span>
      </div>
      {stat.uncovered && (
        <p className="mt-0.5 flex items-start gap-1 text-meta text-warning">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          Starts above every descriptor band — the AI is told no status until the value drops.
        </p>
      )}
    </div>
  );
};

/** One trait in force at game start, with everything it imposes under it. */
const TraitRow = ({ trait }: { trait: OpeningTrait }) => (
  <div className="rounded-md border p-1.5">
    <div className="flex items-baseline gap-1.5">
      <span className="min-w-0 flex-grow truncate text-label">{trait.name}</span>
      {trait.isPc && (
        <span className="shrink-0 rounded bg-muted px-1 text-meta text-muted-foreground">Lens PC</span>
      )}
    </div>
    {(trait.pins.length > 0 || trait.toggles.length > 0) && (
      <p className="mt-0.5 text-meta text-muted-foreground">
        {[
          ...trait.pins.map((pin) => `Pins ${pin.placeholder} to “${pin.value}”`),
          ...trait.toggles.map((toggle) => `${toggle.enabled ? 'Adds' : 'Removes'} ${toggle.stat}`),
        ].join(' · ')}
      </p>
    )}
  </div>
);

/** One wildcard's fresh-game draw: what came up, every value's true odds, and the repeat risk. */
const RollRow = ({ group }: { group: OpeningRollGroup }) => (
  <div className="rounded-md border p-1.5">
    <div className="flex items-baseline gap-1.5">
      <span className="min-w-0 flex-grow truncate text-label">{group.name}</span>
      {group.pinnedValue != null ? (
        <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-1 text-meta text-muted-foreground">
          <Pin className="h-3 w-3" aria-hidden />
          {group.pinnedValue}
        </span>
      ) : (
        <span className="shrink-0 truncate text-meta font-medium">
          {[...(group.worldValue != null ? [group.worldValue] : []), ...group.uniqueValues].join(' · ')}
        </span>
      )}
    </div>
    <p className="mt-0.5 truncate text-meta text-muted-foreground">
      {group.chances.map((c, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {/* An option that is another placeholder wears that placeholder's accent, as its chip does. */}
          {c.reference ? (
            <span
              className="rounded px-1 font-medium"
              style={{ backgroundColor: placeholderAccent(c.reference), color: '#000' }}
            >
              {c.value}
            </span>
          ) : c.value}
          {` ${Math.round(c.chance)}%`}
        </span>
      ))}
      {group.uniqueValues.length > 1 && ` · ${group.uniqueValues.length} unique draws`}
    </p>
    {group.collisionChance != null && (
      <p className="text-meta text-warning">
        ~{Math.round(group.collisionChance)}% chance two of its unique draws match.
      </p>
    )}
  </div>
);

/** One half of the first prompt, its text a click away — the AI Context block idiom. */
const PromptBlock = ({ label, text, open, onToggle }: {
  label: string;
  text: string;
  open: boolean;
  onToggle: () => void;
}) => (
  <div className="rounded-md border p-1.5">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-1.5 text-left"
    >
      {open
        ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />}
      <span className="min-w-0 flex-grow truncate text-label">{label}</span>
      <span className="shrink-0 text-meta text-muted-foreground">
        {tokenLabel(estimateTokens(text.length))} tokens
      </span>
    </button>
    {open && (
      <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 text-meta leading-relaxed">
        {text}
      </pre>
    )}
  </div>
);

export interface OpeningInstrumentProps {
  data: OpeningData;
  /** Draw fresh values for every unpinned placeholder. */
  onReroll: () => void;
}

export function OpeningInstrument({ data, onReroll }: OpeningInstrumentProps) {
  const [openBlocks, setOpenBlocks] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpenBlocks((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  if (!data.location) {
    return (
      <p className="text-meta text-muted-foreground">
        This world has no locations yet, so a fresh game has nowhere to start.
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 pr-2">
        <div className="rounded-md border bg-muted/30 p-2">
          <p className="text-label font-medium">
            Turn one as {data.pcName ?? 'the default character'} ≈ {tokenLabel(data.totalTokens)} tokens
          </p>
          <p className="text-meta text-muted-foreground">
            Starts at {data.locationName}
            {data.startPool > 1 && ` — one of ${data.startPool} possible starts, picked at random in play`}.
          </p>
        </div>

        <SectionHeading
          label="Stats at Game Start"
          note="scrub to test the bands — it never edits the world"
        />
        {data.stats.length === 0 ? (
          <p className="text-meta text-muted-foreground">No stats are live at game start.</p>
        ) : (
          <div className="space-y-1">
            {data.stats.map((stat) => (
              <StatRow key={`${stat.id}:${stat.value}:${stat.min}:${stat.max}`} stat={stat} />
            ))}
          </div>
        )}
        {data.disabledStats.length > 0 && (
          <p className="text-meta text-muted-foreground">
            Off at game start: {data.disabledStats.join(', ')}.
          </p>
        )}

        <SectionHeading label="Active Traits" note={data.pcName ? 'defaults plus the lens PC' : 'the defaults'} />
        {data.traits.length === 0 ? (
          <p className="text-meta text-muted-foreground">No traits are active at game start.</p>
        ) : (
          <div className="space-y-1">
            {data.traits.map((trait) => <TraitRow key={trait.id} trait={trait} />)}
          </div>
        )}

        <div className="flex items-baseline gap-2 pt-1">
          <p className="text-meta font-medium">Placeholder Rolls</p>
          <p className="min-w-0 flex-grow truncate text-meta text-muted-foreground">
            what this fresh game drew
          </p>
          {data.rolls.some((group) => group.pinnedValue == null) && (
            <Button variant="outline" size="sm" className="h-6 shrink-0 px-2 text-meta" onClick={onReroll}>
              <Dices className="mr-1 h-3 w-3" aria-hidden />
              Reroll
            </Button>
          )}
        </div>
        {data.rolls.length === 0 ? (
          <p className="text-meta text-muted-foreground">Nothing rolls here — no Wildcard chips in this world.</p>
        ) : (
          <div className="space-y-1">
            {data.rolls.map((group) => <RollRow key={group.placeholderId} group={group} />)}
          </div>
        )}

        <SectionHeading label="First Prompt" note="what the model receives on turn one" />
        <div className="space-y-1">
          <PromptBlock
            label="System Prompt"
            text={data.system}
            open={openBlocks.has('system')}
            onToggle={() => toggle('system')}
          />
          <PromptBlock
            label="Opening User Turn"
            text={data.user}
            open={openBlocks.has('user')}
            onToggle={() => toggle('user')}
          />
        </div>
        <p className="flex items-start gap-1 text-meta leading-snug text-muted-foreground">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Assembled with the shipped default prompts and settings — custom prompt presets are a global
          setting the editor can’t read.
        </p>
      </div>
    </ScrollArea>
  );
}
