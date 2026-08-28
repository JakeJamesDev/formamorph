/* eslint-disable react-refresh/only-export-components -- this module intentionally co-locates the
   Lexical VariableNode class with its $create/$is helpers and the shared drag context; they're one unit. */
import { createContext, useContext, useState, useEffect, type ReactNode, type DragEvent } from 'react';
import {
  DecoratorNode, $getNodeByKey,
  type LexicalNode, type NodeKey, type SerializedLexicalNode, type Spread,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ChipRenameInput } from '@/components/Chip';
import { TokenChip } from './TokenChip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AFFIX_MAX_LENGTH, AFFIX_FORBIDDEN, isValidAffix } from '@/lib/promptVariables';
import { cn } from '@/lib/utils';
import { ChipVocabularyContext } from '@/lib/chipVocabulary';

/** Shared slot the dragged chip's node key is parked in on dragstart, so the editor's drop handler
 *  (in PromptField) knows which node to relocate. One ref per editor instance. */
export const PromptDragContext = createContext<{ current: string | null }>({ current: null });

export type SerializedVariableNode = Spread<{ token: string }, SerializedLexicalNode>;

const FULL = 'full'; // switcher value sentinel for the default variant (null id)

/** One affix field: the connective words that wrap a chip's value, stored literally. Leading and trailing
 *  spaces matter here and an input hides them, so the Preview tab is where you confirm the spacing. */
function AffixInput({ label, value, disabled, onChange }: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input
        value={value}
        disabled={disabled}
        maxLength={AFFIX_MAX_LENGTH}
        // The quote delimits the affix inside the token, so it's the one character that can't appear.
        // Stripped on entry rather than rejected, so typing never silently does nothing.
        onChange={(e) => onChange(e.target.value.split(AFFIX_FORBIDDEN).join(''))}
        className="h-7 text-meta font-mono"
      />
    </label>
  );
}

/** The interactive chip a `VariableNode` renders: label + remove (×), draggable to reposition, and a
 *  single-click pop-out. Variables with `variants` show a segmented control to switch the chip's mode
 *  (e.g. Location → Full | Summary | List); others show a placeholder. */
