import { useEffect } from 'react';
import {
  $getNodeByKey, $getSelection, $isElementNode, $isRangeSelection, $isTextNode, COMMAND_PRIORITY_HIGH,
  DELETE_CHARACTER_COMMAND, KEY_ARROW_LEFT_COMMAND, KEY_ARROW_RIGHT_COMMAND,
  type LexicalEditor, type LexicalNode, type NodeKey,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isVariableNode, type VariableNode } from './VariableNode';
import { $caretChip, $ejectEdges, $openValueText, $valueBox, $valueOffset } from './openValueNodes';
import { caretEdge } from './valueEdges';

type Direction = 'left' | 'right';

/** The collapsed caret's value and its place in it, or null when the caret is not in a value. */
function $caretInValue(): { chip: VariableNode; text: string; offset: number } | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const chip = $caretChip(selection);
  const text = chip && $openValueText(chip);
  const offset = chip && $valueOffset(chip, selection.anchor);
  return chip && text !== null && offset !== null ? { chip, text, offset } : null;
}

/** Steps out of the value past its edge, taking the pending whitespace along. */
function $exitValue(dir: Direction): boolean {
  const at = $caretInValue();
  if (!at) return false;
  const { atStart, atEnd } = caretEdge(at.text, at.offset);
  if (dir === 'right' && atEnd) {
    const { after } = $ejectEdges(at.chip, 'end');
    if (after) after.selectEnd();
    else at.chip.selectNext(0, 0);
    return true;
  }
  if (dir === 'left' && atStart) {
    const { before } = $ejectEdges(at.chip, 'start');
    if (before) before.selectStart();
    else at.chip.selectPrevious();
    return true;
  }
  return false;
}

/** The open field chip a collapsed caret in the field text would step into, or null. */
function $chipAhead(dir: Direction): VariableNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed() || $caretChip(selection)) return null;
  const { anchor } = selection;
  const node = anchor.getNode();
  let next: LexicalNode | null = null;
  if ($isTextNode(node)) {
    if (dir === 'right' && anchor.offset === node.getTextContentSize()) next = node.getNextSibling();
    if (dir === 'left' && anchor.offset === 0) next = node.getPreviousSibling();
  } else if ($isElementNode(node)) {
    next = node.getChildAtIndex(dir === 'right' ? anchor.offset : anchor.offset - 1);
  }
  return $isVariableNode(next) && next.isExpanded() && $valueBox(next) ? next : null;
}

function $selectValueEdge(key: NodeKey, dir: Direction): void {
  const chip = $getNodeByKey(key);
  const box = $isVariableNode(chip) ? $valueBox(chip) : null;
  if (dir === 'right') box?.selectStart();
  else box?.selectEnd();
}

/**
 * Steps into the open value ahead of the caret. The value's own island takes the focus before the caret is
 * set, so the next key already lands inside the value rather than in the field text.
 */
function $enterValue(editor: LexicalEditor, dir: Direction): boolean {
  const chip = $chipAhead(dir);
  if (!chip) return false;
  const key = chip.getKey();
  editor.getElementByKey(key)?.querySelector<HTMLElement>('[data-lexical-slot]')?.focus();
  $selectValueEdge(key, dir);
  return true;
}

/**
 * Edge typing on the Values tab. Arrow keys step into an open value and out of it, since Lexical keeps the
 * caret inside a slot, and an arrow out takes the pending edge whitespace with it. Deletes at a value's
 * edge reach nothing outside it. Every other way the caret leaves a value, `OpenValuesPlugin` ejects on
 * its way to refilling the value.
 */
export function ValueEdgesPlugin({ active }: { active: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!active) return;
    const arrow = (dir: Direction) => (event: KeyboardEvent | null) => {
      if (event?.shiftKey || !($exitValue(dir) || $enterValue(editor, dir))) return false;
      event?.preventDefault();
      return true;
    };
    return mergeRegister(
      editor.registerCommand(KEY_ARROW_RIGHT_COMMAND, arrow('right'), COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_ARROW_LEFT_COMMAND, arrow('left'), COMMAND_PRIORITY_HIGH),
      editor.registerCommand(DELETE_CHARACTER_COMMAND, (backward) => {
        const at = $caretInValue();
        return !!at && (backward ? at.offset === 0 : at.offset >= at.text.length);
      }, COMMAND_PRIORITY_HIGH),
    );
  }, [editor, active]);
  return null;
}
