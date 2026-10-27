import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  COMMAND_PRIORITY_HIGH, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND,
  KEY_ARROW_DOWN_COMMAND, KEY_ARROW_UP_COMMAND, KEY_ENTER_COMMAND, KEY_TAB_COMMAND,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { SuggestionList } from '@/components/SuggestionList';
import { UserAvatar } from '@/components/UserAvatar';
import { UserName } from '@/components/UserName';
import { caretMenuPosition, caretRect, type CaretRect } from '@/components/prompt/caretRect';
import { $flatCaret, $replaceFlatRange, serializeRoot } from '@/components/prompt/promptFieldState';
import { ChipVocabularyContext } from '@/lib/chipVocabulary';
import { feedbackSuggestInsert, feedbackSuggestQuery, type FeedbackSuggestQuery } from '@/lib/feedbackSuggest';
import { useMountedRef } from '@/lib/useMountedRef';
import FeedbackService from '@/services/FeedbackService';
import type { FeedbackThreadSuggestion, FeedbackType, FeedbackUserSuggestion } from '@/types';

/** How long typing must pause before a search goes out. */
export const FEEDBACK_SUGGEST_DEBOUNCE_MS = 150;

type Row =
  | { kind: 'user'; user: FeedbackUserSuggestion }
  | { kind: 'thread'; thread: FeedbackThreadSuggestion };

const rowKey = (row: Row) => (row.kind === 'user' ? `user:${row.user.id}` : `thread:${row.thread.number}`);

