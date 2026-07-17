// Conversion between the flat token-string a chip field stores and the Lexical editor state that shows it
// (a single plain-text paragraph of text / line breaks / chips), plus the offset math the markdown toolbar
// needs. Kept out of the component so the tricky parts are unit-testable against a headless editor.
import {
  $getRoot, $getSelection, $isRangeSelection, $createRangeSelection, $setSelection,
  $createParagraphNode, $createTextNode, $createLineBreakNode,
  $isElementNode, $isTextNode, $isLineBreakNode,
  type LexicalNode, type ElementNode,
} from 'lexical';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { applyMarkdownAction, type MarkdownAction } from '@/lib/markdownToolbar';
import { $createVariableNode, $isVariableNode } from './VariableNode';

export function appendSegments(para: ElementNode, value: string, parse: ChipVocabulary['parse']) {
  for (const seg of parse(value)) {
    if (seg.type === 'variable') {
      para.append($createVariableNode(seg.token));
      continue;
    }
    seg.value.split('\n').forEach((line, i) => {
      if (i > 0) para.append($createLineBreakNode());
      if (line.length) para.append($createTextNode(line));
    });
  }
}

export function buildEditorState(value: string, parse: ChipVocabulary['parse']) {
  const root = $getRoot();
  root.clear();
  const para = $createParagraphNode();
  appendSegments(para, value, parse);
  root.append(para);
}

export function serializeNode(node: LexicalNode): string {
  if ($isVariableNode(node)) return node.getToken();
  if ($isLineBreakNode(node)) return '\n';
  if ($isTextNode(node)) return node.getTextContent();
  if ($isElementNode(node)) return node.getChildren().map(serializeNode).join('');
  return '';
}

export function serializeRoot(): string {
  return $getRoot().getChildren().map(serializeNode).join('\n');
}

// --- flat-string offsets ---
// The editor is a view over one flat token-string, so the markdown transforms stay pure string functions
// (`markdownToolbar.ts`) instead of being reimplemented against the node tree. A chip is one node but many
// characters, so a point inside one snaps to its edge.

/** Offset of a Lexical selection point within `serializeRoot()`'s string. */
export function flatOffsetOf(
  para: ElementNode, node: LexicalNode, offset: number, type: 'text' | 'element',
): number {
  const children = para.getChildren();
  // An element point addresses a child index, not a character.
  if (node.getKey() === para.getKey()) {
    return children.slice(0, offset).reduce((acc, c) => acc + serializeNode(c).length, 0);
  }
  let acc = 0;
  for (const child of children) {
    if (child.getKey() === node.getKey()) return acc + (type === 'text' ? offset : 0);
    acc += serializeNode(child).length;
  }
  return acc;
}

/** The Lexical point for a flat-string offset — the inverse of `flatOffsetOf`. */
export function pointAtOffset(
  para: ElementNode, target: number,
): { key: string; offset: number; type: 'text' | 'element' } {
  const children = para.getChildren();
  let acc = 0;
  for (const child of children) {
    const len = serializeNode(child).length;
    if ($isTextNode(child) && target <= acc + len) {
      return { key: child.getKey(), offset: target - acc, type: 'text' };
    }
    // Landed within a chip or line break: address the paragraph slot beside it instead.
    if (target < acc + len) {
      return { key: para.getKey(), offset: child.getIndexWithinParent(), type: 'element' };
    }
    acc += len;
  }
  return { key: para.getKey(), offset: children.length, type: 'element' };
}

/**
 * Apply a markdown toolbar action to the current selection. Must run inside `editor.update`. Reads the
 * editor as a flat string, runs the pure transform, rebuilds, then restores the selection the transform
 * asked for. Rebuilding here (rather than routing through `onChange`) keeps ValueSyncPlugin's
 * external-value path — and its scroll reset — out of an ordinary formatting click.
 */
export function $applyMarkdownAction(parse: ChipVocabulary['parse'], action: MarkdownAction): void {
  const selection = $getSelection();
  const para = $getRoot().getFirstChild();
  if (!$isRangeSelection(selection) || !$isElementNode(para)) return;

  const value = serializeRoot();
  const a = flatOffsetOf(para, selection.anchor.getNode(), selection.anchor.offset, selection.anchor.type);
  const b = flatOffsetOf(para, selection.focus.getNode(), selection.focus.offset, selection.focus.type);
  const edit = applyMarkdownAction(value, Math.min(a, b), Math.max(a, b), action);

  buildEditorState(edit.value, parse);
  const rebuilt = $getRoot().getFirstChild();
  if (!$isElementNode(rebuilt)) return;
  const from = pointAtOffset(rebuilt, edit.selectionStart);
  const to = pointAtOffset(rebuilt, edit.selectionEnd);
  const range = $createRangeSelection();
  range.anchor.set(from.key, from.offset, from.type);
  range.focus.set(to.key, to.offset, to.type);
  $setSelection(range);
}
