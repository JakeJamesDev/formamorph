/**
 * The Opening instrument — the start inspector. What a fresh game as the lens PC actually looks like: every
 * stat settled at its real turn-one value with a slider to scrub the band coverage, the traits and pins that
 * apply, the wildcard rolls with their true odds, and the assembled first prompt.
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
import { Meta } from '@/components/ui/typography';
import { placeholderAccent } from '@/lib/highlightUtils';
import { estimateTokens } from '@/lib/memoryUtils';
import { activeDescriptor, statValueLabel } from '@/lib/statContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OpeningProps } from '@/lib/testBench/benchProps';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import type {
  OpeningData, OpeningPoolRow, OpeningRollGroup, OpeningStat, OpeningTrait,
} from '@/lib/testBench/opening';

const tokenLabel = (tokens: number) => `~${tokens.toLocaleString()}`;

const SectionHeading = ({ label, note }: { label: string; note?: string }) => (
  <div className="flex items-baseline gap-2 pt-1">
    <p className="text-meta font-medium">{label}</p>
    {note && <Meta as="p" className="min-w-0 truncate">{note}</Meta>}
  </div>
);

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/**
 * One stat: the fresh game's number and band on the face of the row, and a slider that scrubs the whole
 * range, live-updating which descriptor the AI would be told. The scrub position is row-local state; the
 * row itself is keyed on the settled numbers, so a world edit or PC change resets it to the real start.
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
          <Meta className="shrink-0">{signed(stat.traitShift)} from traits</Meta>
        )}
        <Meta className="shrink-0">
          Min {stat.min} · Regen {stat.regen === 0 ? 0 : signed(stat.regen)}
        </Meta>
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
          Starts above every descriptor band. The AI is told no status until the value drops.
        </p>
      )}
    </div>
  );
};

/** One owner's stat rows, each keyed on its settled numbers so a world edit resets its slider, and the
 *  stats its traits leave off. */
const StatList = ({ stats, disabled }: { stats: OpeningStat[]; disabled: string[] }) => (
  <>
    {stats.length === 0 ? (
      <Meta as="p">No stat is on at game start</Meta>
    ) : (
      <div className="space-y-1">
        {stats.map((stat) => (
          <StatRow key={`${stat.id}:${stat.value}:${stat.min}:${stat.max}`} stat={stat} />
        ))}
      </div>
    )}
    {disabled.length > 0 && (
      <Meta as="p">Off at game start: {disabled.join(', ')}</Meta>
    )}
  </>
);

/** One trait that applies at game start, with its pins and stat changes under it. */
const TraitRow = ({ trait }: { trait: OpeningTrait }) => (
  <div className="rounded-md border p-1.5">
    <div className="flex items-baseline gap-1.5">
      <span className="min-w-0 flex-grow truncate text-label">{trait.name}</span>
      {trait.isPc && (
        <Meta className="shrink-0 rounded bg-muted px-1">Testing As</Meta>
      )}
    </div>
    {(trait.pins.length > 0 || trait.toggles.length > 0) && (
      <Meta as="p" className="mt-0.5">
        {[
          ...trait.pins.map((pin) => `Pins ${pin.placeholder} to “${pin.value}”`),
          ...trait.toggles.map((toggle) => `${toggle.enabled ? 'Adds' : 'Removes'} ${toggle.stat}`),
        ].join(' · ')}
      </Meta>
    )}
  </div>
);

