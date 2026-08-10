import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CaseSensitive, ChevronDown, ChevronRight, ChevronUp, Crosshair, Plus, Replace, ReplaceAll, Type, WholeWord, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useIsMobile';
import { WORLD_EDITOR_TABS } from '@/views/worldEditorTabs';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { randomUUID } from '@/lib/uuid';
import { findMatches, replaceAll, spliceText } from '@/lib/worldSearch';
import type { SearchMatch, SearchTarget } from '@/lib/worldSearch';
import type { Placeholder } from '@/types';

/**
 * The World Editor's find & replace bar — a floating strip over the editor content, opened from the header
 * magnifier or Ctrl+F (Ctrl+H opens it with the replace row already showing).
 *
 * Replacement has two modes. Text splices a string; Placeholder splices a freshly minted chip token, and
 * skips fields that don't render chips rather than leaving a raw token showing as literal text.
 */

interface EditorFindBarProps {
  targets: SearchTarget[];
  placeholders: Placeholder[];
  /** Placeholder-replace mode follows the Placeholders tab in hiding from Simple mode. */
  allowPlaceholderReplace: boolean;
  /** Open with the replace row expanded (Ctrl+H). */
  startWithReplace: boolean;
  /** Called with the hit to reveal, or `null` when there is none left to show. */
  onNavigate: (match: SearchMatch | null) => void;
  onAddPlaceholder: (placeholder: Placeholder) => void;
  onClose: () => void;
}

/**
 * An editbox with its own controls parked along its right edge, sharing the field's frame — the image-URL
 * widget's arrangement. The field draws no focus ring of its own; the overlay below paints one across the
 * whole widget, so it reads as one control rather than stopping at a divider.
 */
function FieldWithTrailing({ children }: { children: ReactNode }) {
  return (
    <div className="group relative min-w-0">
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-md ring-ring ring-inset group-focus-within:ring-2"
      />
    </div>
  );
}

/** A tab's caption, for the breadcrumb — the value a target carries is the tab's id, not its name. */
const tabLabel = (value: string) =>
  WORLD_EDITOR_TABS.find((t) => t.value === value)?.label ?? value;

/** The shape of a cell sharing a field's right edge, divided from what precedes it. */
const FIELD_CELL = 'flex h-8 w-8 items-center justify-center border-l border-l-input transition-colors';
const FIELD_CELL_IDLE = 'text-muted-foreground hover:bg-accent hover:text-foreground';

/** A cell for an option that is on or off: filled while it is on, so the state reads at a glance. */
function MatchToggle({ on, onClick, label, last, children }: {
  on: boolean;
  onClick: () => void;
  label: string;
  /** Rounds the outer corners to sit flush in the field's own frame. */
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(FIELD_CELL, last && 'rounded-r-md', on ? 'bg-primary text-primary-foreground' : FIELD_CELL_IDLE)}
    >
      {children}
    </button>
  );
}

/**
 * A cell that swaps between two modes rather than switching one on.
 *
 * Deliberately never fills: a filled cell reads as "this option is on", and neither of these modes is the
 * off one — the icon and the control beside it already say which is running.
 */
function ModeSwap({ onClick, label, last, children }: {
  onClick: () => void;
  label: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(FIELD_CELL, last && 'rounded-r-md', FIELD_CELL_IDLE)}
    >
      {children}
    </button>
  );
}

