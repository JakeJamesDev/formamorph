/* eslint-disable react-refresh/only-export-components -- this module intentionally co-locates the
   Lexical VariableNode class with its $create/$is helpers and the shared drag context; they're one unit. */
import { createContext, useContext, useState, type ReactNode, type DragEvent } from 'react';
import {
  DecoratorNode, $getNodeByKey,
  type LexicalNode, type NodeKey, type SerializedLexicalNode, type Spread,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Chip } from '@/components/Chip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  labelForToken, colorForToken, variableForToken, baseToken, tokenVariant, withVariant,
  variantLabelForToken,
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
  const variable = variableForToken(token);
  const variantId = tokenVariant(token);
  const color = colorForToken(token);
  // Reflect the mode in the chip text so it's readable at a glance, not only in the pop-out.
  const variantLabel = variantLabelForToken(token);
  const label = variantLabel ? `${labelForToken(token)} (${variantLabel})` : labelForToken(token);

  const remove = () => editor.update(() => { $getNodeByKey(nodeKey)?.remove(); });

  const setVariant = (id: string | null) => editor.update(() => {
    const node = $getNodeByKey(nodeKey);
    if ($isVariableNode(node)) node.setToken(withVariant(baseToken(node.getToken()), id));
  });

  const handleDragStart = (e: DragEvent) => {
    dragKey.current = nodeKey;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', token); // some browsers won't start a drag without payload
  };

  const variants = variable?.variants ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span draggable onDragStart={handleDragStart} className="inline-block align-baseline">
          <Chip
            label={label}
            onRemove={remove}
            grabbable
            style={color ? { backgroundColor: color, color: '#000' } : undefined}
          />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        {variants.length ? (
          <div className="space-y-2">
            <p className="text-xs font-medium">{labelForToken(token)} mode</p>
            <Tabs
              value={variantId ?? FULL}
              onValueChange={(v) => setVariant(v === FULL ? null : v)}
            >
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${variants.length}, minmax(0, 1fr))` }}>
                {variants.map((vr) => (
                  <TabsTrigger key={vr.id ?? FULL} value={vr.id ?? FULL}>{vr.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {/* Help lines stacked in one cell so the pop-out doesn't reflow when switching modes. */}
            <div className="grid">
              {variants.map((vr) => (
                <p
                  key={vr.id ?? FULL}
                  className={cn(
                    'col-start-1 row-start-1 text-[11px] text-muted-foreground',
                    (vr.id ?? FULL) !== (variantId ?? FULL) && 'invisible',
                  )}
                >
                  {vr.help}
                </p>
              ))}
            </div>
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