function RowLabel({ row }: { row: Row }) {
  if (row.kind === 'user') {
    const { user } = row;
    return (
      <span className="flex min-w-0 items-center gap-2">
        <UserAvatar username={user.username} avatarUrl={user.avatarUrl} supporter={user.supporter} size="xs" />
        <UserName username={user.username} role={user.role} supporter={user.supporter} />
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 tabular-nums text-muted-foreground">#{row.thread.number}</span>
      <span className="truncate">{row.thread.title}</span>
    </span>
  );
}

interface Shown {
  rows: Row[];
  rect: CaretRect;
}

const sameRun = (a: FeedbackSuggestQuery | null, b: FeedbackSuggestQuery | null) =>
  !!a && !!b && a.kind === b.kind && a.start === b.start;

/**
 * `@` and `#` suggestions in a feedback body or comment: players after `@`, readable threads after `#`.
 * A pick swaps the typed run for `@username` or `#N`.
 */
export function FeedbackSuggestPlugin({ thread, threadTypes }: {
  /** The thread being written in, whose participants `@` lists first; absent for a new thread. */
  thread?: string;
  /** The boards `#` searches, or null for every board the reader may read. */
  threadTypes: readonly FeedbackType[] | null;
}) {
  const [editor] = useLexicalComposerContext();
  const { parse } = useContext(ChipVocabularyContext);
  const mounted = useMountedRef();
  const [shown, setShown] = useState<Shown | null>(null);
  const [active, setActive] = useState(0);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const activeRef = useRef(0);
  activeRef.current = active;

  // The run whose query went out last, so a caret move that changes nothing sends nothing.
  const asked = useRef<FeedbackSuggestQuery | null>(null);
  // A run Escape closed; it stays closed until the caret leaves it.
  const dismissed = useRef<FeedbackSuggestQuery | null>(null);
  // A query that found nothing: a longer query in the same run can only find less.
  const empty = useRef<FeedbackSuggestQuery | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    seq.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    inflight.current?.abort();
    inflight.current = null;
  }, []);

  const close = useCallback(() => { setShown(null); setActive(0); }, []);

  useEffect(() => cancel, [cancel]);

  const search = useCallback((run: FeedbackSuggestQuery) => {
    cancel();
    const id = seq.current;
    timer.current = setTimeout(async () => {
      timer.current = null;
      const controller = new AbortController();
      inflight.current = controller;
      let rows: Row[];
      try {
        rows = run.kind === 'user'
          ? (await FeedbackService.searchUsers(run.query, thread, controller.signal)).map((user) => ({ kind: 'user', user }))
          : (await FeedbackService.searchThreads(run.query, threadTypes, controller.signal)).map((t) => ({ kind: 'thread', thread: t }));
      } catch {
        if (id === seq.current) {
          inflight.current = null;
          if (mounted.current) close();
        }
        return;
      }
      if (id !== seq.current || !mounted.current) return;
      inflight.current = null;
      if (!rows.length) {
        empty.current = run;
        return close();
      }
      const rect = caretRect(editor.getRootElement());
      if (!rect) return close();
      setShown({ rows, rect });
      setActive(0);
    }, FEEDBACK_SUGGEST_DEBOUNCE_MS);
  }, [editor, thread, threadTypes, cancel, close, mounted]);

  const refresh = useCallback(() => {
    const current = editor.getEditorState().read(() => {
      const caret = $flatCaret();
      return caret === null ? null : feedbackSuggestQuery(serializeRoot().slice(0, caret));
    });
    const quiet = () => { asked.current = null; cancel(); close(); };
    if (!current) {
      dismissed.current = null;
      return quiet();
    }
    if (sameRun(dismissed.current, current)) return quiet();
    dismissed.current = null;
    if (sameRun(asked.current, current) && asked.current?.query === current.query) return;
    if (current.kind === 'user' && !current.query && !thread) return quiet();
    // An empty query lists participants only, so letters after it search everyone again.
    const none = empty.current;
    if (none?.query && sameRun(none, current) && current.query.startsWith(none.query)) return quiet();
    asked.current = current;
    search(current);
  }, [editor, thread, cancel, close, search]);

  useEffect(() => mergeRegister(
    editor.registerUpdateListener(() => refresh()),
    editor.registerCommand(SELECTION_CHANGE_COMMAND, () => { refresh(); return false; }, COMMAND_PRIORITY_LOW),
  ), [editor, refresh]);

  const pick = useCallback((key: string) => {
    const row = shownRef.current?.rows.find((r) => rowKey(r) === key);
    if (!row) return;
    editor.update(() => {
      const caret = $flatCaret();
      if (caret === null) return;
      const run = feedbackSuggestQuery(serializeRoot().slice(0, caret));
      if (!run) return;
      const value = row.kind === 'user' ? row.user.username : row.thread.number;
      $replaceFlatRange(parse, run.start, caret, feedbackSuggestInsert(row.kind, value));
    });
    cancel();
    close();
    editor.focus();
  }, [editor, parse, cancel, close]);

  // The keys belong to the list only while it shows; otherwise they stay the editor's.
  useEffect(() => {
    const accept = (e: KeyboardEvent | null) => {
      const s = shownRef.current;
      if (!s) return false;
      e?.preventDefault();
      pick(rowKey(s.rows[activeRef.current]));
      return true;
    };
    return mergeRegister(
      editor.registerCommand(KEY_ARROW_DOWN_COMMAND, (e) => {
        const s = shownRef.current;
        if (!s) return false;
        e?.preventDefault();
        setActive((a) => (a + 1) % s.rows.length);
        return true;
      }, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_ARROW_UP_COMMAND, (e) => {
        const s = shownRef.current;
        if (!s) return false;
        e?.preventDefault();
        setActive((a) => (a <= 0 ? s.rows.length - 1 : a - 1));
        return true;
      }, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_ENTER_COMMAND, accept, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_TAB_COMMAND, accept, COMMAND_PRIORITY_HIGH),
    );
  }, [editor, pick]);

  // Escape is caught on the window's capture pass: a dialog around the field listens on the document's,
  // which runs before the editor's own handler and would close the dialog instead of the list. With no
  // list showing yet, Escape still stops the pending search and stays the dialog's.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !editor.getRootElement()?.contains(e.target as Node)) return;
      const pending = !!timer.current || !!inflight.current;
      if (!shownRef.current && !pending) return;
      if (shownRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
      dismissed.current = asked.current;
      cancel();
      close();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [editor, cancel, close]);

  if (!shown) return null;
  const byKey = new Map(shown.rows.map((r) => [rowKey(r), r]));
  // Portaled and fixed to the caret, so a field inside a scroll pane or dialog doesn't clip it.
  return createPortal(
    // `pointer-events-auto`: a modal Radix dialog sets `pointer-events: none` on the body, so anything
    // portaled out of its content is visible but unclickable. z-60: above dialogs, below the help window.
    <div
      data-testid="feedback-suggestions"
      className="pointer-events-auto fixed z-[60] w-80"
      style={caretMenuPosition(shown.rect, 320)}
    >
      <SuggestionList
        items={[...byKey.keys()]}
        active={active}
        onPick={pick}
        onHover={setActive}
        label={(key) => { const row = byKey.get(key); return row ? <RowLabel row={row} /> : null; }}
        // In flow inside the anchored box, so a list opened above the caret grows upward from it.
        className="static mt-0 w-full"
      />
    </div>,
    document.body,
  );
}
