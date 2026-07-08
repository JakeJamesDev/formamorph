/* eslint-disable react-refresh/only-export-components -- this module intentionally co-locates the
   Lexical VariableNode class with its $create/$is helpers and the shared drag context; they're one unit. */
import { createContext, useContext, useState, useEffect, type ReactNode, type DragEvent } from 'react';
import {
  DecoratorNode, $getNodeByKey,
  type LexicalNode, type NodeKey, type SerializedLexicalNode, type Spread,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Chip } from '@/components/Chip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  labelForToken, colorForToken, variableForToken, baseToken, tokenVariant, withVariant,
  variantLabelForToken, variableAxes, decodeVariant, encodeVariant,
} from '@/lib/promptVariables';

/** Shared slot the dragged chip's node key is parked in on dragstart, so the editor's drop handler
 *  (in PromptField) knows which node to relocate. One ref per editor instance. */
export const PromptDragContext = createContext<{ current: string | null }>({ current: null });

export type SerializedVariableNode = Spread<{ token: string }, SerializedLexicalNode>;

const FULL = 'full'; // Tabs value sentinel for the default variant (null id)

/** The interactive chip a `VariableNode` renders: label + remove (×), draggable to reposition, and a
 *  single-click pop-out. Variables with `variants` show a segmented control to switch the chip's mode
 *  (e.g. Location → Full | Summary | List); others show a placeholder. */
function VariableChip({ nodeKey, token }: { nodeKey: NodeKey; token: string }) {
  const [editor] = useLexicalComposerContext();
  const dragKey = useContext(PromptDragContext);
  const [open, setOpen] = useState(false);
  // A read-only editor (e.g. the Default preset) may still show the pop-out to view the chip's mode, but
  // can't change or remove it. Track editability so switching presets re-renders the chip accordingly.
  const [editable, setEditable] = useState(editor.isEditable());
  useEffect(() => editor.registerEditableListener(setEditable), [editor]);
  const variable = variableForToken(token);
  const color = colorForToken(token);
  // Reflect the mode in the chip text so it's readable at a glance, not only in the pop-out.
  const variantLabel = variantLabelForToken(token);
  const label = variantLabel ? `${labelForToken(token)} (${variantLabel})` : labelForToken(token);

  const axes = variable ? variableAxes(variable) : [];
  const selection = variable ? decodeVariant(variable, tokenVariant(token)) : {};
  // How many toggle (checkbox) axes are on — used to lock the last one so at least one piece stays selected.
  const toggleOnCount = axes.filter((a) => a.toggle && selection[a.id] != null).length;

  const remove = () => editor.update(() => { $getNodeByKey(nodeKey)?.remove(); });

  // Change one axis, recomputing the combined variant id from the node's live token.
  const setAxis = (axisId: string, optionId: string | null) => {
    if (!editable || !variable) return;
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isVariableNode(node)) return;
      const base = baseToken(node.getToken());
      const next = { ...decodeVariant(variable, tokenVariant(node.getToken())), [axisId]: optionId };
      node.setToken(withVariant(base, encodeVariant(variable, next)));
    });
  };

  const handleDragStart = (e: DragEvent) => {
    dragKey.current = nodeKey;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', token); // some browsers won't start a drag without payload
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span draggable={editable} onDragStart={editable ? handleDragStart : undefined} className="inline-block align-baseline">
          <Chip
            label={label}
            onRemove={editable ? remove : undefined}
            grabbable={editable}
            style={color ? { backgroundColor: color, color: '#000' } : undefined}
          />
        </span>
      </PopoverTrigger>
      <PopoverContent className={axes.some((a) => a.options.length >= 4) ? 'w-96' : 'w-64'} align="start">
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
                      <span className="text-xs font-medium">{axis.label}</span>
                      {axis.help && <p className="text-[11px] text-muted-foreground">{axis.help}</p>}
                    </span>
                  </label>
                );
              }
              const active = selection[axis.id] ?? FULL;
              return (
                <div key={axis.id} className="space-y-2">
                  {/* One heading per axis (its own label when multi-axis, else the chip name). */}
                  <p className="text-xs font-medium">{axes.length > 1 ? axis.label : `${labelForToken(token)} mode`}</p>
                  <Tabs value={active} onValueChange={(v) => setAxis(axis.id, v === FULL ? null : v)}>
                    <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${axis.options.length}, minmax(0, 1fr))` }}>
                      {axis.options.map((opt) => (
                        <TabsTrigger key={opt.id ?? FULL} value={opt.id ?? FULL} disabled={!editable} className="text-xs px-1.5">{opt.label}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
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
          <p className="text-xs text-muted-foreground">No options for this variable.</p>
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
