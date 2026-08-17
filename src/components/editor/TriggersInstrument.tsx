/**
 * The Triggers instrument — the Activation Tester. Prose in one box, and everything the harness makes of
 * it below: who it detects as present, every dictionary entry's verdict with the evidence or the near-miss
 * reason behind it, the block that would actually be injected, and the matching warnings the rule engine
 * raises about the rows on screen.
 *
 * Presentational: the report and the warnings arrive as props, so the panel renders the same inside the
 * desktop split and the mobile sheet. The only state it owns is which row the author is looking at and
 * which of the two foldaway sections is open.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ClipboardPaste, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { isRuleFixable, type Finding } from '@/lib/testBench/rules';
import {
  describeHitOrigin, describeNearMiss, messageCount, otherHistoryHits, HISTORY_SEPARATOR, REASON_LABEL,
  type RenderedBlock, type TriggerEntry, type TriggerMark, type TriggerReport,
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

/** Which of the prompt's two lorebook blocks a rendered block is, as the prompt itself names them. */
const BLOCK_LABEL: Record<RenderedBlock['position'], string> = {
  before: 'Background Lore',
  after: 'Foreground Lore',
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

/** A foldaway section: its heading always states what is inside, so the fold costs no information.
 *  Deliberately not `CollapsibleSection` — that one is sized for editor forms (a `text-label` title and a
 *  `sm` Button around its chevron), and two of them would cost this panel more height than its content. */
const Foldaway = ({ label, note, open, onToggle, children }: {
  label: string;
  note?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-1 text-meta text-muted-foreground hover:text-foreground"
    >
      {open
        ? <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
        : <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
      <span className="font-medium text-foreground">{label}</span>
      {note && <span className="min-w-0 truncate">{note}</span>}
    </button>
    {open && <div className="mt-1">{children}</div>}
  </div>
);

/**
 * The matching warnings about one row, raised by the rule engine Issues runs — so the sentence here is the
 * Issues sentence, and Fix is the Issues fix, which repairs every instance of that rule in the world.
 */
const RowWarnings = ({ findings, onFix }: { findings: Finding[]; onFix: (ruleId: string) => void }) => (
  <>
    {findings.map((finding, i) => (
      <div key={`${finding.ruleId}:${i}`} className="mt-1 flex items-start gap-1 text-meta leading-snug text-warning">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span className="min-w-0 flex-grow">{finding.message}</span>
        {isRuleFixable(finding.ruleId) && (
          <button
            type="button"
            onClick={() => onFix(finding.ruleId)}
            className="shrink-0 rounded border border-warning/40 px-1 hover:bg-accent hover:text-foreground"
            title="Applies this rule’s repair wherever it fires"
          >
            Fix
          </button>
        )}
      </div>
    ))}
  </>
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

/** The lore this run would inject, verbatim — the block the model receives, with what it costs. */
const RenderedContext = ({ blocks, tokens }: { blocks: RenderedBlock[]; tokens: number }) => {
  if (blocks.length === 0) {
    // The prompt's lore section still exists — it simply comes through with nothing in it.
    return <p className="text-meta text-muted-foreground">Nothing fired, so no entry’s text is injected.</p>;
  }
  return (
    <div className="space-y-1">
      {blocks.map((block) => (
        <div key={block.position}>
          <p className="text-meta text-muted-foreground">
            {BLOCK_LABEL[block.position]} · {block.entryCount} {block.entryCount === 1 ? 'entry' : 'entries'} ·
            {' '}~{block.tokens} tokens
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 text-meta leading-relaxed">
            {block.text}
          </pre>
        </div>
      ))}
      {blocks.length > 1 && (
        <p className="text-meta text-muted-foreground">Both blocks · ~{tokens} tokens in total</p>
      )}
    </div>
  );
};

/** One detected entity: which written form put it on the page, and the text that did it. */
const EntityRow = ({ match, selected, warnings, onFix, register }: {
  match: EntityMatch;
  selected: boolean;
  warnings: Finding[];
  onFix: (ruleId: string) => void;
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
    <RowWarnings findings={warnings} onFix={onFix} />
  </div>
);

/** One dictionary entry's verdict: the evidence when it fired, the reason it didn't when it didn't. */
const EntryRow = ({ entry, selected, historyCount, warnings, onFix, register }: {
  entry: TriggerEntry;
  selected: boolean;
  /** How many history messages were traced — what a hit's distance is measured back from. */
  historyCount: number;
  warnings: Finding[];
  onFix: (ruleId: string) => void;
  register: (key: RowKey, el: HTMLDivElement | null) => void;
}) => {
  const hit = entry.hits[0];
  // A line each for the further messages a hit came out of: a history hit is the one an author cannot place
  // without being told how far back it was and what window the entry reads.
  const fromHistory = otherHistoryHits(entry);
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
            ? `“${hit.keyword}” as “${hit.matchedText}” · ${describeHitOrigin(entry, hit, historyCount)}`
            : 'Injected on every turn'}
        </p>
      ) : (
        <p className="mt-0.5 text-meta leading-snug text-muted-foreground">{describeNearMiss(entry)}</p>
      )}
      {fromHistory.map((h) => (
        <p key={h.region} className="mt-0.5 truncate text-meta text-muted-foreground">
          Also “{h.matchedText}” · {describeHitOrigin(entry, h, historyCount)}
        </p>
      ))}
      {entry.badPatterns.length > 0 && entry.nearMiss !== 'invalid-regex' && (
        <p className="mt-0.5 flex items-start gap-1 text-meta leading-snug text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Invalid regex: “{entry.badPatterns.join('”, “')}”
        </p>
      )}
      <RowWarnings findings={warnings} onFix={onFix} />
    </div>
  );
};

export interface TriggersInstrumentProps {
  text: string;
  onTextChange: (text: string) => void;
  /** The messages behind the scene, blank-line separated, oldest first — what scan depth is measured over. */
  history: string;
  onHistoryChange: (text: string) => void;
  report: TriggerReport;
  /** The matching-related findings of the same rule pass the Issues tab lists. */
  warnings: Finding[];
  /** Apply one rule's repair — the editor's write-through, identical to the Issues row's Fix. */
  onFixRule: (ruleId: string) => void;
  /** Fill both boxes from the world's most recent save. Absent when the world has never been played. */
  onPasteLastTurn?: () => void;
}

export function TriggersInstrument({
  text, onTextChange, history, onHistoryChange, report, warnings, onFixRule, onPasteLastTurn,
}: TriggersInstrumentProps) {
  const [selected, setSelected] = useState<RowKey | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renderedOpen, setRenderedOpen] = useState(false);
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
  // One bucket per item a warning names, so a row carries the findings about it and a rule naming two
  // entities appears on both.
  const warningsFor = new Map<string, Finding[]>();
  for (const finding of warnings) {
    for (const item of finding.items) {
      const bucket = warningsFor.get(item.id);
      if (bucket) bucket.push(finding);
      else warningsFor.set(item.id, [finding]);
    }
  }
  const about = (id: string) => warningsFor.get(id) ?? [];
  // The books in the order their entries arrive, each represented by its first entry — the report carries a
  // book's name and state on every row it owns, so there is nothing else to look them up in.
  const books = [...new Map(report.entries.map((e) => [e.bookId, e])).values()];
  // The warnings no row below can carry — and the ones that matter most: an articled alias is exactly why
  // its entity went undetected, so attaching it only to a row the entity failed to earn would hide it.
  const listed = new Set([
    ...(empty ? [] : report.entities.map((e) => e.entityId)),
    ...report.entries.filter((e) => !empty || e.fired).map((e) => e.entryId),
  ]);
  const unlisted = warnings.filter((finding) => finding.items.every((item) => !listed.has(item.id)));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {onPasteLastTurn && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 shrink-0 self-start px-2 text-meta"
          onClick={onPasteLastTurn}
        >
          <ClipboardPaste className="mr-1 h-3 w-3" aria-hidden />
          Paste Last Turn
        </Button>
      )}
      <Textarea
        size="sm"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Paste scene text to see what it makes fire…"
        aria-label="Scene text"
        className="min-h-[64px] shrink-0 resize-none"
        rows={3}
      />
      <div className="shrink-0">
        <Foldaway
          label="History"
          note={report.historyCount === 0
            ? '· none, so scan depth changes nothing'
            : `· ${messageCount(report.historyCount)}`}
          open={historyOpen}
          onToggle={() => setHistoryOpen((v) => !v)}
        >
          <Textarea
            size="sm"
            value={history}
            onChange={(e) => onHistoryChange(e.target.value)}
            placeholder={`Earlier messages, oldest first, one per block separated by a ${HISTORY_SEPARATOR} line…`}
            aria-label="History messages"
            className="min-h-[64px] resize-none"
            rows={3}
          />
        </Foldaway>
      </div>
      <ScrollArea className="min-h-0 flex-grow">
        <div className="space-y-2 pr-2">
          {!empty && report.segments.length > 0 && (
            <HighlightedText segments={report.segments} selected={selected} onSelect={setSelected} />
          )}

          <Foldaway
            label="Rendered Context"
            note={`· ~${report.renderedTokens} tokens`}
            open={renderedOpen}
            onToggle={() => setRenderedOpen((v) => !v)}
          >
            <RenderedContext blocks={report.rendered} tokens={report.renderedTokens} />
          </Foldaway>

          {unlisted.length > 0 && (
            <div className="rounded-md border border-dashed p-1.5">
              <p className="text-meta font-medium">Nothing below can show these</p>
              <RowWarnings findings={unlisted} onFix={onFixRule} />
            </div>
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
                  warnings={about(match.entityId)}
                  onFix={onFixRule}
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
                          historyCount={report.historyCount}
                          warnings={about(entry.entryId)}
                          onFix={onFixRule}
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