/** One wildcard's fresh-game draw: what came up, every value's true odds, and the repeat risk. */
const RollRow = ({ group }: { group: OpeningRollGroup }) => (
  <div className="rounded-md border p-1.5">
    <div className="flex items-baseline gap-1.5">
      <span className="min-w-0 flex-grow truncate text-label">{group.name}</span>
      {group.pinnedValue != null ? (
        <Meta className="flex shrink-0 items-center gap-1 rounded bg-muted px-1">
          <Pin className="h-3 w-3" aria-hidden />
          {group.pinnedValue}
        </Meta>
      ) : (
        <span className="shrink-0 truncate text-meta font-medium">
          {[...(group.worldValue != null ? [group.worldValue] : []), ...group.uniqueValues].join(' · ')}
        </span>
      )}
    </div>
    <Meta as="p" className="mt-0.5 truncate">
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
    </Meta>
    {group.collisionChance != null && (
      <p className="text-meta text-warning">
        ~{Math.round(group.collisionChance)}% chance that two unique draws match
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
      <Meta className="shrink-0">
        {tokenLabel(estimateTokens(text.length))} tokens
      </Meta>
    </button>
    {open && (
      <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 text-meta leading-relaxed">
        {text}
      </pre>
    )}
  </div>
);

/** The picker's value for None: a Select item cannot hold an empty value. */
const NO_PERSONA = 'none';

const KIND_LABEL: Record<OpeningPoolRow['kind'], string> = { action: 'Player Action', narration: 'Narration' };

/** One drawable opening: its owner, kind, text and chance. Selecting it shows what it sends on turn one. */
const PoolRow = ({ row, selected, onSelect }: { row: OpeningPoolRow; selected: boolean; onSelect: () => void }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={cn(
      'flex w-full items-baseline gap-1.5 rounded-md border p-1.5 text-left',
      selected ? 'border-primary bg-muted/50' : 'hover:bg-muted/30',
    )}
  >
    <Meta className="shrink-0 rounded bg-muted px-1">
      {row.ownerName ?? row.locationName ?? 'This World'}
    </Meta>
    <Meta className="shrink-0">{row.self ? `${KIND_LABEL[row.kind]} (Self)` : KIND_LABEL[row.kind]}</Meta>
    <span className="min-w-0 flex-grow truncate text-label">{row.text}</span>
    <span className="shrink-0 text-meta font-medium">{Math.round(row.chance)}%</span>
  </button>
);

export interface OpeningInstrumentProps extends OpeningProps {
  data: OpeningData;
}

export function OpeningInstrument({ data, onReroll, onStartChange, onPersonaChange, onOpeningChange }: OpeningInstrumentProps) {
  const [openBlocks, setOpenBlocks] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpenBlocks((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  const narrated = data.opening.kind === 'narration';
  const personaName = data.personas.find((persona) => persona.id === data.personaId)?.name;

  if (!data.location) {
    return (
      <Meta as="p">This world has no locations, so a new game has nowhere to start</Meta>
    );
  }

  return (
    <ScrollArea landingRoom className="h-full">
      <div className="space-y-2 pr-2">
        <div className="rounded-md border bg-muted/30 p-2">
          <p className="text-label font-medium">
            {personaName ? `Turn one as ${personaName}` : 'Turn one with no persona'}
            {narrated ? ', opening on a written page one' : ` ≈ ${tokenLabel(data.totalTokens)} tokens`}
          </p>
          {data.personas.length > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <Select value={data.personaId ?? NO_PERSONA} onValueChange={(id) => onPersonaChange(id === NO_PERSONA ? null : id)}>
                <SelectTrigger className="h-6 w-auto min-w-0 max-w-[50%] px-2 text-meta" aria-label="Persona">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PERSONA}>None</SelectItem>
                  {data.personas.map((persona) => (
                    <SelectItem key={persona.id} value={persona.id}>{persona.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Meta as="p" className="min-w-0 truncate">Picks the persona you play</Meta>
            </div>
          )}
          {data.starts.length > 1 ? (
            <div className="mt-1 flex items-center gap-2">
              <Select value={data.location.id} onValueChange={onStartChange}>
                <SelectTrigger className="h-6 w-auto min-w-0 max-w-[50%] px-2 text-meta" aria-label="Starting Location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.starts.map((start) => (
                    <SelectItem key={start.id} value={start.id}>{start.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Meta as="p" className="min-w-0 truncate">
                One of {data.startPool} starting locations, picked at random in a new game
              </Meta>
            </div>
          ) : (
            <Meta as="p">Starts at {data.locationName}</Meta>
          )}
        </div>

        <SectionHeading label="Opening Pool" note={`what a new game at ${data.locationName} draws from`} />
        {data.pool.length === 0 ? (
          <Meta as="p">
            {data.openingsEnabled
              ? 'No opening here can be drawn, so the game starts with the default opening'
              : '“Openings” is off, so the game starts with the default opening'}
          </Meta>
        ) : (
          <div className="space-y-1">
            {data.pool.map((row) => (
              <PoolRow
                key={row.key}
                row={row}
                selected={row.key === data.selectedKey}
                onSelect={() => onOpeningChange(row.key)}
              />
            ))}
          </div>
        )}

        <SectionHeading
          label="Stats at Game Start"
          note="drag a slider to test the bands without editing the world"
        />
        <StatList stats={data.stats} disabled={data.disabledStats} />
        {data.entityStats.map((entity) => (
          <div key={entity.id} className="space-y-1">
            <SectionHeading label={entity.name} note="its own stats at game start" />
            <StatList stats={entity.stats} disabled={entity.disabledStats} />
          </div>
        ))}

        <SectionHeading label="Active Traits" note={data.pcName ? 'the defaults and the “Testing as” pick' : 'the defaults'} />
        {data.traits.length === 0 ? (
          <Meta as="p">No traits are active at game start</Meta>
        ) : (
          <div className="space-y-1">
            {data.traits.map((trait) => <TraitRow key={trait.id} trait={trait} />)}
          </div>
        )}

        {/* The row stays when no roll is open to a reroll, so it is the landing for the Reroll button. */}
        <div className="flex items-baseline gap-2 pt-1" {...targetAttribute('worldEditorBench.opening', 'placeholder-rolls')}>
          <p className="text-meta font-medium">Placeholder Rolls</p>
          <Meta as="p" className="min-w-0 flex-grow truncate">
            what this new game drew
          </Meta>
          {data.rolls.some((group) => group.pinnedValue == null) && (
            <Button variant="outline" size="sm" className="h-6 shrink-0 px-2 text-meta" onClick={onReroll}>
              <Dices className="mr-1 h-3 w-3" aria-hidden />
              Reroll
            </Button>
          )}
        </div>
        {data.rolls.length === 0 ? (
          <Meta as="p">This world has no Wildcard chips, so nothing rolls</Meta>
        ) : (
          <div className="space-y-1">
            {data.rolls.map((group) => <RollRow key={group.placeholderId} group={group} />)}
          </div>
        )}

        {narrated ? (
          <>
            <SectionHeading label="Page One" note="shown as written" />
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 text-meta leading-relaxed">
              {data.opening.text}
            </pre>
            <Meta as="p">The Opening Narration is page one, so turn one sends no narration request</Meta>
          </>
        ) : (
          <>
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
            <Meta as="p" className="flex items-start gap-1 leading-snug">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              Built from the default prompts and settings. Custom prompt presets aren’t read here.
            </Meta>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
// scroll-guard: allow migration-candidate: the preview blocks have a max height only; a definite height is not confirmed
