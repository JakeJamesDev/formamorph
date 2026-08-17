/**
 * The Triggers instrument — the Activation Tester. Prose in one box, and everything the harness makes of
 * it below: who it detects as present, and every dictionary entry's verdict with the evidence or the
 * near-miss reason behind it.
 *
 * Presentational: the report arrives as a prop, so the panel renders the same inside the desktop split and
 * the mobile sheet. The only state it owns is which row the author is looking at.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  describeNearMiss, describeRegion, REASON_LABEL,
  type TriggerEntry, type TriggerMark, type TriggerReport,
} from '@/lib/testBench/triggers';
import type { EntityMatch } from '@/lib/entityMatch';

/** Which row the author is on — the same key a highlight in the text carries. */
type RowKey = string;
const rowKey = (kind: 'entity' | 'entry', id: string): RowKey => `${kind}:${id}`;
const markKey = (mark: TriggerMark): RowKey => rowKey(mark.kind, mark.id);

/** How an entity earned its detection, as its badge reads. */
const VIA_LABEL: Record<EntityMatch['via'], string> = {
  name: 'Name',
  partial: 'Part of Name',
  alias: 'Alias',
};

const Badge = ({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'active' }) => (
  <span
    className={cn(
      'shrink-0 rounded px-1 text-meta',
      tone === 'active' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground',
    )}
  >
    {children}
  </span>
);

const SectionHeading = ({ label, note }: { label: string; note?: string }) => (
  <div className="flex items-baseline gap-2 pt-1">
    <p className="text-meta font-medium">{label}</p>
    {note && <p className="min-w-0 truncate text-meta text-muted-foreground">{note}</p>}
  </div>
);

/**
 * The pasted text with every claimed run marked. A run belonging to more than one row cycles through them
 * on repeated clicks, so an entity and an entry sharing words are both reachable from the same words.
 */
const HighlightedText = ({ segments, selected, onSelect }: {
  segments: TriggerReport['segments'];
  selected: RowKey | null;
  onSelect: (key: RowKey) => void;
}) => (
  <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 text-meta leading-relaxed">
    {segments.map((segment, i) => {
      if (segment.marks.length === 0) return <span key={i}>{segment.text}</span>;
      const at = segment.marks.findIndex((m) => markKey(m) === selected);
      const next = segment.marks[(at + 1) % segment.marks.length];
      const isSelected = at >= 0;
      const entity = segment.marks.some((m) => m.kind === 'entity');
      return (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(markKey(next))}
          title={segment.marks.map((m) => m.label).join(' · ')}
          className={cn(
            'rounded-sm underline decoration-dotted underline-offset-2 hover:bg-accent',
            entity ? 'bg-primary/15 text-foreground' : 'bg-warning/15 text-foreground',
            isSelected && 'ring-1 ring-ring',
          )}
        >
          {segment.text}
        </button>
      );
    })}
  </div>
);

/** One detected entity: which written form put it on the page, and the text that did it. */
const EntityRow = ({ match, selected, register }: {
  match: EntityMatch;
  selected: boolean;
  register: (key: RowKey, el: HTMLDivElement | null) => void;
}) => (
  <div
    ref={(el) => register(rowKey('entity', match.entityId), el)}
    className={cn('rounded-md border p-1.5', selected && 'ring-1 ring-ring')}
  >
    <div className="flex items-center gap-1.5">
      <p className="min-w-0 flex-grow truncate text-label">{match.name}</p>
      <Badge>{VIA_LABEL[match.via]}</Badge>
    </div>
    <p className="mt-0.5 truncate text-meta text-muted-foreground">
      Matched “{match.matched}” as “{match.spans[0].text}”
      {match.spans.length > 1 && ` · ${match.spans.length} times`}
    </p>
  </div>
);

/** One dictionary entry's verdict: the evidence when it fired, the reason it didn't when it didn't. */
const EntryRow = ({ entry, selected, register }: {
  entry: TriggerEntry;
  selected: boolean;
  register: (key: RowKey, el: HTMLDivElement | null) => void;
}) => {
  const hit = entry.hits[0];
  return (
    <div
      ref={(el) => register(rowKey('entry', entry.entryId), el)}
      className={cn(
        'rounded-md border p-1.5',
        entry.fired ? 'border-solid' : 'border-dashed',
        !entry.fired && 'opacity-80',
        selected && 'ring-1 ring-ring',
      )}
    >
      <div className="flex items-center gap-1.5">
        <p className={cn('min-w-0 flex-grow truncate text-label', !entry.fired && 'text-muted-foreground')}>
          {entry.name}
        </p>
        {entry.fired && <Badge tone="active">{REASON_LABEL[entry.reason]}</Badge>}
      </div>
      {entry.fired ? (
        <p className="mt-0.5 truncate text-meta text-muted-foreground">
          {hit
            ? `“${hit.keyword}” as “${hit.matchedText}” · ${describeRegion(hit.region)}`
            : 'Injected on every turn'}
        </p>
      ) : (
        <p className="mt-0.5 text-meta leading-snug text-muted-foreground">{describeNearMiss(entry)}</p>
      )}
      {entry.badPatterns.length > 0 && entry.nearMiss !== 'invalid-regex' && (
        <p className="mt-0.5 flex items-start gap-1 text-meta leading-snug text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Invalid regex: “{entry.badPatterns.join('”, “')}”
        </p>
      )}
    </div>
  );
};

