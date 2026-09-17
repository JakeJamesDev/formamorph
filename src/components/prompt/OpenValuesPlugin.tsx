import { useEffect } from 'react';
import {
  $createParagraphNode, $getRoot, $getSlot, $isElementNode, $removeSlot, $setSlot, HISTORY_MERGE_TAG,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { appendSegments, serializeNode } from './promptFieldState';
import { $isValueBoxNode, $isVariableNode, ValueBoxNode, type VariableNode } from './VariableNode';
import { VALUE_SLOT, type OpenValueView } from './openValueContext';

/** The text an open chip's slot holds, or null when it holds none. */
function $openValueText(chip: VariableNode): string | null {
  const box = $getSlot(chip, VALUE_SLOT);
  if (!$isValueBoxNode(box)) return null;
  return box.getChildren().map(serializeNode).join('\n');
}

function $fillOpenValue(chip: VariableNode, text: string, parse: ChipVocabulary['parse']): void {
  const para = $createParagraphNode();
  appendSegments(para, text, parse);
  const box = new ValueBoxNode();
  box.append(para);
  $setSlot(chip, VALUE_SLOT, box);
}

/** The field's own chips: a chip inside an open value stays a chip. */
function $fieldChips(): VariableNode[] {
  const para = $getRoot().getFirstChild();
  return $isElementNode(para) ? para.getChildren().filter($isVariableNode) : [];
}

/** Whether every field chip is open on its value (`active`) or closed with no slot (not `active`). */
function $inSync(active: boolean, values: Record<string, OpenValueView>): boolean {
  return $fieldChips().every((chip) => (active
    ? chip.isExpanded() && $openValueText(chip) === (values[chip.getToken()]?.text ?? '')
    : !chip.isExpanded() && !$getSlot(chip, VALUE_SLOT)));
}

function $sync(active: boolean, values: Record<string, OpenValueView>, parse: ChipVocabulary['parse']): void {
  for (const chip of $fieldChips()) {
    if (!active) {
      if (chip.isExpanded()) chip.setExpanded(false);
      if ($getSlot(chip, VALUE_SLOT)) $removeSlot(chip, VALUE_SLOT);
      continue;
    }
    const text = values[chip.getToken()]?.text ?? '';
    if (!chip.isExpanded()) chip.setExpanded(true);
    if ($openValueText(chip) !== text) $fillOpenValue(chip, text, parse);
  }
}

/**
 * Opens every chip of the field on its value while `active`, and closes them otherwise. The field's token
 * string never changes, and the work merges into the current history entry, so undo never walks it.
 * Re-checks after every update, which catches a rebuilt value and an undo to a closed state alike.
 */
export function OpenValuesPlugin({ active, values, parse }: {
  active: boolean;
  values: Record<string, OpenValueView>;
  parse: ChipVocabulary['parse'];
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const check = () => {
      if (editor.getEditorState().read(() => $inSync(active, values))) return;
      editor.update(() => $sync(active, values, parse), { tag: HISTORY_MERGE_TAG });
    };
    check();
    return editor.registerUpdateListener(check);
  }, [editor, active, values, parse]);
  return null;
}
