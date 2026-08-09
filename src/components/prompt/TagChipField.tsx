import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_NORMAL, SELECTION_CHANGE_COMMAND,
  KEY_ARROW_DOWN_COMMAND, KEY_ARROW_UP_COMMAND, KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND, KEY_TAB_COMMAND,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { SuggestionList } from '@/components/SuggestionList';
import { useDanbooruTags } from '@/lib/useDanbooruTags';
import { rankTagSuggestions, activeTagToken } from '@/lib/tagSuggest';
import { placeholderVocabulary, type ChipVocabulary } from '@/lib/chipVocabulary';
import { PLACEHOLDER_TRIGGER, placeholderHint } from '@/lib/placeholderInsert';
import type { Placeholder } from '@/types';
import ChipInput from './ChipInput';
import { $flatCaret, $replaceFlatRange, serializeRoot } from './promptFieldState';

/**
 * The booru Image-Tags field, as a chip editor — so a tag can be a placeholder ("1girl, \{HairColor\} hair")
 * and the generator draws something different each playthrough.
 *
 * The Danbooru autocomplete comes along rather than being traded away for chips: it works off the flat
 * token-string the editor already serializes to, so the tag under the caret is found the same way it is in
 * the plain textarea, and a chip elsewhere in the value is left untouched by a completion.
 */

const SUGGESTION_LIMIT = 10;
const MIN_QUERY = 1; // an empty tag suggests nothing until a character is typed

/** Danbooru autocomplete over the editor's flat string. Registered below the placeholder typeahead's
 *  priority, so while that menu is open it owns the arrows and Enter. */
function DanbooruTagPlugin({ parse }: { parse: ChipVocabulary['parse'] }) {
  const [editor] = useLexicalComposerContext();
  const [everFocused, setEverFocused] = useState(false); // defer the tag-list fetch until the field is used
  const options = useDanbooruTags(everFocused);
  const [state, setState] = useState<{ items: string[]; rect: DOMRect } | null>(null);
  const [active, setActive] = useState(0);
  const dismissed = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const activeRef = useRef(0);
  activeRef.current = active;

  const close = useCallback(() => { setState(null); setActive(0); }, []);

  const select = useCallback((tag: string) => {
    editor.update(() => {
      const caret = $flatCaret();
      if (caret === null) return;
      const value = serializeRoot();
      // Replace only the tag under the caret, so chips elsewhere in the value keep their exact tokens and
      // the caret lands after the completion rather than at the end of the field.
      const { start, end } = activeTagToken(value, caret);
      $replaceFlatRange(parse, start, end, end >= value.length ? `${tag}, ` : tag);
    });
    close();
    editor.focus();
  }, [editor, parse, close]);

  useEffect(() => editor.registerRootListener((root, prevRoot) => {
    const onFocus = () => setEverFocused(true);
    prevRoot?.removeEventListener('focusin', onFocus);
    root?.addEventListener('focusin', onFocus);
  }), [editor]);

  // Bumped on every edit and caret move. The suggestion pass keys off this AND `options`, because the tag
  // list arrives asynchronously on first focus — recomputing only on edits would leave the query the author
  // has already typed showing nothing until they typed one more character.
  const [tick, setTick] = useState(0);
  useEffect(() => mergeRegister(
    editor.registerUpdateListener(() => setTick((t) => t + 1)),
    editor.registerCommand(SELECTION_CHANGE_COMMAND, () => { setTick((t) => t + 1); return false; }, COMMAND_PRIORITY_LOW),
  ), [editor]);

  useEffect(() => {
    if (!options.length) return close();
    let items: string[] = [];
    editor.getEditorState().read(() => {
      const caret = $flatCaret();
      if (caret === null) return;
      const q = activeTagToken(serializeRoot(), caret).token.trim().toLowerCase();
      if (q.length < MIN_QUERY) return;
      items = rankTagSuggestions(options, q, SUGGESTION_LIMIT);
    });
    if (!items.length) { dismissed.current = false; return close(); }
    if (dismissed.current) return;
    const root = editor.getRootElement();
    if (!root) return close();
    setState({ items, rect: root.getBoundingClientRect() });
    setActive((a) => Math.min(a, items.length - 1));
  }, [editor, options, tick, close]);

  useEffect(() => mergeRegister(
    editor.registerCommand(KEY_ARROW_DOWN_COMMAND, (e) => {
      const s = stateRef.current;
      if (!s) return false;
      e?.preventDefault();
      setActive((a) => Math.min(a + 1, s.items.length - 1));
      return true;
    }, COMMAND_PRIORITY_NORMAL),
    editor.registerCommand(KEY_ARROW_UP_COMMAND, (e) => {
      if (!stateRef.current) return false;
      e?.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
      return true;
    }, COMMAND_PRIORITY_NORMAL),
    editor.registerCommand(KEY_ENTER_COMMAND, (e) => {
      const s = stateRef.current;
      if (!s) return false;
      e?.preventDefault();
      select(s.items[activeRef.current]);
      return true;
    }, COMMAND_PRIORITY_NORMAL),
    editor.registerCommand(KEY_TAB_COMMAND, (e) => {
      const s = stateRef.current;
      if (!s) return false;
      e?.preventDefault();
      select(s.items[activeRef.current]);
      return true;
    }, COMMAND_PRIORITY_NORMAL),
    editor.registerCommand(KEY_ESCAPE_COMMAND, () => {
      if (!stateRef.current) return false;
      dismissed.current = true;
      close();
      return true;
    }, COMMAND_PRIORITY_NORMAL),
  ), [editor, select, close]);

  if (!state) return null;
  // Portaled and fixed to the field's own box, so a suggestion list inside a scrolling editor pane isn't clipped.
  return createPortal(
    // `pointer-events-auto`: a modal Radix dialog sets `pointer-events: none` on the body, so anything
    // portaled out of its content is visible but unclickable.
    <div
      className="pointer-events-auto fixed z-[70]"
      style={{ left: state.rect.left, top: state.rect.bottom + 2, width: state.rect.width }}
    >
      <SuggestionList items={state.items} active={active} onPick={select} onHover={setActive} className="w-full" />
    </div>,
    document.body,
  );
}

const TagChipField = ({ value, onChange, placeholders, placeholder, ariaLabel, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholders: Placeholder[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) => {
  const vocab = useMemo(() => placeholderVocabulary(placeholders), [placeholders]);
  return (
    <ChipInput
      value={value}
      onChange={onChange}
      vocabulary={vocab}
      multiline
      placeholder={placeholderHint(placeholder, placeholders.length > 0)}
      ariaLabel={ariaLabel}
      className={className}
      trigger={placeholders.length ? PLACEHOLDER_TRIGGER : undefined}
    >
      <DanbooruTagPlugin parse={vocab.parse} />
    </ChipInput>
  );
};

export default TagChipField;