function VariableChip({ nodeKey, token }: { nodeKey: NodeKey; token: string }) {
  const [editor] = useLexicalComposerContext();
  const dragKey = useContext(PromptDragContext);
  const vocab = useContext(ChipVocabularyContext);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // A read-only editor (e.g. the Default preset) may still show the pop-out to view the chip's mode, but
  // can't change or remove it. Track editability so switching presets re-renders the chip accordingly.
  const [editable, setEditable] = useState(editor.isEditable());
  useEffect(() => editor.registerEditableListener(setEditable), [editor]);
  const known = vocab.isKnown(token);
  const color = vocab.color(token);

  const axes = known ? vocab.axes(token) : [];
  const selection = known ? vocab.selection(token) : {};
  const affixes = known ? vocab.affixes(token) : null;
  // How many toggle (checkbox) axes are on — used to lock the last one so at least one piece stays selected.
  const toggleOnCount = axes.filter((a) => a.toggle && selection[a.id] != null).length;

  const remove = () => editor.update(() => { $getNodeByKey(nodeKey)?.remove(); });

  // Change one axis via the vocabulary, using the node's live token.
  const setAxis = (axisId: string, optionId: string | null) => {
    if (!editable || !known) return;
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isVariableNode(node)) return;
      node.setToken(vocab.setAxis(node.getToken(), axisId, optionId));
    });
  };

  // Replace one affix, keeping the other. Written straight through to the token — a placement's wording
  // travels with it, so there is no separate state to keep in sync.
  const setAffix = (which: 'pre' | 'post', value: string) => {
    if (!editable || !affixes) return;
    if (!isValidAffix(value)) return;
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isVariableNode(node)) return;
      const current = vocab.affixes(node.getToken()) ?? { pre: '', post: '' };
      node.setToken(vocab.setAffixes(node.getToken(), ...(which === 'pre' ? [value, current.post] : [current.pre, value]) as [string, string]));
    });
  };

  const handleDragStart = (e: DragEvent) => {
    dragKey.current = nodeKey;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', token); // some browsers won't start a drag without payload
    // Custom drag image: a translucent copy of the chip offset down-right of the pointer, so the chip stops
    // sitting on the cursor and hiding the insertion point (the pointer aligns to the wrapper's transparent
    // top-left corner). Cleaned up on the next tick, after the browser has snapshotted it.
    const chip = (e.currentTarget as HTMLElement).firstElementChild as HTMLElement | null;
    if (chip) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;top:-1000px;left:-1000px;padding:16px 0 0 16px;pointer-events:none';
      const ghost = chip.cloneNode(true) as HTMLElement;
      ghost.style.opacity = '0.6';
      ghost.style.margin = '0';
      wrap.appendChild(ghost);
      document.body.appendChild(wrap);
      e.dataTransfer.setDragImage(wrap, 0, 0);
      setTimeout(() => wrap.remove(), 0);
    }
  };

  // Double-click renames what the chip stands for, the same gesture that renames a keyword chip. It ends
  // the pop-out the first click of the pair opened, so the two never fight over the chip.
  const renameable = editable && known && !!vocab.rename;
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TokenChip
          token={token}
          vocab={vocab}
          draggable={editable}
          onDragStart={editable ? handleDragStart : undefined}
          onDoubleClick={renameable ? startRename : undefined}
          onRemove={editable ? remove : undefined}
          grabbable={editable}
        />
      </PopoverTrigger>
      <PopoverContent
        className={axes.some((a) => a.options.length >= 4) ? 'w-96' : 'w-64'}
        align="start"
        // Selecting an option runs editor.update, which returns focus to the editor; without this that
        // focus-leave dismisses the pop-out, so you can't change two axes in a row. Clicking truly outside
        // (pointer-down-outside) and Escape still close it.
        onFocusOutside={(e) => e.preventDefault()}
      >
        {axes.length ? (
          <div className="space-y-3">
            {axes.map((axis) => {
              // Toggle axes render as a checkbox; the last one on is locked so a stats block is never nameless.
              if (axis.toggle) {
                const isOn = selection[axis.id] != null;
                const onId = axis.options.find((o) => o.id != null)?.id ?? null;
                const locked = isOn && toggleOnCount === 1;
                return (
                  <label key={axis.id} className={cn('flex items-start gap-2', (!editable || locked) && 'cursor-default')}>
                    <Checkbox
                      checked={isOn}
                      disabled={!editable || locked}
                      onCheckedChange={() => setAxis(axis.id, isOn ? null : onId)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="text-meta font-medium">{axis.label}</span>
                      {axis.help && <p className="text-[11px] text-muted-foreground">{axis.help}</p>}
                    </span>
                  </label>
                );
              }
              const active = selection[axis.id] ?? FULL;
              return (
                <div key={axis.id} className="space-y-2">
                  {/* One heading per axis (its own label when multi-axis, else the chip name). */}
                  <p className="text-meta font-medium">{axes.length > 1 ? axis.label : `${vocab.label(token)} mode`}</p>
                  {/* `columns` wraps a long option list onto rows of that width, centered — so a final
                      short row sits under the middle of the one above rather than hanging off the left. */}
                  <ToggleGroup
                    type="single"
                    value={active}
                    // A single ToggleGroup clears its value when the active item is clicked again; an axis
                    // always has a mode, so an empty result is ignored rather than stored.
                    onValueChange={(v) => { if (v) setAxis(axis.id, v === FULL ? null : v); }}
                    className={cn('grid w-full', axis.columns && 'flex flex-wrap justify-center gap-1 h-auto')}
                    style={axis.columns ? undefined : { gridTemplateColumns: `repeat(${axis.options.length}, minmax(0, 1fr))` }}
                  >
                    {axis.options.map((opt) => (
                      <ToggleGroupItem
                        key={opt.id ?? FULL}
                        value={opt.id ?? FULL}
                        disabled={!editable}
                        className="text-meta px-1.5"
                        style={axis.columns ? { flexBasis: `calc((100% - ${(axis.columns - 1) * 0.25}rem) / ${axis.columns})` } : undefined}
                      >{opt.label}</ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  {/* Help lines stacked in one cell so the pop-out doesn't reflow when switching modes. */}
                  <div className="grid">
                    {axis.options.map((opt) => (
                      <p
                        key={opt.id ?? FULL}
                        className={cn(
                          'col-start-1 row-start-1 text-[11px] text-muted-foreground',
                          (opt.id ?? FULL) !== active && 'invisible',
                        )}
                      >
                        {opt.help}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !affixes && <p className="text-meta text-muted-foreground">No options for this variable.</p>
        )}
        {affixes && (
          <div className={cn('space-y-2', axes.length && 'mt-4 pt-3 border-t')}>
            <p className="text-meta font-medium">Prepend / Append</p>
            <p className="text-[11px] text-muted-foreground">
              Wraps the value, and vanishes with it. Spaces count — check Preview.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <AffixInput label="Prepend" value={affixes.pre} disabled={!editable} onChange={(v) => setAffix('pre', v)} />
              <AffixInput label="Append" value={affixes.post} disabled={!editable} onChange={(v) => setAffix('post', v)} />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** An atomic inline Lexical node standing in for a `<VARIABLE>` token. Serializes back to its exact
 *  token via the PromptField serializer, so untouched prompts stay byte-identical. */
export class VariableNode extends DecoratorNode<ReactNode> {
  __token: string;

  static getType(): string { return 'variable'; }
  static clone(node: VariableNode): VariableNode { return new VariableNode(node.__token, node.__key); }

  constructor(token: string, key?: NodeKey) {
    super(key);
    this.__token = token;
  }

  isInline(): boolean { return true; }
  getToken(): string { return this.getLatest().__token; }
  setToken(token: string): void { this.getWritable().__token = token; }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.style.display = 'inline-block';
    return span;
  }
  updateDOM(): boolean { return false; }

  static importJSON(serialized: SerializedVariableNode): VariableNode {
    return $createVariableNode(serialized.token);
  }
  exportJSON(): SerializedVariableNode {
    return { type: 'variable', version: 1, token: this.__token };
  }

  decorate(): ReactNode {
    return <VariableChip nodeKey={this.__key} token={this.__token} />;
  }
}

export function $createVariableNode(token: string): VariableNode {
  return new VariableNode(token);
}

export function $isVariableNode(node: LexicalNode | null | undefined): node is VariableNode {
  return node instanceof VariableNode;
}
