import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { hintsLinked, withHint, withLink, withUnlink } from '@/lib/connectionEditing';
import type { Connection, LegKey } from '@/types';

/** One hint box: the leg it edits, its visible label, and its accessible name. */
export interface TravelHintLeg {
  key: LegKey;
  label: ReactNode;
  name: string;
}

/** A request to focus one leg's box. A new `nonce` refocuses the same leg. */
export interface TravelHintFocus {
  leg: LegKey;
  nonce: number;
}

/**
 * The link state one Connection holds while this component is mounted. `basis` is the record the state
 * belongs to: a record that arrives from anywhere else, such as an undo, is read again from its data.
 * `held` is the second box's text from before the last link.
 */
interface LinkRecord {
  linked: boolean;
  basis: Connection;
  held?: string;
}

const COPIES = 'Copies the first Travel Hint';

/**
 * A Connection's Travel Hint boxes, first leg on top, with a vertical link toggle beside a two-way pair.
 * Linked, the first box writes both legs and the second box shows its text read-only.
 */
export function TravelHintPair({ connection, legs, idPrefix, onChange, focus }: {
  connection: Connection;
  /** The legs the record has, in display order. The first is the one a link copies from. */
  legs: TravelHintLeg[];
  idPrefix: string;
  /** Receives every rewritten record. The merge key groups one box's keystrokes into one edit. */
  onChange: (next: Connection, mergeKey?: string) => void;
  focus?: TravelHintFocus | null;
}) {
  const [records, setRecords] = useState<Record<string, LinkRecord>>({});
  const boxes = useRef<Partial<Record<LegKey, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (focus) boxes.current[focus.leg]?.focus();
  }, [focus]);

  const [first, second] = legs;
  const record = records[connection.id];
  const linked = !!second && (record?.basis === connection ? record.linked : hintsLinked(connection));
  const firstHint = connection[first.key]?.hint ?? '';

  const write = (next: Connection, state: Omit<LinkRecord, 'basis'>, mergeKey?: string) => {
    setRecords((current) => ({ ...current, [next.id]: { ...state, basis: next } }));
    onChange(next, mergeKey);
  };

  const editHint = (leg: LegKey, text: string) => {
    const edited = withHint(connection, leg, text);
    const next = linked ? withLink(edited, first.key) : edited;
    write(next, { linked, held: record?.held }, `hint:${connection.id}:${leg}`);
  };

  const toggle = () => {
    if (!second) return;
    if (linked) {
      const text = record?.held ?? connection[second.key]?.hint ?? '';
      write(withUnlink(connection, first.key, text), { linked: false });
    } else {
      write(withLink(connection, first.key), { linked: true, held: connection[second.key]?.hint ?? '' });
    }
  };

  const describedBy = `${idPrefix}-copies`;
  return (
    <div className="flex gap-1">
      <div className="min-w-0 flex-1 space-y-2">
        {legs.map(({ key, label, name }) => {
          const id = `${idPrefix}-${key}`;
          const copy = linked && key === second?.key;
          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={id} className="flex items-center gap-1">{label}</Label>
              <Input
                id={id}
                ref={(node) => { boxes.current[key] = node; }}
                value={copy ? firstHint : connection[key]?.hint ?? ''}
                readOnly={copy}
                aria-describedby={copy ? describedBy : undefined}
                className={cn(copy && 'bg-muted text-muted-foreground')}
                onChange={(e) => editHint(key, e.target.value)}
                placeholder="Travel Hint, e.g. through the shimmering portal"
                aria-label={name}
              />
            </div>
          );
        })}
        {linked && <span id={describedBy} className="sr-only">{COPIES}</span>}
      </div>
      {second && (
        <Tip tip={linked ? 'Unlink Travel Hints' : 'Link Travel Hints'}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Link Travel Hints"
            aria-pressed={linked}
            className={cn('h-auto w-7 shrink-0 self-stretch', linked ? 'text-primary' : 'text-muted-foreground')}
            onClick={toggle}
          >
            {linked
              ? <Link className="h-4 w-4 -rotate-45" aria-hidden="true" />
              : <Unlink className="h-4 w-4 -rotate-45" aria-hidden="true" />}
          </Button>
        </Tip>
      )}
    </div>
  );
}
