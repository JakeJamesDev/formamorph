import { useEffect, useRef } from 'react';
import {
  $createParagraphNode, $getNodeByKey, $getSlot, $removeSlot, $setSlot, HISTORIC_TAG, HISTORY_MERGE_TAG, SKIP_DOM_SELECTION_TAG,
  type EditorState, type NodeKey, type UpdateTag,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { appendSegments } from './promptFieldState';
import { $isVariableNode, ValueBoxNode, type VariableNode } from './VariableNode';
import { VALUE_SLOT, type OpenValueView } from './openValueContext';
import { $caretChipKey, $fieldChips, $mirrorChipKeys } from './openValueCopies';
import { $ejectEdges, $openValueText, $valueBox } from './openValueNodes';

/** Token → the text each chip should show. */
type WantedText = (token: string) => string;

/** One value text this field wrote: what the store held before, and what it was sent. */
interface OwnWrite { from: string; to: string }

function $fillOpenValue(chip: VariableNode, text: string, parse: ChipVocabulary['parse']): void {
  const para = $createParagraphNode();
  appendSegments(para, text, parse);
  const box = new ValueBoxNode();
  box.append(para);
  $setSlot(chip, VALUE_SLOT, box);
}

/** Whether a chip matches what `$sync` makes of it. The value under `caretKey` is left as typed. */
function $chipInSync(chip: VariableNode, active: boolean, wanted: WantedText, caretKey: NodeKey | null): boolean {
  if (!active) return !chip.isExpanded() && !$getSlot(chip, VALUE_SLOT);
  if (!chip.isExpanded()) return false;
  if (chip.getKey() === caretKey) return $openValueText(chip) !== null;
  return $openValueText(chip) === wanted(chip.getToken());
}

function $sync(
  active: boolean,
  wanted: WantedText,
  parse: ChipVocabulary['parse'],
  caretKey: NodeKey | null,
  /** The chip a step just moved: its refilled value takes the caret, so the author can type on. */
  restore: NodeKey | null = null,
): void {
  const caret = $caretChipKey();
  for (const chip of $fieldChips()) {
    if ($chipInSync(chip, active, wanted, caretKey)) continue;
    // Pending whitespace goes to the field before its value is replaced or closed.
    if (chip.isExpanded()) {
      $ejectEdges(chip);
      if ($chipInSync(chip, active, wanted, caretKey)) continue;
    }
    // Replacing the value under the caret would strand the selection, so the caret exits past the chip.
    if (chip.getKey() === caret) chip.selectNext(0, 0);
    if (!active) {
      chip.setExpanded(false);
      if ($getSlot(chip, VALUE_SLOT)) $removeSlot(chip, VALUE_SLOT);
      continue;
    }
    chip.setExpanded(true);
    $fillOpenValue(chip, wanted(chip.getToken()), parse);
    if (chip.getKey() === restore) $valueBox(chip)?.selectEnd();
  }
}

/** Names which value a chip opens on, apart from that value's text. Empty when nothing is open. */
const openValueIdentity = (open: OpenValueView | undefined): string =>
  open?.valueKey ?? `${open?.label ?? ''}·${open?.mark ?? ''}`;

/** A chip whose open value changed between two states: its key and token, and its text before and after. */
interface ValueEdit { key: NodeKey; token: string; before: string; after: string }

function valueEdits(prev: EditorState, next: EditorState): ValueEdit[] {
  const before = new Map(prev.read(() => $fieldChips().map((chip) => [chip.getKey(), $openValueText(chip)])));
  return next.read(() => $fieldChips().flatMap((chip) => {
    const was = before.get(chip.getKey());
    const text = $openValueText(chip);
    // A value that just opened was filled, not typed.
    return text !== null && was != null && text !== was ? [{ key: chip.getKey(), token: chip.getToken(), before: was, after: text }] : [];
  }));
}

/**
 * Opens every chip of the field on its value while `active`, and closes them otherwise. The field's token
 * string never changes, and the work merges into the current history entry, so undo never walks it.
 * Re-checks after every update, which catches a rebuilt value and an undo to a closed state alike.
 *
 * An edit inside a value writes the trimmed text through the value's `write`. Undo and redo write only over
 * a value this field wrote, so they never revert an edit made elsewhere. A value that holds the caret keeps
 * what the author typed; it refills from `values` once the caret or the focus leaves.
 */
export function OpenValuesPlugin({ active, values, parse, pressed }: {
  active: boolean;
  values: Record<string, OpenValueView>;
  parse: ChipVocabulary['parse'];
  /** The chip whose header was pressed last — which value a step belongs to while no value holds the caret. */
  pressed: NodeKey | null;
}) {
  const [editor] = useLexicalComposerContext();
  const ownWrites = useRef(new Map<string, OwnWrite>());
  const openedValues = useRef(new Map<string, string>());
  useEffect(() => {
    const writes = ownWrites.current;
    // A write shows until the store answers with new text for that token.
    const wanted: WantedText = (token) => {
      const text = values[token]?.text ?? '';
      const own = writes.get(token);
      return own && own.from === text ? own.to : text;
    };
    const root = () => editor.getRootElement();
    const resync = ({ spareCaret, restore = null }: { spareCaret: boolean; restore?: NodeKey | null }) => {
      const inSync = editor.getEditorState().read(() => {
        const caretKey = spareCaret ? $caretChipKey() : null;
        return $fieldChips().every((chip) => $chipInSync(chip, active, wanted, caretKey));
      });
      if (inSync) return;
      // A refill after focus has gone must not pull it back through the DOM selection.
      const focused = !!root()?.contains(document.activeElement);
      const tag: UpdateTag[] = focused ? [HISTORY_MERGE_TAG] : [HISTORY_MERGE_TAG, SKIP_DOM_SELECTION_TAG];
      editor.update(() => $sync(active, wanted, parse, spareCaret ? $caretChipKey() : null, restore), { tag });
    };
    // A chevron step or a reroll opens another value, which refills the value under the caret too. The step
    // belongs to the active value: the one holding the caret, else the one whose header took the last press.
    const opened = openedValues.current;
    const switchedKey = editor.getEditorState().read(() => {
      const key = $caretChipKey() ?? pressed;
      const chip = key === null ? null : $getNodeByKey(key);
      const token = $isVariableNode(chip) ? chip.getToken() : null;
      return token !== null && opened.has(token) && opened.get(token) !== openValueIdentity(values[token]) ? key : null;
    });
    opened.clear();
    for (const [token, open] of Object.entries(values)) opened.set(token, openValueIdentity(open));
    resync({ spareCaret: !switchedKey, restore: switchedKey });
    const unregister = editor.registerUpdateListener(({ editorState, prevEditorState, tags }) => {
      const edits = active ? valueEdits(prevEditorState, editorState) : [];
      const mirrors = edits.length ? editorState.read(() => $mirrorChipKeys(values)) : new Set<NodeKey>();
      for (const { key, token, before, after } of edits) {
        const open = values[token];
        const shown = wanted(token).trim();
        const stored = after.trim();
        if (!open?.write || mirrors.has(key) || stored === shown) continue;
        if (tags.has(HISTORIC_TAG) && (before.trim() !== shown || writes.get(token)?.to !== shown)) continue;
        open.write(stored);
        writes.set(token, { from: open.text, to: stored });
      }
      resync({ spareCaret: true });
    });
    // A value's blur never reaches the editor's blur command, so focus leaving the editor is read here.
    // Moving a focused value blurs it too, and its chip takes focus back in the same task.
    const onFocusOut = () => queueMicrotask(() => {
      if (!root()?.contains(document.activeElement)) resync({ spareCaret: false });
    });
    const unroot = editor.registerRootListener((next, prev) => {
      prev?.removeEventListener('focusout', onFocusOut);
      next?.addEventListener('focusout', onFocusOut);
    });
    return () => {
      unregister();
      unroot();
      root()?.removeEventListener('focusout', onFocusOut);
    };
  }, [editor, active, values, parse, pressed]);
  return null;
}
