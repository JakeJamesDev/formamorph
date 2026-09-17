import { useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  $getNodeByKey, $getSelection, $getSelectionSlotFrame, $getSlot, mountSlotContainer, type NodeKey,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import { ChipVocabularyContext } from '@/lib/chipVocabulary';
import { cn } from '@/lib/utils';
import { OpenValuesContext, VALUE_SLOT } from './openValueContext';
import { $openValueReadOnly } from './openValueCopies';

// Lexical parks the slot container, its value box and the box's paragraph as blocks; a value reads inline.
const SLOT_TARGET_CLASS = '[&>*]:inline [&>*>*]:inline [&>*>*>*]:inline';

/**
 * A chip open on the Values tab: a header naming the placeholder and the open value, with a chevron each way
 * when there is another value to open, then the value itself inside a traced outline.
 * The value lives in the node's named slot, which Lexical renders apart and this chip mounts in place.
 * `OpenValueLayoutPlugin` seats the header and draws the outline. Only the value with the caret shows its label.
 */
export function OpenValueChip({ nodeKey, token }: { nodeKey: NodeKey; token: string }) {
  const [editor] = useLexicalComposerContext();
  const vocab = useContext(ChipVocabularyContext);
  const values = useContext(OpenValuesContext);
  const open = values[token];
  const target = useRef<HTMLSpanElement>(null);
  const step = open?.step;
  // What takes input from this value away: the whole field, or this value alone.
  const [readOnly, setReadOnly] = useState<'field' | 'value' | null>(null);
  // From the editor's selection, since `:focus-within` fails while the document itself lacks focus.
  const [caret, setCaret] = useState(false);

  // A refill reparks the container, so it mounts again after every update. Mounting in place is a no-op.
  useLayoutEffect(() => {
    const holdsCaret = () => editor.getEditorState().read(() => {
      const frame = $getSelectionSlotFrame($getSelection());
      const chip = $getNodeByKey(nodeKey);
      return !!frame && !!chip && !!$getSlot(chip, VALUE_SLOT)?.is(frame);
    });
    const mount = () => {
      if (!target.current) return;
      mountSlotContainer(editor, nodeKey, VALUE_SLOT, target.current);
      // A moved island loses focus; it takes it back itself, since focusing the editor root misses it.
      const island = target.current.querySelector<HTMLElement>('[data-lexical-slot]');
      if (island && document.activeElement === document.body && holdsCaret()) island.focus();
      // Lexical sets the island's editability on reconcile only, so a role change is applied here each time.
      const editable = editor.isEditable();
      const locked = editor.getEditorState().read(() => $openValueReadOnly(nodeKey, token, values, editable));
      if (island) island.contentEditable = String(!locked);
      setReadOnly(!locked ? null : editable ? 'value' : 'field');
      setCaret(!locked && holdsCaret() && !!editor.getRootElement()?.contains(document.activeElement));
    };
    // Focus moving within the editor is not a blur.
    const onFocusOut = (e: FocusEvent) => {
      const root = editor.getRootElement();
      if (!(e.relatedTarget instanceof Node && root?.contains(e.relatedTarget))) setCaret(false);
    };
    const root = editor.getRootElement();
    root?.addEventListener('focusin', mount);
    root?.addEventListener('focusout', onFocusOut);
    mount();
    const unregister = editor.registerUpdateListener(mount);
    return () => {
      unregister();
      root?.removeEventListener('focusin', mount);
      root?.removeEventListener('focusout', onFocusOut);
    };
  }, [editor, nodeKey, token, values]);

  const color = vocab.color(token);

  return (
    <span
      data-open-value
      data-read-only={readOnly ?? undefined}
      data-caret={caret || undefined}
      style={color ? { '--chip': color, '--chip-ink': '#000' } as CSSProperties : undefined}
    >
      {/* The compact header keeps its value label for a reader and a pointer, and gives the room back. */}
      <Tip tip={caret ? undefined : open?.label} labelsChild={false}>
        {/* mousedown is swallowed so a chevron click never moves the editor's caret. */}
        <span
          data-open-value-header
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
          className="inline-flex select-none items-center gap-px px-[3px] text-meta font-medium leading-normal"
        >
          {step && <StepButton label="Previous Value" onClick={() => step(-1)}><ChevronLeft className="h-3 w-3" /></StepButton>}
          {vocab.label(token)}
          {open?.label && <span data-open-value-label className={cn('font-normal opacity-75', caret ? '' : 'sr-only')}> · {open.label}</span>}
          {readOnly === 'value' && <Lock role="img" aria-label="Read-Only" className="h-3 w-3" />}
          {step && <StepButton label="Next Value" onClick={() => step(1)}><ChevronRight className="h-3 w-3" /></StepButton>}
        </span>
      </Tip>
      <span ref={target} data-open-value-text className={cn(SLOT_TARGET_CLASS, readOnly && 'cursor-default')} />
      <svg data-open-value-shape aria-hidden><path /></svg>
    </span>
  );
}

/** A chevron on the header. The wash is the header's own ink, which the theme picks with the chip color. */
function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="rounded-sm hover:bg-[var(--chip-ink)]/15">
      {children}
    </button>
  );
}
