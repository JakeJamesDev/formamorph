import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaseSensitive, ChevronDown, ChevronUp, Plus, Replace, ReplaceAll, Type, WholeWord, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  onNavigate: (match: SearchMatch) => void;
  onAddPlaceholder: (placeholder: Placeholder) => void;
  onClose: () => void;
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
  const searchRef = useRef<HTMLInputElement>(null);

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
  useEffect(() => {
    if (current) onNavigate(current);
    // Navigating is a response to the cursor moving, not to the world changing underneath it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.target.fieldKey, current?.target.itemId, current?.start]);

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
    if (insert === null) { step(1); return; }
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
  const [notice, setNotice] = useState<string | null>(null);
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
      className="absolute right-4 top-2 z-20 w-[min(30rem,calc(100%-2rem))] rounded-md border bg-popover p-2 shadow-lg"
      data-editor-find-skip
      onKeyDown={onKeyDown}
      role="search"
      aria-label="Find and replace in world"
    >
      <div className="flex items-center gap-1">
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
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find in world"
          className="h-8"
        />
        <ToggleGroup type="multiple" className="shrink-0" aria-label="Match options">
          <ToggleGroupItem
            value="case"
            data-state={matchCase ? 'on' : 'off'}
            onClick={() => setMatchCase((v) => !v)}
            aria-label="Match case"
            title="Match case"
            className="h-8 w-8 p-0"
          >
            <CaseSensitive className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="word"
            data-state={wholeWord ? 'on' : 'off'}
            onClick={() => setWholeWord((v) => !v)}
            aria-label="Match whole word"
            title="Match whole word"
            className="h-8 w-8 p-0"
          >
            <WholeWord className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="w-20 shrink-0 text-center text-caption text-muted-foreground" aria-live="polite">
          {debounced ? (matches.length ? `${Math.min(index, matches.length - 1) + 1} / ${matches.length}` : 'No results') : ''}
        </span>
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
        <div className="mt-2 flex items-center gap-1 pl-8">
          {allowPlaceholderReplace && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setMode((m) => (m === 'text' ? 'placeholder' : 'text'))}
              aria-label={mode === 'text' ? 'Replace with a placeholder instead' : 'Replace with text instead'}
              title={mode === 'text' ? 'Replacing with text' : 'Replacing with a placeholder'}
            >
              {mode === 'text' ? <Type className="h-4 w-4" /> : <span className="text-caption font-semibold">{'{}'}</span>}
            </Button>
          )}
          {placeholderMode ? (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 flex-1 justify-start font-normal">
                  {chip ? chip.name : 'Choose a placeholder'}
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
              placeholder="Replace with"
              className="h-8"
            />
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={replaceCurrent} disabled={!canReplace} aria-label="Replace" title="Replace">
            <Replace className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setConfirmAll(true)} disabled={!canReplace} aria-label="Replace all" title="Replace all">
            <ReplaceAll className="h-4 w-4" />
          </Button>
        </div>
      )}

      {current && (
        <p className="mt-1 truncate pl-8 text-caption text-muted-foreground">
          {current.target.itemLabel} · {current.target.fieldLabel}
        </p>
      )}
      {notice && <p className="mt-1 pl-8 text-caption text-muted-foreground">{notice}</p>}

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
