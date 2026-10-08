import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CaseSensitive, ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, Crosshair, Plus, Replace, ReplaceAll, Search, Type, WholeWord, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldWithTrailing } from '@/components/ui/field-with-trailing';
import { ClearSearchButton } from '@/components/ui/search-field';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tip } from '@/components/ui/tooltip';
import { PlaceholderSectionList } from '@/components/editor/PlaceholderSectionList';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useIsMobile';
import { WORLD_EDITOR_TABS } from '@/views/worldEditorTabs';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken, encodePlaceholderToken, newPlaceholder } from '@/lib/placeholders';
import { randomUUID } from '@/lib/uuid';
import { findMatches, refusesBlueprintInsert, replaceAll, spliceText } from '@/lib/worldSearch';
import { blueprintIds } from '@/lib/placeholderBlueprints';
import { dropBlueprintChips } from '@/lib/blueprintChips';
import { codeNameReader, codeRenameTarget } from '@/lib/statCodeRename';
import { useCodeRenameOffer } from '@/lib/useCodeRename';
import type { SearchMatch, SearchTarget } from '@/lib/worldSearch';
import type { PlacementLetters } from '@/lib/placementLetters';
import type { PlaceholderOwners } from '@/lib/placeholderHomes';
import type { Placeholder, PlaceholderGroup } from '@/types';

/**
 * The World Editor's find & replace bar, in one of two layouts. Floating is mobile's strip over the editor
 * content, opened from the header magnifier or Ctrl+F (Ctrl+H opens it with the replace row showing). Docked
 * is desktop's Search World field in the app bar, always mounted and live as you type; expanded, the full bar
 * grows over the header from the field's slot.
 *
 * Replacement has two modes. Text splices a string; Placeholder splices a freshly minted chip token, and
 * skips fields that don't render chips rather than leaving a raw token showing as literal text.
 */

interface EditorFindBarProps {
  /** Floating by default. */
  layout?: 'floating' | 'docked';
  /** Docked: each new value focuses the field (Ctrl+F). */
  focusSignal?: number;
  /** Docked: true while the field holds text, false again when it empties or unmounts. */
  onActiveChange?: (active: boolean) => void;
  /** Docked: focus left the search. */
  onLeave?: () => void;
  /** Docked: the full bar, with match options and the replace row, shows in place of the field. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Docked: attributes for the field's frame, such as a Take Me There target. */
  fieldAttributes?: Readonly<Record<string, string>>;
  targets: SearchTarget[];
  placeholders: Placeholder[];
  /** The document's placement letters, so a chip answers a search by the name it shows. */
  placementLetters: PlacementLetters;
  /** Who owns each scoped placeholder, so a chip answers to `Molly › Eyes` as the lists print it. */
  placeholderOwners?: PlaceholderOwners;
  /** The world's placeholder folders, so the picker heads a folder's rows with its path. */
  placeholderGroups?: readonly PlaceholderGroup[];
  /** Placeholder-replace mode follows the Placeholders tab in hiding from Simple mode. */
  allowPlaceholderReplace: boolean;
  /** Floating: open with the replace row expanded (Ctrl+H). */
  startWithReplace?: boolean;
  /** Called with the hit to reveal, or `null` when there is none left to show. */
  onNavigate: (match: SearchMatch | null) => void;
  onAddPlaceholder: (placeholder: Placeholder) => void;
  onClose: () => void;
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
    <Tip tip={label}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        className={cn(FIELD_CELL, last && 'rounded-r-md', on ? 'bg-primary text-primary-foreground' : FIELD_CELL_IDLE)}
      >
        {children}
      </button>
    </Tip>
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
    <Tip tip={label}>
      <button
        type="button"
        onClick={onClick}
        className={cn(FIELD_CELL, last && 'rounded-r-md', FIELD_CELL_IDLE)}
      >
        {children}
      </button>
    </Tip>
  );
}

/** A cell at the docked field's right edge that steps through the matches. */
function StepCell({ onClick, disabled, label, children }: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(FIELD_CELL, 'h-full shrink-0', FIELD_CELL_IDLE, 'disabled:pointer-events-none disabled:opacity-50')}
    >
      {children}
    </button>
  );
}

