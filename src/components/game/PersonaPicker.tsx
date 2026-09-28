import { useEffect, useRef } from 'react';
import { MapPin, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { THUMB_FRAME, THUMB_INTRINSIC, thumbFit } from '@/lib/thumbAspect';
import { cn } from '@/lib/utils';
import type { NoneRef } from '@/lib/persona';
import type { PersonaRef } from '@/types';

/** One persona the picker offers. */
export interface PersonaOption {
  id: string;
  name: string;
  image?: string;
  /** The player-facing description, placeholders resolved. */
  description?: string;
  /** The name of the location a world persona names as its start. */
  startsAt?: string;
}

const keyOf = (ref: PersonaRef) => (ref.source === 'none' ? 'none' : `${ref.source}:${ref.entityId}`);

/** The player's entry on a None pick: the entered name and description. */
type PersonaEntry = Omit<NoneRef, 'source'>;

/** A None ref with `entry` written in, each field kept only while it has text. */
const withEntry = (entry: PersonaEntry): PersonaRef => ({
  source: 'none',
  ...(entry.name ? { name: entry.name } : {}),
  ...(entry.description ? { description: entry.description } : {}),
});

const refOf = (key: string, entry: PersonaEntry): PersonaRef => {
  const split = key.indexOf(':');
  const source = key.slice(0, split);
  return source === 'world' || source === 'library' ? { source, entityId: key.slice(split + 1) } : withEntry(entry);
};

const rowClass = (selected: boolean) => cn(
  'flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 transition-colors',
  'focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset',
  selected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/60 hover:bg-muted/40',
);

/** An entity's picture in the 2:3 portrait frame, or a user glyph when it has none. */
export function PersonaPortrait({ image }: { image?: string }) {
  return (
    <span
      data-testid="persona-portrait"
      className={cn('flex w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted', THUMB_FRAME.portrait)}
    >
      {image
        ? <img src={image} alt="" {...THUMB_INTRINSIC.portrait} className={cn('h-full w-full', thumbFit('portrait'))} />
        : <User aria-hidden className="h-6 w-6 text-muted-foreground" />}
    </span>
  );
}

const groupHeading = (label: string) => (
  <h3 className="col-span-full mt-2 text-meta font-medium tracking-wide text-muted-foreground">{label}</h3>
);

/** The persona choice: None when offered, then the world's own personas, then the library personas, each group under its
 *  own heading and each persona with its portrait and name. With a Custom Persona entity, its row stands in None's place
 *  and, once picked, takes the player's name and description; the ref carries both. */
export function PersonaPicker({ world = [], library, none = true, custom, value, onChange }: {
  world?: PersonaOption[];
  library: PersonaOption[];
  /** Offer None. A Cast world does not. */
  none?: boolean;
  /** The Custom Persona entity, which stands in None's place. */
  custom?: PersonaOption;
  value: PersonaRef;
  onChange: (ref: PersonaRef) => void;
}) {
  const current = keyOf(value);
  // The entry the last None pick carried, so a return to the row after another pick finds it again.
  const lastEntry = useRef<PersonaEntry>({});
  useEffect(() => {
    if (value.source === 'none') lastEntry.current = { name: value.name, description: value.description };
  }, [value]);
  const entry = value.source === 'none' ? value : lastEntry.current;
  const row = (key: string, label: string, body: React.ReactNode, below?: React.ReactNode) => (
    <div key={key} className={cn(rowClass(current === key), below && 'flex-wrap')}>
      <RadioGroupItem id={`persona-${key}`} value={key} aria-label={label} className="shrink-0" />
      <label htmlFor={`persona-${key}`} className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
        {body}
      </label>
      {below}
    </div>
  );
  const customRow = (option: PersonaOption) => row('none', option.name, (
    <>
      <PersonaPortrait image={option.image} />
      <span className="min-w-0">
        <strong className="block break-words text-label font-semibold">{option.name}</strong>
        {option.description && (
          <span className="mt-1 line-clamp-3 text-helper text-muted-foreground">{option.description}</span>
        )}
      </span>
    </>
  ), current === 'none' && (
    <div className="grid basis-full gap-3 pt-1" data-testid="persona-entry">
      <div className="grid gap-1.5">
        <Label htmlFor="persona-entry-name">Name</Label>
        <Input
          id="persona-entry-name"
          value={entry.name ?? ''}
          placeholder={option.name}
          onChange={(event) => onChange(withEntry({ ...entry, name: event.target.value }))}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="persona-entry-description">Description</Label>
        <Textarea
          id="persona-entry-description"
          value={entry.description ?? ''}
          placeholder="Add to the description above"
          rows={3}
          onChange={(event) => onChange(withEntry({ ...entry, description: event.target.value }))}
        />
      </div>
    </div>
  ));
  const personaRow = (source: Exclude<PersonaRef['source'], 'none'>) => (option: PersonaOption) =>
    row(`${source}:${option.id}`, option.name, (
      <>
        <PersonaPortrait image={option.image} />
        <span className="min-w-0">
          <strong className="block break-words text-label font-semibold">{option.name}</strong>
          {option.description && (
            <span className="mt-1 line-clamp-3 text-helper text-muted-foreground">{option.description}</span>
          )}
          {option.startsAt && (
            <span className="mt-1 flex items-center gap-1 break-words text-helper text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Starts at {option.startsAt}
            </span>
          )}
        </span>
      </>
    ));
  return (
    <RadioGroup
      aria-label="Persona"
      value={current}
      onValueChange={(key) => onChange(refOf(key, custom ? lastEntry.current : {}))}
      className="grid min-w-0 gap-3 xl:grid-cols-2"
    >
      {none && custom && customRow(custom)}
      {none && !custom && row('none', 'None', (
        <span className="min-w-0">
          <strong className="block text-label font-semibold">None</strong>
          <span className="mt-1 block text-helper text-muted-foreground">Play as the world describes the player</span>
        </span>
      ))}
      {world.length > 0 && groupHeading('From This World')}
      {world.map(personaRow('world'))}
      {library.length > 0 && groupHeading('Your Personas')}
      {library.map(personaRow('library'))}
    </RadioGroup>
  );
}
