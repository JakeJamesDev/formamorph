import { $getNodeByKey, $getRoot, $isElementNode, type NodeKey } from 'lexical';
import { $isVariableNode, type VariableNode } from './VariableNode';
import { type OpenValueView } from './openValueContext';
import { $caretChip } from './openValueNodes';

/** The field's own chips: a chip inside an open value stays a chip. */
export function $fieldChips(): VariableNode[] {
  const para = $getRoot().getFirstChild();
  return $isElementNode(para) ? para.getChildren().filter($isVariableNode) : [];
}

/** The key of the field chip whose value holds the caret, or null. */
export function $caretChipKey(): NodeKey | null {
  return $caretChip()?.getKey() ?? null;
}

/**
 * Value key → the one chip that edits it. Of the copies open on one value, the one that holds the caret
 * edits it, else the first in document order, so a copy is never taken from under the caret.
 */
function $editingChips(values: Record<string, OpenValueView>): Map<string, NodeKey> {
  const chips = $fieldChips();
  const editing = new Map<string, NodeKey>();
  const caretKey = $caretChipKey();
  const caret = chips.find((chip) => chip.getKey() === caretKey);
  const caretValue = caret && $valueKey(caret, values);
  if (caret && caretValue) editing.set(caretValue, caret.getKey());
  for (const chip of chips) {
    const key = $valueKey(chip, values);
    if (key && !editing.has(key)) editing.set(key, chip.getKey());
  }
  return editing;
}

/** Names the value a chip is open on, shared by every copy open on it. */
const $valueKey = (chip: VariableNode, values: Record<string, OpenValueView>): string | undefined =>
  values[chip.getToken()]?.valueKey;

/** The field chips that mirror another open copy of their value. */
export function $mirrorChipKeys(values: Record<string, OpenValueView>): Set<NodeKey> {
  const editing = $editingChips(values);
  return new Set($fieldChips().filter((chip) => {
    const key = $valueKey(chip, values);
    return !!key && editing.get(key) !== chip.getKey();
  }).map((chip) => chip.getKey()));
}

/**
 * The chip that edits the value `chipKey` shows: itself, or the copy it mirrors. A chip on no shared value
 * is its own answer, so a caret sent here always has somewhere to land.
 */
export function $editableCopyKey(chipKey: NodeKey, values: Record<string, OpenValueView>): NodeKey {
  const chip = $getNodeByKey(chipKey);
  const key = $isVariableNode(chip) ? $valueKey(chip, values) : undefined;
  return (key && $editingChips(values).get(key)) ?? chipKey;
}

/** Whether an open chip takes no input: the editor is read-only, its value can't be written, or it mirrors another copy. */
export function $openValueReadOnly(chipKey: NodeKey, token: string, values: Record<string, OpenValueView>, editable: boolean): boolean {
  return !editable || !values[token]?.write || $mirrorChipKeys(values).has(chipKey);
}