/** The question Replace All asks before it writes: how many matches, across how many fields, and what it skips. */
export function ReplaceAllConfirm({ open, onOpenChange, count, fields, skipped, missingChip, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  fields: number;
  skipped: number;
  missingChip: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent surface="replaceAll" data-editor-find-layer>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace All</AlertDialogTitle>
          <AlertDialogDescription>
            {`Replace ${count} match${count === 1 ? '' : 'es'} across ${fields} field${fields === 1 ? '' : 's'}?`
              + (skipped ? ` ${skipped} in fields that can't hold ${missingChip} will be skipped.` : '')
              + ' Discard Changes is the only way back.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Replace All</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function EditorFindBar({
  layout = 'floating', focusSignal, onActiveChange, onLeave, expanded = false, onExpandedChange, fieldAttributes,
  targets, placeholders, placementLetters, placeholderOwners, placeholderGroups, allowPlaceholderReplace, startWithReplace = false, onNavigate, onAddPlaceholder, onClose,
}: EditorFindBarProps) {
  const docked = layout === 'docked';
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [index, setIndex] = useState(0);
  const [showReplace, setShowReplace] = useState(startWithReplace);
  const [mode, setMode] = useState<'text' | 'placeholder'>('text');
  const [replaceText, setReplaceText] = useState('');
  const [chipId, setChipId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const offerCodeRename = useCodeRenameOffer();
  const [notice, setNotice] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Floating opens on request, so it takes focus; docked mounts with the editor, so it waits to be asked.
  useEffect(() => { if (!docked) searchRef.current?.focus(); }, [docked]);
  useEffect(() => { if (docked && focusSignal) searchRef.current?.focus(); }, [docked, focusSignal]);
  // A swap unmounts the focused control, so focus follows to the shown field unless the host moved it away.
  const rootRef = useRef<HTMLDivElement>(null);
  const shownExpanded = useRef(expanded);
  useEffect(() => {
    if (!docked || shownExpanded.current === expanded) return;
    shownExpanded.current = expanded;
    const focused = document.activeElement;
    if (!focused || focused === document.body || rootRef.current?.contains(focused)) searchRef.current?.focus();
  }, [docked, expanded]);
  const active = docked && query !== '';
  // The cleanup reports the end too, so an unmount never leaves the host collecting for an empty field.
  useEffect(() => {
    if (!active) return;
    onActiveChange?.(true);
    return () => onActiveChange?.(false);
    // The host's callback is a state setter; only the field's own change reports.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => { if (startWithReplace) setShowReplace(true); }, [startWithReplace]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const options = useMemo(() => ({ matchCase, wholeWord }), [matchCase, wholeWord]);
  const matches = useMemo(
    () => findMatches(targets, debounced, options, { placeholders, letters: placementLetters, owners: placeholderOwners }),
    [targets, debounced, options, placeholders, placementLetters, placeholderOwners],
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

  const placeholderMode = allowPlaceholderReplace && mode === 'placeholder';
  // The palette's own rows, sectioned as every other picker draws them. `palette`, not `allRows`: a
  // replacement drops a chip into ordinary world text, which is exactly what the insert strip offers, and a
  // member another placeholder owns is reached by drilling into that owner rather than aimed at from outside.
  const pickerRows = useMemo(
    () => placeholderVocabulary(placeholders, { owners: placeholderOwners, groups: placeholderGroups, letters: placementLetters }).palette(),
    [placeholders, placeholderOwners, placeholderGroups, placementLetters],
  );
  // Read back off the rows, not the world's whole list: the picker shows a pick it can find a row for, and a
  // pick it cannot — one the author has since filed inside another placeholder — must stop Replace too,
  // rather than leaving the button live under a trigger that reads as empty.
  const chip = pickerRows.some((row) => decodePlaceholderToken(row.token)?.id === chipId)
    ? placeholders.find((p) => p.id === chipId) ?? null
    : null;
  const canReplace = matches.length > 0 && (!placeholderMode || chip !== null);

  const blueprints = useMemo(
    () => blueprintIds({ placeholders: [...placeholders], placeholderGroups: [...(placeholderGroups ?? [])] }),
    [placeholders, placeholderGroups],
  );
  // What a skip says the field lacks: a blueprint chip goes only in world trait text.
  const insertsBlueprint = placeholderMode ? !!chip && blueprints.has(chip.id) : dropBlueprintChips(replaceText, blueprints).dropped > 0;
  const missingChip = insertsBlueprint ? 'a blueprint chip' : 'a chip';

  /** What one occurrence becomes in `target` — null when the field can't hold it. */
  const insertFor = useCallback((target: SearchTarget): string | null => {
    const insert = !placeholderMode ? replaceText
      : !chip || !target.chipCapable ? null
      // Unique rolls are keyed by placement, so every occurrence gets its own id.
      : encodePlaceholderToken({ id: chip.id, mode: 'world', placementId: randomUUID() });
    return insert !== null && refusesBlueprintInsert(target, insert, blueprints) ? null : insert;
  }, [placeholderMode, replaceText, chip, blueprints]);

  /**
   * A replace that rewrote a name is a rename, and the code that named it deserves the same offer a rename
   * typed into the panel gets. The names of the other entries come from the targets themselves, since every
   * one of them carries its item's name field.
   */
  const nameTargets = useMemo(
    () => targets.filter((target) => codeRenameTarget(target.itemKey, target.fieldKey)),
    [targets],
  );
  const noteRename = useCallback((target: SearchTarget, next: string) => {
    const renamed = codeRenameTarget(target.itemKey, target.fieldKey);
    if (!renamed) return;
    const read = codeNameReader(renamed, placeholders);
    // Only the entries of the same kind can be the duplicate the warning covers: an entity and a
    // placeholder both open a `placeholders` path, but neither takes the other's name.
    const kind = target.itemKey.slice(0, target.itemKey.indexOf(':'));
    const otherNames = nameTargets
      .filter((other) => other.itemKey !== target.itemKey && other.itemKey.startsWith(`${kind}:`))
      .map((other) => read(other.value));
    offerCodeRename({ ...renamed, oldName: read(target.value), newName: read(next), otherNames });
  }, [offerCodeRename, placeholders, nameTargets]);

  const replaceCurrent = () => {
    if (!current) return;
    if (current.chip) {
      // The hit is a chip. Text cannot stand in for one; its pop-out is where it changes.
      setNotice('That match is a chip — change it from its pop-out. Skipped.');
      step(1);
      return;
    }
    const insert = insertFor(current.target);
    if (insert === null) {
      // Stepping past in silence reads as a dead button, and with a single match nothing moves at all.
      setNotice(`${current.target.fieldLabel} can't hold ${missingChip} — skipped.`);
      step(1);
      return;
    }
    const next = spliceText(current.target.value, current.start, current.end, insert);
    current.target.write(next);
    noteRename(current.target, next);
    // The rescan runs off the rewritten world; holding the index leaves the cursor on what is now next.
  };

  const runReplaceAll = () => {
    const summary = replaceAll(matches, insertFor, noteRename);
    setConfirmAll(false);
    const skipped = summary.skipped
      ? ` ${summary.skipped} skipped in ${summary.skippedFields.length} field${summary.skippedFields.length === 1 ? '' : 's'} that can't hold ${missingChip}.`
      : '';
    const chips = summary.chips
      ? ` ${summary.chips} chip${summary.chips === 1 ? '' : 's'} left as ${summary.chips === 1 ? 'it is' : 'they are'} — a chip changes from its pop-out.`
      : '';
    setNotice(`Replaced ${summary.replaced} match${summary.replaced === 1 ? '' : 'es'} across ${summary.fields} field${summary.fields === 1 ? '' : 's'}.${skipped}${chips}`);
  };
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(null), 6000); return () => clearTimeout(t); } }, [notice]);

  const createPlaceholder = () => {
    const placeholder = newPlaceholder(query.trim() || 'New Placeholder', [query]);
    onAddPlaceholder(placeholder);
    setChipId(placeholder.id);
  };

  // Docked, Escape and Close Search empty the field, which drops the marker; the host folds the bar back.
  const close = () => {
    if (docked) { setQuery(''); setDebounced(''); }
    onClose();
  };
  const replaceOpen = docked || showReplace;
  const findClearable = query !== '';
  const clearFind = () => { setQuery(''); searchRef.current?.focus(); };
  const replaceClearable = !placeholderMode && replaceText !== '';
  const replacePadding = allowPlaceholderReplace
    ? (replaceClearable ? 'pr-[4rem]' : 'pr-10')
    : (replaceClearable && 'pr-7');

  // The Replace All confirmation is portaled out of the bar, but focus in it is still in the search.
  const leaveCheck = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Element && (event.currentTarget.contains(next) || next.closest('[data-editor-find-layer]'))) return;
    onLeave?.();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    // A key in the portaled confirmation is that dialog's own.
    if (!event.currentTarget.contains(event.target as Node)) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    // Docked, Enter steps only from the field; on a step cell it presses that cell.
    if (event.key === 'Enter' && (!docked || event.target === searchRef.current)) {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    }
  };

  // One grid for both rows keeps the two editboxes the same width, whatever their trailing buttons need.
  const fullBar = (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1 gap-y-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => (docked ? onExpandedChange?.(false) : setShowReplace((v) => !v))}
          aria-label={docked ? 'Collapse to search' : showReplace ? 'Hide replace' : 'Show replace'}
          aria-expanded={replaceOpen}
        >
          {replaceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <FieldWithTrailing>
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={docked ? 'Search World' : 'Find'}
            placeholder={docked ? 'Search World' : 'Find'}
            className={cn('h-8 focus-visible:ring-0', findClearable ? 'pr-[6rem]' : 'pr-[4.25rem]')}
          />
          {findClearable && (
            <ClearSearchButton
              size="sm"
              onClick={clearFind}
              className="absolute right-[4.25rem] top-1/2 -translate-y-1/2"
            />
          )}
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
          {/* On mobile the count moves down to the result line instead: a slot wide enough for "No results"
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
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={close} aria-label={docked ? 'Close Search' : 'Close Find'}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {replaceOpen && (
          <>
            <span aria-hidden />
            <FieldWithTrailing>
              {placeholderMode ? (
                <PlaceholderSectionList
                  rows={pickerRows}
                  selectedId={chipId ?? ''}
                  onSelect={setChipId}
                  placeholders={placeholders}
                  empty="Choose Placeholder"
                  trigger={(content) => (
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn('h-8 w-full justify-start font-normal focus-visible:ring-0', allowPlaceholderReplace && 'pr-10')}
                    >
                      {content}
                    </Button>
                  )}
                  footer={(close) => (
                    <button
                      type="button"
                      className="mt-1 flex w-full items-center gap-2 rounded-sm border-t px-2 py-1.5 text-label hover:bg-accent"
                      onClick={() => { createPlaceholder(); close(); }}
                    >
                      <Plus className="h-4 w-4" />
                      Create “{query.trim() || 'New Placeholder'}”
                    </button>
                  )}
                />
              ) : (
                <Input
                  ref={replaceRef}
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  aria-label="Replace with"
                  placeholder="Replace"
                  className={cn('h-8 focus-visible:ring-0', replacePadding)}
                />
              )}
              {replaceClearable && (
                <ClearSearchButton
                  size="sm"
                  aria-label="Clear Replace"
                  onClick={() => { setReplaceText(''); replaceRef.current?.focus(); }}
                  className={cn('absolute top-1/2 -translate-y-1/2', allowPlaceholderReplace ? 'right-[2.25rem]' : 'right-1')}
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
              <Tip tip="Replace">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={replaceCurrent} disabled={!canReplace}>
                  <Replace className="h-4 w-4" />
                </Button>
              </Tip>
              <Tip tip="Replace all">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setConfirmAll(true)} disabled={!canReplace}>
                  <ReplaceAll className="h-4 w-4" />
                </Button>
              </Tip>
            </div>
          </>
        )}
      </div>

      {/* Mobile gets the count alone: where the hit is takes more width than the row has, and a truncated
          "Assault Chas… · AI-Facing De…" tells the author less than nothing. */}
      {isMobile && counter && (
        <p className="mt-1 truncate pl-8 text-label text-muted-foreground">
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
    </>
  );

  const eligible = matches.filter((m) => insertFor(m.target) !== null);
  const confirmDialog = (
    <ReplaceAllConfirm
      open={confirmAll}
      onOpenChange={setConfirmAll}
      count={eligible.length}
      fields={new Set(eligible.map((m) => m.target)).size}
      skipped={matches.length - eligible.length}
      missingChip={missingChip}
      onConfirm={runReplaceAll}
    />
  );

  if (docked) {
    const optionsOn = matchCase || wholeWord;
    const expand = () => onExpandedChange?.(true);
    return (
      <div
        ref={rootRef}
        className="relative w-[26rem] max-w-full"
        data-editor-find-skip
        onKeyDown={onKeyDown}
        onBlur={leaveCheck}
        role="search"
        aria-label="Search World"
      >
        {expanded ? (
          <>
            {/* The slot keeps the field's size, so the header never reflows while the bar covers it. */}
            <div aria-hidden className="h-8" />
            {/* Offset by its padding and border, so its field sits where the docked one was. */}
            <div {...fieldAttributes} className="absolute -top-[9px] left-1/2 z-30 w-[36rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md border bg-popover p-2 shadow-lg">
              {fullBar}
            </div>
          </>
        ) : (
          // One row in the field's frame, so the text keeps whatever the counter and cells leave in a narrow bar.
          <div
            {...fieldAttributes}
            className="group relative flex h-8 items-center rounded-md border border-input bg-background"
          >
            <Search aria-hidden className="ml-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search World"
              placeholder="Search World"
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-meta outline-none placeholder:text-muted-foreground"
            />
            {/* An option left on shows here, so a collapsed search never filters silently. */}
            {optionsOn && (
              <Tip tip="Show match options">
                <button
                  type="button"
                  onClick={expand}
                  className="mr-1 flex h-6 shrink-0 items-center gap-0.5 rounded bg-primary/15 px-1 text-primary hover:bg-primary/25"
                >
                  {matchCase && <CaseSensitive aria-hidden className="h-4 w-4" />}
                  {wholeWord && <WholeWord aria-hidden className="h-4 w-4" />}
                </button>
              </Tip>
            )}
            {/* Always mounted, so the live region exists before its first count. */}
            <span className={cn('shrink-0 text-meta', counter && 'px-2', matches.length ? 'text-muted-foreground' : 'text-destructive')} aria-live="polite">
              {counter}
            </span>
            {/* After the counter, whose width changes with the count, so the X keeps one position. */}
            {findClearable && <ClearSearchButton size="sm" onClick={clearFind} className="mr-1" />}
            <StepCell onClick={() => step(-1)} disabled={!matches.length} label="Previous match">
              <ChevronUp className="h-4 w-4" />
            </StepCell>
            <StepCell onClick={() => step(1)} disabled={!matches.length} label="Next match">
              <ChevronDown className="h-4 w-4" />
            </StepCell>
            <Tip tip="Show options and replace (Ctrl+H)">
              <button
                type="button"
                onClick={expand}
                aria-label="Show options and replace"
                aria-expanded={false}
                className={cn(FIELD_CELL, 'h-full shrink-0 rounded-r-md', FIELD_CELL_IDLE)}
              >
                <ChevronsUpDown className="h-4 w-4" />
              </button>
            </Tip>
            <span aria-hidden className="pointer-events-none absolute -inset-px rounded-md ring-ring ring-inset group-focus-within:ring-2" />
          </div>
        )}
        {confirmDialog}
      </div>
    );
  }

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
      {fullBar}
      {confirmDialog}
    </div>
  );
}
