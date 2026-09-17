import {
  $getRoot, $getSelection, $getSelectionSlotFrame, $getSlot, $isElementNode, type NodeKey,
} from 'lexical';
import { $isVariableNode, type VariableNode } from './VariableNode';
import { VALUE_SLOT, type OpenValueView } from './openValueContext';

/** The field's own chips: a chip inside an open value stays a chip. */
export function $fieldChips(): VariableNode[] {
  const para = $getRoot().getFirstChild();
  return $isElementNode(para) ? para.getChildren().filter($isVariableNode) : [];
}

/** The key of the field chip whose value holds the caret, or null. */
export function $caretChipKey(): NodeKey | null {
  const frame = $getSelectionSlotFrame($getSelection());
  if (!frame) return null;
  return $fieldChips().find((chip) => $getSlot(chip, VALUE_SLOT)?.is(frame))?.getKey() ?? null;
}

/**
 * The field chips that mirror another open copy of their value. Of the copies open on one value, the one
 * that holds the caret edits it, else the first in document order, so a copy is never taken from under the caret.
 */
export function $mirrorChipKeys(values: Record<string, OpenValueView>): Set<NodeKey> {
  const chips = $fieldChips();
  const valueKey = (chip: VariableNode) => values[chip.getToken()]?.valueKey;
  const editing = new Map<string, NodeKey>();
  const caretKey = $caretChipKey();
  const caret = chips.find((chip) => chip.getKey() === caretKey);
  const caretValue = caret && valueKey(caret);
  if (caret && caretValue) editing.set(caretValue, caret.getKey());
  for (const chip of chips) {
    const key = valueKey(chip);
    if (key && !editing.has(key)) editing.set(key, chip.getKey());
  }
  return new Set(chips.filter((chip) => {
    const key = valueKey(chip);
    return !!key && editing.get(key) !== chip.getKey();
  }).map((chip) => chip.getKey()));
}

/** Whether an open chip takes no input: the editor is read-only, its value can't be written, or it mirrors another copy. */
export function $openValueReadOnly(chipKey: NodeKey, token: string, values: Record<string, OpenValueView>, editable: boolean): boolean {
  return !editable || !values[token]?.write || $mirrorChipKeys(values).has(chipKey);
}
