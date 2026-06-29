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
import { cn } from '@/lib/utils';
import {
  labelForToken, colorForToken, variableForToken, baseToken, isSummaryToken, summaryToken,
} from '@/lib/promptVariables';

/** Shared slot the dragged chip's node key is parked in on dragstart, so the editor's drop handler
 *  (in PromptField) knows which node to relocate. One ref per editor instance. */
export const PromptDragContext = createContext<{ current: string | null }>({ current: null });

export type SerializedVariableNode = Spread<{ token: string }, SerializedLexicalNode>;

/** The interactive chip a `VariableNode` renders: label + remove (×), draggable to reposition, and a
 *  single-click pop-out. For summary-capable variables the pop-out toggles the chip between the full
 *  description and a short summary (`<…|summary>`); others show a placeholder. */
function VariableChip({ nodeKey, token }: { nodeKey: NodeKey; token: string }) {
  const [editor] = useLexicalComposerContext();
  const dragKey = useContext(PromptDragContext);
  const [open, setOpen] = useState(false);
  const variable = variableForToken(token);
  const summary = isSummaryToken(token);
  const color = colorForToken(token);
  // Reflect the mode in the chip text so it's readable at a glance, not only in the pop-out.
  const label = summary ? `${labelForToken(token)} (summary)` : labelForToken(token);

  const remove = () => editor.update(() => { $getNodeByKey(nodeKey)?.remove(); });

  const setSummary = (wantSummary: boolean) => editor.update(() => {
    const node = $getNodeByKey(nodeKey);
    if ($isVariableNode(node)) {
      const base = baseToken(node.getToken());
      node.setToken(wantSummary ? summaryToken(base) : base);
    }
  });

  const handleDragStart = (e: DragEvent) => {
    dragKey.current = nodeKey;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', token); // some browsers won't start a drag without payload
  };

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
      <PopoverContent className="w-56" align="start">
        {variable?.hasSummary ? (
          <div className="space-y-2">
            <p className="text-xs font-medium">{labelForToken(token)} detail</p>
            <div className="grid grid-cols-2 gap-1">
              {([['Description', false], ['Summary', true]] as const).map(([text, want]) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => setSummary(want)}
                  className={cn(
                    'rounded border px-2 py-1 text-xs transition-colors',
                    summary === want
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-secondary',
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Summary sends the short AI summary for each item, falling back to the full description where none is set.
            </p>
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
