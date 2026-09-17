// Node reads and edits on a field's open values, shared by the Values tab plugins. Must run inside a Lexical read or update.
import {
  $createTextNode, $getRoot, $getSelection, $getSelectionSlotFrame, $getSlot, $getSlotHost, $isElementNode,
  $isTextNode,
  type BaseSelection, type LexicalNode, type PointType, type TextNode,
} from 'lexical';
import { flatOffsetOf, serializeNode } from './promptFieldState';
import { $isValueBoxNode, $isVariableNode, type ValueBoxNode, type VariableNode } from './VariableNode';
import { VALUE_SLOT } from './openValueContext';
import { splitEdges } from './valueEdges';

/** The box an open chip keeps its value in, or null. */
export function $valueBox(chip: VariableNode): ValueBoxNode | null {
  const box = $getSlot(chip, VALUE_SLOT);
  return $isValueBoxNode(box) ? box : null;
}

/** The text an open chip's slot holds, or null when it holds none. */
export function $openValueText(chip: VariableNode): string | null {
  const box = $valueBox(chip);
  return box ? box.getChildren().map(serializeNode).join('\n') : null;
}

/** The field chip whose value holds the selection, or null. */
export function $caretChip(selection: BaseSelection | null = $getSelection()): VariableNode | null {
  const frame = $getSelectionSlotFrame(selection);
  const host = frame && $getSlotHost(frame);
  return $isVariableNode(host) && host.getParent()?.is($getRoot().getFirstChild()) ? host : null;
}

/** Offset of `point` within `$openValueText(chip)`, or null when the point is not in that value. */
export function $valueOffset(chip: VariableNode, point: PointType): number | null {
  const box = $valueBox(chip);
  if (!box) return null;
  const node = point.getNode();
  const paras = box.getChildren();
  let acc = 0;
  for (const [i, para] of paras.entries()) {
    if (node.is(box) && i === point.offset) return acc;
    if ($isElementNode(para) && (node.is(para) || node.getParent()?.is(para))) {
      return acc + flatOffsetOf(para, node, point.offset, point.type);
    }
    acc += serializeNode(para).length + 1;
  }
  return node.is(box) ? acc - 1 : null;
}

/** Edge text nodes an ejection wrote beside the chip. */
export interface Ejected { before: TextNode | null; after: TextNode | null }

/**
 * Takes the edge run out of `node` and hands back the text it held, or null when there is none.
 * The run is measured on the node itself, so a run spread over two nodes moves the outer part alone.
 */
function $takeEdgeRun(node: LexicalNode | null, side: 'start' | 'end'): TextNode | null {
  if (!$isTextNode(node)) return null;
  const text = node.getTextContent();
  const edges = splitEdges(text, side);
  const run = side === 'end' ? edges.after : edges.before;
  if (!run) return null;
  node.setTextContent(side === 'end' ? text.slice(0, text.length - run.length) : text.slice(run.length));
  return $createTextNode(run);
}

/**
 * Moves an open value's edge whitespace into the field beside its chip: leading before, trailing after.
 * A whitespace-only value goes to `side`.
 */
export function $ejectEdges(chip: VariableNode, side: 'start' | 'end' = 'end'): Ejected {
  const box = $valueBox(chip);
  const out: Ejected = { before: null, after: null };
  const text = box && $openValueText(chip);
  if (!box || !text) return out;
  const { before, after } = splitEdges(text, side);
  if (after) out.after = $takeEdgeRun(box.getLastDescendant(), 'end');
  if (out.after) chip.insertAfter(out.after);
  if (before) out.before = $takeEdgeRun(box.getFirstDescendant(), 'start');
  if (out.before) chip.insertBefore(out.before);
  return out;
}