export default function EditorFindBar({
  targets, placeholders, allowPlaceholderReplace, startWithReplace, onNavigate, onAddPlaceholder, onClose,
}: EditorFindBarProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [index, setIndex] = useState(0);
  const [showReplace, setShowReplace] = useState(startWithReplace);
  const [mode, setMode] = useState<'text' | 'placeholder'>('text');
  const [replaceText, setReplaceText] = useState('');
  const [chipId, setChipId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => { if (startWithReplace) setShowReplace(true); }, [startWithReplace]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const options = useMemo(() => ({ matchCase, wholeWord }), [matchCase, wholeWord]);
  const matches = useMemo(
    () => findMatches(targets, debounced, options),
    [targets, debounced, options],
  );

  // A replace shortens or lengthens the list under the cursor; clamping keeps the counter honest.
  const current = matches.length ? matches[Math.min(index, matches.length - 1)] : null;
  useEffect(() => { setIndex(0); }, [debounced, matchCase, wholeWord]);
  // The matched run is part of the identity, not just where it starts: extending a query leaves the start
  // where it was, so without it the marker would keep the previous word's length and never redraw.
  const revealKey = current
    ? `${current.target.itemId}|${current.target.fieldKey}|${current.start}|${current.target.value.slice(current.start, current.end)}`
    : null;
  useEffect(() => {
    // `null` when nothing matches, so emptying the box takes the marker with it — deleting the last
    // character is as much a change of what is found as typing one.
    onNavigate(current);
    // Navigating is a response to the cursor moving, not to the world changing underneath it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealKey]);

  const counter = debounced ? (matches.length ? `${Math.min(index, matches.length - 1) + 1} / ${matches.length}` : 'No results') : '';

  const step = useCallback((delta: number) => {
    if (!matches.length) return;
    setIndex((i) => (i + delta + matches.length) % matches.length);
  }, [matches.length]);

  const chip = placeholders.find((p) => p.id === chipId) ?? null;
  const placeholderMode = allowPlaceholderReplace && mode === 'placeholder';
  const canReplace = matches.length > 0 && (!placeholderMode || chip !== null);

  /** What one occurrence becomes in `target` — null when the field can't hold it. */
  const insertFor = useCallback((target: SearchTarget): string | null => {
    if (!placeholderMode) return replaceText;
    if (!chip || !target.chipCapable) return null;
    // Unique rolls are keyed by placement, so every occurrence gets its own id.
    return encodePlaceholderToken({ id: chip.id, mode: 'world', placementId: randomUUID() });
  }, [placeholderMode, replaceText, chip]);

  const replaceCurrent = () => {
    if (!current) return;
    const insert = insertFor(current.target);
    if (insert === null) {
      // Stepping past in silence reads as a dead button, and with a single match nothing moves at all.
      setNotice(`${current.target.fieldLabel} can't hold a chip — skipped.`);
      step(1);
      return;
    }
    current.target.write(spliceText(current.target.value, current.start, current.end, insert));
    // The rescan runs off the rewritten world; holding the index leaves the cursor on what is now next.
  };

  const runReplaceAll = () => {
    const summary = replaceAll(matches, insertFor);
    setConfirmAll(false);
    const skipped = summary.skipped
      ? ` ${summary.skipped} skipped in ${summary.skippedFields.length} field${summary.skippedFields.length === 1 ? '' : 's'} that can't hold a chip.`
      : '';
    setNotice(`Replaced ${summary.replaced} match${summary.replaced === 1 ? '' : 'es'} across ${summary.fields} field${summary.fields === 1 ? '' : 's'}.${skipped}`);
  };
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(null), 6000); return () => clearTimeout(t); } }, [notice]);

  const createPlaceholder = () => {
    const placeholder: Placeholder = { id: randomUUID(), name: query.trim() || 'New Placeholder', values: [query] };
    onAddPlaceholder(placeholder);
    setChipId(placeholder.id);
    setPickerOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Enter') { event.preventDefault(); step(event.shiftKey ? -1 : 1); }
  };

  return (
    <div
      // Left, not right: the detail pane holds most of what a search finds, and it is the right-hand half.
      // Inset equally on both edges, so the bar's corner sits exactly on the panel's corner beneath it.
      className="absolute left-4 top-4 z-20 w-[min(30rem,calc(100%-2rem))] rounded-md border bg-popover p-2 shadow-lg"
      data-editor-find-skip
      onKeyDown={onKeyDown}
      role="search"
      aria-label="Find and replace in world"
    >
      {/* Both rows share one grid, so the two editboxes are the same width however wide their trailing
          buttons are: the middle column carries both, and the last column sizes to whichever row needs more.
          The replace row simply leaves the disclosure cell empty rather than being padded to line up. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1 gap-y-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setShowReplace((v) => !v)}
          aria-label={showReplace ? 'Hide replace' : 'Show replace'}
          aria-expanded={showReplace}
        >
          {showReplace ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <FieldWithTrailing>
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find"
            className="h-8 pr-[4.25rem] focus-visible:ring-0"
          />
          {/* One bordered control split in two rather than a ToggleGroup: the group owns its items' pressed
              state, so a pair driven by their own booleans rendered permanently unpressed. */}
          <div className="absolute inset-y-0 right-0 flex items-center" role="group" aria-label="Match options">
            <MatchToggle on={matchCase} onClick={() => setMatchCase((v) => !v)} label="Match case">
              <CaseSensitive className="h-4 w-4" />
            </MatchToggle>
            <MatchToggle on={wholeWord} onClick={() => setWholeWord((v) => !v)} label="Match whole word" last>
              <WholeWord className="h-4 w-4" />
            </MatchToggle>
          </div>
        </FieldWithTrailing>
        <div className="flex items-center gap-1">
          {/* On a phone the count moves down to the result line instead: a slot wide enough for "No results"
              is a fifth of the row there, and it is the editbox that pays for it. */}
          {!isMobile && (
            <span
              className={cn('w-20 text-center text-meta', matches.length || !debounced ? 'text-muted-foreground' : 'text-destructive')}
              aria-live="polite"
            >
              {counter}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => step(-1)} disabled={!matches.length} aria-label="Previous match">
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => step(1)} disabled={!matches.length} aria-label="Next match">
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} aria-label="Close find">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {showReplace && (
          <>
            <span aria-hidden />
            <FieldWithTrailing>
              {placeholderMode ? (
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    {/* Muted until one is picked, so an empty picker doesn't read like a name already sitting
                        in the box — the same way a placeholder attribute reads against real input. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn('h-8 w-full justify-start font-normal focus-visible:ring-0', allowPlaceholderReplace && 'pr-10', !chip && 'text-muted-foreground')}
                    >
                      {chip ? chip.name : 'Choose Placeholder'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-1">
                    <div className="max-h-56 overflow-y-auto">
                      {placeholders.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-label hover:bg-accent"
                          onClick={() => { setChipId(p.id); setPickerOpen(false); }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="mt-1 flex w-full items-center gap-2 rounded-sm border-t px-2 py-1.5 text-label hover:bg-accent"
                      onClick={createPlaceholder}
                    >
                      <Plus className="h-4 w-4" />
                      Create “{query.trim() || 'New Placeholder'}”
                    </button>
                  </PopoverContent>
                </Popover>
              ) : (
                <Input
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="Replace"
                  className={cn('h-8 focus-visible:ring-0', allowPlaceholderReplace && 'pr-10')}
                />
              )}
              {/* Which kind of thing a replacement is, parked in the box it applies to. */}
              {allowPlaceholderReplace && (
                <span className="absolute inset-y-0 right-0 flex items-center">
                  <ModeSwap
                    onClick={() => setMode((m) => (m === 'text' ? 'placeholder' : 'text'))}
                    label={mode === 'text' ? 'Replace with a placeholder instead' : 'Replace with text instead'}
                    last
                  >
                    {mode === 'text' ? <Type className="h-4 w-4" /> : <span className="text-meta font-semibold">{'{}'}</span>}
                  </ModeSwap>
                </span>
              )}
            </FieldWithTrailing>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={replaceCurrent} disabled={!canReplace} aria-label="Replace" title="Replace">
                <Replace className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setConfirmAll(true)} disabled={!canReplace} aria-label="Replace all" title="Replace all">
                <ReplaceAll className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* A phone gets the count alone: where the hit is takes more width than the row has, and a truncated
          "Assault Chas… · AI-Facing De…" tells the author less than nothing. */}
      {isMobile && counter && (
        <p className="mt-1 truncate pl-8 text-muted-foreground">
          <span className={matches.length ? undefined : 'text-destructive'} aria-live="polite">{counter}</span>
        </p>
      )}
      {/* Elsewhere, a breadcrumb: one object rather than a loose line of text, which read as debug output
          under a dense control and was indistinguishable from the notice below it. The tab leads, since a
          search crosses all of them and which one a hit is on is the first thing to know. */}
      {!isMobile && current && (
        <div className="mt-1 flex pl-8">
          <span className="inline-flex min-w-0 items-center gap-1 rounded border bg-secondary/50 px-2 py-0.5 text-label text-muted-foreground">
            <Crosshair className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">{tabLabel(current.target.tab)}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate">{current.target.itemLabel}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate">{current.target.fieldLabel}</span>
          </span>
        </div>
      )}
      {notice && <p className="mt-1 pl-8 text-muted-foreground">{notice}</p>}

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace All</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const eligible = placeholderMode ? matches.filter((m) => m.target.chipCapable) : matches;
                const fields = new Set(eligible.map((m) => m.target)).size;
                const skipped = matches.length - eligible.length;
                return `Replace ${eligible.length} match${eligible.length === 1 ? '' : 'es'} across ${fields} field${fields === 1 ? '' : 's'}?`
                  + (skipped ? ` ${skipped} in fields that can't hold a chip will be skipped.` : '')
                  + ' Discard Changes is the only way back.';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runReplaceAll}>Replace All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
