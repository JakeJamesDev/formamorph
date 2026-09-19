import { User } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import type { PersonaRef } from '@/types';

/** One persona the picker offers. */
export interface PersonaOption {
  id: string;
  name: string;
  image?: string;
}

const keyOf = (ref: PersonaRef) => (ref.source === 'none' ? 'none' : `${ref.source}:${ref.entityId}`);

const rowClass = (selected: boolean) => cn(
  'flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 transition-colors',
  'focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset',
  selected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/60 hover:bg-muted/40',
);

function Portrait({ option }: { option: PersonaOption }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
      {option.image
        ? <img src={option.image} alt="" className="h-full w-full object-cover" />
        : <User aria-hidden className="h-5 w-5 text-muted-foreground" />}
    </span>
  );
}

/** The persona choice: None, then the library personas, each with its portrait and name. */
export function PersonaPicker({ library, value, onChange }: {
  library: PersonaOption[];
  value: PersonaRef;
  onChange: (ref: PersonaRef) => void;
}) {
  const current = keyOf(value);
  const row = (key: string, label: string, body: React.ReactNode) => (
    <div key={key} className={rowClass(current === key)}>
      <RadioGroupItem id={`persona-${key}`} value={key} aria-label={label} className="shrink-0" />
      <label htmlFor={`persona-${key}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        {body}
      </label>
    </div>
  );
  return (
    <RadioGroup
      value={current}
      onValueChange={(key) => {
        if (key === 'none') onChange({ source: 'none' });
        else onChange({ source: 'library', entityId: key.slice('library:'.length) });
      }}
      className="grid min-w-0 gap-3 xl:grid-cols-2"
    >
      {row('none', 'None', (
        <span className="min-w-0">
          <strong className="block text-label font-semibold">None</strong>
          <span className="mt-1 block text-helper text-muted-foreground">Play as the world describes the player</span>
        </span>
      ))}
      {library.map((option) => row(`library:${option.id}`, option.name, (
        <>
          <Portrait option={option} />
          <strong className="min-w-0 break-words text-label font-semibold">{option.name}</strong>
        </>
      )))}
    </RadioGroup>
  );
}