export interface TriggersInstrumentProps {
  text: string;
  onTextChange: (text: string) => void;
  report: TriggerReport;
}

export function TriggersInstrument({ text, onTextChange, report }: TriggersInstrumentProps) {
  const [selected, setSelected] = useState<RowKey | null>(null);
  const rows = useRef(new Map<RowKey, HTMLDivElement>());
  const register = useCallback((key: RowKey, el: HTMLDivElement | null) => {
    if (el) rows.current.set(key, el);
    else rows.current.delete(key);
  }, []);
  // Picking a highlight is a way into the list: the row it belongs to is brought into view, never animated —
  // the panel is short and the author is mid-read.
  useEffect(() => {
    if (selected) rows.current.get(selected)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const empty = text.trim().length === 0;
  // The books in the order their entries arrive, each represented by its first entry — the report carries a
  // book's name and state on every row it owns, so there is nothing else to look them up in.
  const books = [...new Map(report.entries.map((e) => [e.bookId, e])).values()];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Textarea
        size="sm"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Paste scene text to see what it makes fire…"
        aria-label="Scene text"
        className="min-h-[64px] shrink-0 resize-none"
        rows={3}
      />
      <ScrollArea className="min-h-0 flex-grow">
        <div className="space-y-2 pr-2">
          {!empty && report.segments.length > 0 && (
            <HighlightedText segments={report.segments} selected={selected} onSelect={setSelected} />
          )}

          <SectionHeading
            label="Entities Present"
            note={empty ? undefined : `${report.entities.length} detected`}
          />
          {empty ? (
            <p className="text-meta text-muted-foreground">Paste text above to see who the harness detects.</p>
          ) : report.entities.length === 0 ? (
            <p className="text-meta text-muted-foreground">
              No entity is named in this text — nothing here puts one in the side panel.
            </p>
          ) : (
            <div className="space-y-1">
              {report.entities.map((match) => (
                <EntityRow
                  key={match.entityId}
                  match={match}
                  selected={selected === rowKey('entity', match.entityId)}
                  register={register}
                />
              ))}
            </div>
          )}

          <SectionHeading
            label="Dictionary"
            note={report.checked === 0 ? undefined : `${report.fired} of ${report.checked} fired`}
          />
          {report.checked === 0 ? (
            <p className="text-meta text-muted-foreground">This world has no dictionary entries.</p>
          ) : (
            <>
              {empty && (
                <p className="text-meta text-muted-foreground">
                  {report.constant > 0
                    ? `${report.constant} constant ${report.constant === 1 ? 'entry injects' : 'entries inject'} on every turn, whatever the text says. The rest wait on their keywords.`
                    : 'No entry is constant, so nothing injects until text mentions a keyword.'}
                </p>
              )}
              {!empty && report.fired === 0 && (
                <p className="text-meta text-muted-foreground">
                  Nothing fired. {report.checked} {report.checked === 1 ? 'entry was' : 'entries were'} checked — each
                  says below why it stayed out.
                </p>
              )}
              <div className="space-y-2">
                {books.map((first) => {
                  const inBook = report.entries.filter(
                    (e) => e.bookId === first.bookId && (!empty || e.fired),
                  );
                  if (inBook.length === 0) return null;
                  return (
                    <div key={first.bookId} className="space-y-1">
                      <p className="truncate text-meta text-muted-foreground">
                        {first.bookName}
                        {!first.bookEnabled && ' · off'}
                      </p>
                      {inBook.map((entry) => (
                        <EntryRow
                          key={entry.entryId}
                          entry={entry}
                          selected={selected === rowKey('entry', entry.entryId)}
                          register={register}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
      {!empty && (
        <p className="flex shrink-0 items-center gap-1 text-meta text-muted-foreground">
          <Users className="h-3 w-3 shrink-0" aria-hidden />
          Presence reads prose, not dialogue — a name only inside quotes was mentioned, not present.
        </p>
      )}
    </div>
  );
}
