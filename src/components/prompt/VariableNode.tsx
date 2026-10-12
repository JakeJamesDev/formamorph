/* eslint-disable react-refresh/only-export-components -- this module intentionally co-locates the
   Lexical VariableNode class with its $create/$is helpers and the shared drag context; they're one unit. */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  DecoratorNode, ElementNode, $getNodeByKey, $isLineBreakNode, SKIP_DOM_SELECTION_TAG,
  type LexicalNode, type NodeKey, type SerializedElementNode, type SerializedLexicalNode, type Spread,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ChipRenameInput } from '@/components/Chip';
import { TokenChip } from './TokenChip';
import { ChipVocabularyContext } from '@/lib/chipVocabulary';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { remintPlaceholderPlacements } from '@/lib/placeholders';
import { OpenValueChip } from './OpenValueChip';
import { ChipReadsContext, EditValueContext, OpenValuesContext } from './openValueContext';
import { startPlacedChipDrag, type ChipDragKey } from './chipDragSource';
import { ChipOptionsDialog } from './ChipOptionsDialog';

/** Shared slot the dragged chip's node key is parked in on dragstart, so the editor's drop handler
 *  (in PromptField) knows which node to relocate. One ref per editor instance. */
export const PromptDragContext = createContext<ChipDragKey>({ current: null });

export type SerializedVariableNode = Spread<{ token: string }, SerializedLexicalNode>;

/** Whether a leading affix newline ends an otherwise empty authored line. */
function $startsOnEmptyLine(nodeKey: NodeKey, vocab: ChipVocabulary): boolean {
  let previous = $getNodeByKey(nodeKey)?.getPreviousSibling();
  while (previous) {
    const isChip = $isVariableNode(previous);
    const text = $isVariableNode(previous)
      ? `${vocab.affixes(previous.getToken())?.post ?? ''}${vocab.headerBoundaries?.(previous.getToken())?.post ?? ''}`
      : previous.getTextContent();
    const lastBreak = text.lastIndexOf('\n');
    if (text.slice(lastBreak + 1).trim()) return false;
    if (lastBreak >= 0) return true;
    if (isChip) return false;
    previous = previous.getPreviousSibling();
  }
  return true;
}

/** The interactive chip a `VariableNode` renders: label + remove (×), draggable to reposition, and a
 *  single click opens its Chip Options. */
function VariableChip({ nodeKey, token }: { nodeKey: NodeKey; token: string }) {
  const [editor] = useLexicalComposerContext();
  const dragKey = useContext(PromptDragContext);
  const vocab = useContext(ChipVocabularyContext);
  const openValues = useContext(OpenValuesContext);
  const reads = useContext(ChipReadsContext);
  const { ask } = useContext(EditValueContext);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // A read-only editor (e.g. the Default preset) may still show Chip Options to view the chip's mode, but
  // can't change or remove it. Track editability so switching presets re-renders the chip accordingly.
  const [editable, setEditable] = useState(editor.isEditable());
  useEffect(() => editor.registerEditableListener(setEditable), [editor]);
  const known = vocab.isKnown(token);
  const color = vocab.color(token);

  const affixes = known ? vocab.affixes(token) : null;
  const [startsOnEmptyLine, setStartsOnEmptyLine] = useState(() =>
    editor.getEditorState().read(() => $startsOnEmptyLine(nodeKey, vocab)));
  useEffect(() => {
    if (!/^[^\S\n]*\n/.test(affixes?.pre ?? '')) return;
    const update = () => editor.getEditorState().read(() => setStartsOnEmptyLine($startsOnEmptyLine(nodeKey, vocab)));
    update();
    return editor.registerUpdateListener(update);
  }, [editor, nodeKey, vocab, affixes?.pre]);

  const remove = () => editor.update(() => {
    const node = $getNodeByKey(nodeKey);
    if (!node) return;
    const previous = node.getPreviousSibling();
    const next = node.getNextSibling();
    const inSequence = ($isLineBreakNode(previous) && $isVariableNode(previous.getPreviousSibling()))
      || ($isLineBreakNode(next) && $isVariableNode(next.getNextSibling()));
    if (inSequence && (!previous || $isLineBreakNode(previous)) && (!next || $isLineBreakNode(next))) {
      if (next) next.remove();
      else previous?.remove();
    }
    node.remove();
  });

  // A family with structure to walk can re-aim a placed chip; the static prompt variables have none, so the
  // row is simply absent there. A chip whose placeholder is gone still offers it — re-pointing it is the fix.
  const fixed = vocab.fixed?.(token) ?? false;
  const repickable = editable && known && !fixed && !!vocab.structure && !!vocab.repoint;

  // The one-click path to this chip's value on the Values tab. It needs a value that can be written: a
  // prompt variable has none, and neither does a read-only field or a pin typed off the placeholder's list.
  const editableValue = editable && !!ask && !!openValues[token]?.write;
  const editValue = () => { setOpen(false); ask?.(nodeKey); };

  /** Move the chip onto what the picker settled on, keeping what the placement itself decided. */
  const repick = (picked: string) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isVariableNode(node)) return;
      node.setToken(vocab.repoint?.(node.getToken(), picked) ?? picked);
    });
    setOpen(false);
  };

  // Commits at once on the live token and leaves the DOM selection, so focus stays in the dialog.
  const update = (change: (token: string) => string) => {
    if (!editable || !known) return;
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isVariableNode(node)) node.setToken(change(node.getToken()));
    }, { tag: SKIP_DOM_SELECTION_TAG, discrete: true });
  };

  const handleDragStart = (event: React.DragEvent<HTMLElement>) =>
    startPlacedChipDrag(event, dragKey, nodeKey, token);

  // Double-click renames what the chip stands for, the same gesture that renames a keyword chip. It ends
  // the dialog the first click of the pair opened, so the two never fight over the chip.
  const renameable = editable && known && !fixed && !!vocab.rename;
  const startRename = () => { setOpen(false); setRenaming(true); };
  if (renaming) {
    return (
      <ChipRenameInput
        withRemove={editable}
        value={vocab.label(token)}
        ariaLabel={`Rename ${vocab.label(token)}`}
        style={color ? { backgroundColor: color, color: '#000' } : undefined}
        onCommit={(next) => { setRenaming(false); vocab.rename?.(token, next); }}
        onCancel={() => setRenaming(false)}
      />
    );
  }

  const chip = (
    <TokenChip
      token={token}
      vocab={vocab}
      showAffixes
      startsOnEmptyLine={startsOnEmptyLine}
      draggable={editable}
      onDragStart={editable ? handleDragStart : undefined}
      onDoubleClick={renameable ? startRename : undefined}
      onRemove={editable ? remove : undefined}
      grabbable={editable}
    />
  );
  // A Built-in has nothing to set, so its chip opens nothing; its tooltip says what it becomes.
  if (known && vocab.builtin?.(token)) return chip;

  return (
    <ChipOptionsDialog
      open={open}
      onOpenChange={setOpen}
      trigger={chip}
      token={token}
      vocab={vocab}
      reads={reads}
      editable={editable && known}
      update={update}
      onRepick={repickable ? repick : undefined}
      onEditValue={editableValue ? editValue : undefined}
    />
  );
}

/** An atomic inline Lexical node standing in for a `<VARIABLE>` token. Serializes back to its exact
 *  token via the PromptField serializer, so untouched prompts stay byte-identical. */
export class VariableNode extends DecoratorNode<ReactNode> {
  __token: string;
  /** Open on the Values tab: the chip shows its value, held in its `value` slot. */
  __expanded = false;

  static getType(): string { return 'variable'; }
  static clone(node: VariableNode): VariableNode { return new VariableNode(node.__token, node.__key); }

  constructor(token: string, key?: NodeKey) {
    super(key);
    this.__token = token;
  }

  afterCloneFrom(prev: this): void {
    super.afterCloneFrom(prev);
    this.__expanded = prev.__expanded;
  }

  isInline(): boolean { return true; }
  getToken(): string { return this.getLatest().__token; }
  getTextContent(): string { return this.getToken(); }
  setToken(token: string): void { this.getWritable().__token = token; }
  isExpanded(): boolean { return this.getLatest().__expanded; }
  setExpanded(expanded: boolean): void { this.getWritable().__expanded = expanded; }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    // Affixes and open values wrap with surrounding text; the chip pill stays unbroken.
    span.style.display = 'inline';
    return span;
  }
  updateDOM(prev: VariableNode): boolean { return prev.__expanded !== this.__expanded; }

  static importJSON(serialized: SerializedVariableNode): VariableNode {
    // Only the clipboard deserializes through here (fields load via parsePlaceholderText, drags move live
    // nodes), so this token is a pasted copy — a new placement. Re-mint so a Unique chip never shares the
    // source's roll; prompt `<...>` tokens pass through unchanged.
    return $createVariableNode(remintPlaceholderPlacements(serialized.token));
  }
  exportJSON(): SerializedVariableNode {
    return { type: 'variable', version: 1, token: this.__token };
  }

  decorate(): ReactNode {
    return this.__expanded
      ? <OpenValueChip nodeKey={this.__key} token={this.__token} />
      : <VariableChip nodeKey={this.__key} token={this.__token} />;
  }
}

/** An open chip's value: a shadow root, so its text is a document of its own inside the chip. */
export class ValueBoxNode extends ElementNode {
  /** The text this box was filled with. Edge whitespace is pending only once the value differs from it. */
  __filled: string;

  constructor(filled = '', key?: NodeKey) {
    super(key);
    this.__filled = filled;
  }

  static getType(): string { return 'placeholder-value-box'; }
  static clone(node: ValueBoxNode): ValueBoxNode { return new ValueBoxNode(node.__filled, node.__key); }
  static importJSON(): ValueBoxNode { return new ValueBoxNode(); }
  getFilled(): string { return this.getLatest().__filled; }
  exportJSON(): SerializedElementNode { return { ...super.exportJSON(), type: ValueBoxNode.getType(), version: 1 }; }

  createDOM(): HTMLElement { return document.createElement('span'); }
  updateDOM(): boolean { return false; }
  isShadowRoot(): boolean { return true; }
}

export function $isValueBoxNode(node: LexicalNode | null | undefined): node is ValueBoxNode {
  return node instanceof ValueBoxNode;
}

export function $createVariableNode(token: string): VariableNode {
  return new VariableNode(token);
}

export function $isVariableNode(node: LexicalNode | null | undefined): node is VariableNode {
  return node instanceof VariableNode;
}
